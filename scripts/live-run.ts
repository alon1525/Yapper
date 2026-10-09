/**
 * Runs the real paid pipeline against a real export, calling the real model.
 *
 *   npx vite-node scripts/live-run.ts -- <export.txt> <outDir> [--lang he] [--kind "Friends group"] [--tone roast] [--reuse-findings]
 *
 * Every stage is the product's own code, called the way `useReport.ts` calls
 * it: detective payload → /api/detective's generation → verify → plan → the
 * writer's generation → verify copy → restore names. Nothing is mocked, which
 * is the point — the thing being judged is the writing, and only the model
 * writes.
 *
 * Costs money: two paid generations per run. `--reuse-findings` reads the
 * detective's reply back from `<outDir>/findings.json` instead of asking again,
 * so a change to the planner or the writer prompt costs one call, not two.
 *
 * Reads the model configuration from `apps/web/.env.local`. Writes
 * `findings.json`, `writer-prompt.txt`, `written.json`, `report.json` and a
 * readable `report.txt` into `outDir`. The output carries real names and real
 * quotes: keep `outDir` outside the repository.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DiscoverySchema,
  WrittenDeckSchema,
  anonymizeMessages,
  computeStats,
  createVerificationContext,
  dedupeVerdicts,
  findCandidateMoments,
  inferGenders,
  isDuplicate,
  normalizeWrittenDeck,
  numbersIn,
  parseChat,
  pickVoiceSamples,
  planDeck,
  restoreDeep,
  verifyDictionary,
  verifyFinding,
  verifySlideCopy,
  type AnonymizedMessage,
  type Discovery,
  type Finding,
  type Slide,
  type WrittenDeck,
} from '@wrapped/core';
import type { Brief } from '../apps/web/lib/brief';
import type { ReportLanguage } from '../apps/web/lib/languages';
import { buildDetectivePayload } from '../apps/web/lib/detectivePayload';
import { DETECTIVE_SYSTEM, detectivePrompt } from '../apps/web/lib/detectivePrompt';
import { WRITER_SYSTEM, writerPrompt } from '../apps/web/lib/writerPrompt';
import { generateStructured } from '../apps/web/lib/generate';
import { modelFor } from '../apps/web/lib/providers';

/* ---- arguments ---------------------------------------------------------- */

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const [exportPath, outDir] = positional;
if (!exportPath || !outDir) {
  throw new Error('usage: live-run.ts <export.txt> <outDir> [--lang he] [--kind ...] [--tone roast|gentle] [--reuse-findings]');
}
mkdirSync(outDir, { recursive: true });

/* ---- environment -------------------------------------------------------- */

const envPath = resolve(__dirname, '../apps/web/.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

const write = (name: string, body: string) => {
  writeFileSync(join(outDir, name), body, 'utf8');
  console.log(`wrote ${name} (${body.length} chars)`);
};

/* ---- the chat ----------------------------------------------------------- */

const brief: Brief = {
  language: (flag('lang') ?? 'he') as ReportLanguage,
  kind: flag('kind') ?? 'Friends group',
  tone: (flag('tone') ?? 'roast') as Brief['tone'],
  notes: flag('notes') ?? '',
  photos: {},
  groupPhotos: {},
};

const text = readFileSync(exportPath, 'utf8');
const parsed = parseChat(text);
const stats = computeStats(parsed, { fileName: exportPath });
const analysis = { parsed, stats, moments: findCandidateMoments(parsed), fileName: exportPath };
console.log(`participants ${parsed.participants.length} · messages ${stats.totalMessages} · ${stats.span.label}`);

const { payload, pseudonymizer, derived } = buildDetectivePayload(analysis, brief);
const ctx = createVerificationContext(parsed, pseudonymizer);

async function main() {
  /* ---- stage 4: investigate ------------------------------------------ */

  const findingsPath = join(outDir, 'findings.json');
  let discovery: Discovery;
  if (has('reuse-findings') && existsSync(findingsPath)) {
    discovery = DiscoverySchema.parse(JSON.parse(readFileSync(findingsPath, 'utf8')));
    console.log(`reused ${discovery.findings.length} findings from findings.json`);
  } else {
    const model = modelFor('detective');
    if (!model) throw new Error('no detective model configured');
    const prompt = detectivePrompt(payload);
    write('detective-prompt.txt', prompt);
    console.log(`detective: ${model}, ${prompt.length} chars of prompt…`);
    const started = Date.now();
    const result = await generateStructured({
      model,
      system: DETECTIVE_SYSTEM,
      prompt,
      schema: DiscoverySchema,
      maxTokens: 16000,
      stage: 'detective',
    });
    if (!result.ok) throw new Error(`detective failed: ${result.error} ${result.detail ?? ''}`);
    discovery = result.value;
    console.log(`detective replied in ${Math.round((Date.now() - started) / 1000)}s with ${discovery.findings.length} findings`);
    write('findings.json', JSON.stringify(discovery, null, 2));
  }

  /* ---- stage 5: verify ----------------------------------------------- */

  const verified: { finding: Finding; strength: number }[] = [];
  const rejectedFindings: { id: string; claim: string; issues: unknown[] }[] = [];
  for (const finding of discovery.findings) {
    const verdict = verifyFinding(finding, ctx);
    if (verdict.action === 'reject') {
      rejectedFindings.push({ id: finding.id, claim: finding.claim, issues: verdict.issues });
      continue;
    }
    verified.push({ finding: verdict.value, strength: verdict.strength });
  }
  console.log(`verified ${verified.length} / ${discovery.findings.length} findings`);
  for (const r of rejectedFindings) {
    console.log(`  REJECT ${r.id}: ${r.claim.slice(0, 80)}`);
    for (const i of r.issues as { code: string; message: string }[]) console.log(`         ${i.code}: ${i.message}`);
  }

  /* ---- stage 6: plan — exactly as useReport.ts ------------------------ */

  const language = stats.language;
  const plan = planDeck({
    stats,
    interactions: derived.interactions,
    commitments: derived.commitments,
    phrases: derived.phrases,
    stalledPlans: derived.stalledPlans,
    findings: verified,
    tokenOf: (name) => pseudonymizer.tokenFor(name),
    messages: parsed.messages,
  });
  console.log(`planned ${plan.briefs.length} slides, suppressed ${plan.suppressed.length}`);
  for (const s of plan.suppressed) console.log(`  SUPPRESS ${s.slide}: ${s.reason}`);

  const SAMPLE_PER_PERSON = 24;

  const byId = new Map(parsed.messages.map((m) => [m.id, m]));
  const evidence: Record<string, AnonymizedMessage[]> = {};
  for (const slideBrief of plan.briefs) {
    const messages = slideBrief.evidenceMessageIds
      .map((id) => byId.get(id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined && m.kind === 'text')
      .slice(0, slideBrief.quoteBudget);
    if (messages.length > 0) evidence[slideBrief.id] = anonymizeMessages(messages, pseudonymizer);
  }

  const subjects = new Set(plan.briefs.filter((b) => b.people.length === 1).map((b) => b.people[0]!));
  const voiceSamples: Record<string, AnonymizedMessage[]> = {};
  for (const [sender, messages] of pickVoiceSamples(parsed, { perPerson: SAMPLE_PER_PERSON })) {
    const token = pseudonymizer.tokenFor(sender);
    if (!subjects.has(token)) continue;
    voiceSamples[token] = anonymizeMessages(messages, pseudonymizer);
  }

  const mentioned = new Set(plan.briefs.flatMap((b) => b.people));
  const genders: Record<string, 'm' | 'f'> = {};
  for (const [sender, gender] of inferGenders(parsed)) {
    const token = pseudonymizer.tokenFor(sender);
    if (mentioned.has(token)) genders[token] = gender;
  }
  console.log(`genders inferred for ${Object.keys(genders).length} of ${mentioned.size} people on slides`);

  const deckFigures = new Set<number>();
  for (const b of plan.briefs) {
    for (const s of b.stats) {
      if (typeof s.value === 'number') deckFigures.add(s.value);
      else for (const n of numbersIn(s.value)) deckFigures.add(n);
      for (const n of numbersIn(s.label)) deckFigures.add(n);
    }
  }

  /* ---- stage 7: write -------------------------------------------------- */

  const prompt = writerPrompt({
    language,
    brief: { language: brief.language, kind: brief.kind, tone: brief.tone, notes: brief.notes },
    voice: discovery.voice,
    groupSummary: discovery.groupIdentity.summary,
    briefs: plan.briefs,
    evidence,
    voiceSamples,
    genders,
  });
  write('writer-system.txt', WRITER_SYSTEM);
  write('writer-prompt.txt', prompt);
  if (has('dry')) {
    console.log('dry run: stopping before the writer is called');
    return;
  }

  const model = modelFor('write');
  if (!model) throw new Error('no writer model configured');
  console.log(`writer: ${model}, ${prompt.length} chars of prompt…`);
  const started = Date.now();
  const result = await generateStructured({
    model,
    system: WRITER_SYSTEM,
    prompt,
    schema: WrittenDeckSchema,
    maxTokens: 20000,
    stage: 'write',
    normalize: (deck) => normalizeWrittenDeck(deck, new Map(plan.briefs.map((b) => [b.id, b.format]))),
  });
  if (!result.ok) throw new Error(`writer failed: ${result.error} ${result.detail ?? ''}`);
  const written: WrittenDeck = result.value;
  console.log(`writer replied in ${Math.round((Date.now() - started) / 1000)}s with ${written.slides.length} slides${result.repaired ? ' (repaired)' : ''}`);
  write('written.json', JSON.stringify(written, null, 2));

  /* ---- stage 8: check the copy ---------------------------------------- */

  const slides: Slide[] = [];
  const rejectedSlides: { id: string; issues: unknown[] }[] = [];
  for (const slide of written.slides) {
    const planned = plan.briefs.find((b) => b.id === slide.id);
    const checked = verifySlideCopy(
      { ...slide, stats: planned?.stats ?? [], evidenceMessageIds: planned?.evidenceMessageIds ?? [] },
      ctx,
      planned?.scoreAxes ?? [],
      {
        figures: deckFigures,
        texts: (slide.people.length === 1 ? (voiceSamples[slide.people[0]!] ?? []) : []).map((m) => m.text),
      },
    );
    if (checked.action === 'reject') {
      rejectedSlides.push({ id: slide.id, issues: checked.issues });
      continue;
    }
    if (slides.some((kept) => isDuplicate(kept, checked.value))) {
      rejectedSlides.push({ id: slide.id, issues: [{ code: 'duplicate', message: 'Repeats an earlier slide.' }] });
      continue;
    }
    if (checked.issues.length > 0) {
      console.log(`  SOFT ${slide.id}: ${checked.issues.map((i) => `${i.code} — ${i.message}`).join('; ')}`);
    }
    slides.push(checked.value);
  }
  const dictionary = verifyDictionary(written.dictionary, ctx);
  console.log(`kept ${slides.length} / ${written.slides.length} slides, dictionary ${dictionary.kept.length}`);
  for (const r of rejectedSlides) {
    console.log(`  REJECT ${r.id}`);
    for (const i of r.issues as { code: string; message: string }[]) console.log(`         ${i.code}: ${i.message}`);
  }

  const final = {
    slides: restoreDeep(dedupeVerdicts(slides), pseudonymizer),
    dictionary: restoreDeep(dictionary.kept, pseudonymizer),
    audit: { rejectedFindings, rejectedSlides, suppressed: plan.suppressed },
  };
  write('report.json', JSON.stringify(final, null, 2));

  /* ---- readable --------------------------------------------------------- */

  const out: string[] = [];
  for (const s of final.slides) {
    out.push(`═══ ${s.id} · ${s.type} · ${s.format}${s.people.length ? ` · ${s.people.join(', ')}` : ''}`);
    out.push(`TITLE: ${s.title}`);
    if (s.subtitle) out.push(`SUB:   ${s.subtitle}`);
    if (s.body) out.push(`BODY:\n${s.body.split('\n').map((l) => `   ${l}`).join('\n')}`);
    if (s.closer) out.push(`CLOSER: ${s.closer}`);
    if (s.jokeScores.length) out.push(`RATINGS: ${s.jokeScores.map((j) => `${j.label} ${j.value}`).join(' | ')}`);
    for (const q of s.quotes) out.push(`QUOTE: [${q.speaker} · ${q.date}] ${q.text}`);
    out.push('');
  }
  for (const d of final.dictionary) {
    out.push(`DICT: ${d.phrase} (${d.partOfSpeech}) — ${d.definition}${d.origin ? ` · ${d.origin}` : ''}`);
  }
  write('report.txt', out.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
