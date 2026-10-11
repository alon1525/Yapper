/**
 * Drives the real pipeline against a real export, with the model stages read
 * from disk instead of called.
 *
 *   npx vite-node scripts/demo-run.ts -- prompt   <export.txt> <dir>
 *   npx vite-node scripts/demo-run.ts -- verify   <export.txt> <dir> <findings.json>
 *   npx vite-node scripts/demo-run.ts -- check    <export.txt> <dir> <findings.json> <written.json>
 *
 * `prompt` writes the detective prompt a model would receive. `verify` runs
 * stage 5 and 6 over a findings file and writes the writer prompt. `check` runs
 * stage 8 over a written deck and writes the finished, name-restored report.
 *
 * Everything the model would do is the file; everything else is the product's
 * own code, called the way `useReport.ts` calls it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DiscoverySchema,
  WrittenDeckSchema,
  analyzeCommitments,
  analyzeInteractions,
  analyzePhrases,
  anonymizeMessages,
  computeStats,
  createVerificationContext,
  findCandidateMoments,
  findStalledPlans,
  isDuplicate,
  parseChat,
  planDeck,
  restoreDeep,
  verifyDictionary,
  verifyFinding,
  verifySlideCopy,
  type AnonymizedMessage,
  type Finding,
  type Slide,
} from '@wrapped/core';
import { buildDetectivePayload } from '../apps/web/lib/detectivePayload';
import { DETECTIVE_SYSTEM, detectivePrompt } from '../apps/web/lib/detectivePrompt';
import { WRITER_SYSTEM, writerPrompt } from '../apps/web/lib/writerPrompt';
import type { Brief } from '../apps/web/lib/brief';

const [mode, exportPath, outDir, findingsPath, writtenPath] = process.argv.slice(2);
if (!mode || !exportPath || !outDir) throw new Error('usage: demo-run.ts <mode> <export> <dir> ...');
mkdirSync(outDir, { recursive: true });

/* The brief a real reader would produce, not the hostile test fixture. */
const brief: Brief = {
  language: 'he',
  kind: 'Friends group',
  tone: 'roast',
  notes: '',
  photos: {},
  groupPhotos: {},
};

const text = readFileSync(exportPath, 'utf8');
const parsed = parseChat(text);
const stats = computeStats(parsed, { fileName: exportPath });
const analysis = { parsed, stats, moments: findCandidateMoments(parsed), fileName: exportPath };

/* Exactly as useReport.ts:105 does it — the pseudonymizer must be this one. */
const { payload, pseudonymizer } = buildDetectivePayload(analysis, brief);
const ctx = createVerificationContext(parsed, pseudonymizer);

const write = (name: string, body: string) => {
  writeFileSync(join(outDir, name), body, 'utf8');
  console.log(`wrote ${name} (${body.length} chars)`);
};

if (mode === 'prompt') {
  write('detective-system.txt', DETECTIVE_SYSTEM);
  write('detective-prompt.txt', detectivePrompt(payload));
  console.log(`participants ${parsed.participants.length} · messages ${stats.totalMessages}`);
  process.exit(0);
}

/* ---- stage 5: verify the findings against the real messages ------------- */

const discovery = DiscoverySchema.parse(
  JSON.parse(readFileSync(findingsPath!, 'utf8')),
);

const verified: { finding: Finding; strength: number }[] = [];
const rejected: { id: string; claim: string; issues: unknown[] }[] = [];

for (const finding of discovery.findings) {
  const verdict = verifyFinding(finding, ctx);
  if (verdict.action === 'reject') {
    rejected.push({ id: finding.id, claim: finding.claim, issues: verdict.issues });
    continue;
  }
  verified.push({ finding: verdict.value, strength: verdict.strength });
}

console.log(`\nSTAGE 5 — findings proposed ${discovery.findings.length}, verified ${verified.length}, rejected ${rejected.length}`);
for (const r of rejected) {
  console.log(`  REJECT ${r.id}: ${r.claim.slice(0, 70)}`);
  for (const i of r.issues as { code: string; message: string }[]) {
    console.log(`         ${i.code}: ${i.message}`);
  }
}

/* ---- stage 6: plan ------------------------------------------------------ */

const language = stats.language;
const plan = planDeck({
  stats,
  interactions: analyzeInteractions(parsed),
  commitments: analyzeCommitments(parsed, language),
  phrases: analyzePhrases(parsed, language),
  stalledPlans: findStalledPlans(parsed, language),
  findings: verified,
  tokenOf: (name) => pseudonymizer.tokenFor(name),
  messages: parsed.messages,
});

console.log(`\nSTAGE 6 — ${plan.briefs.length} slides planned, ${plan.suppressed.length} suppressed`);
for (const s of plan.suppressed) console.log(`  SUPPRESS ${JSON.stringify(s)}`);

const byId = new Map(parsed.messages.map((m) => [m.id, m]));
const evidence: Record<string, AnonymizedMessage[]> = {};
for (const b of plan.briefs) {
  const messages = b.evidenceMessageIds
    .map((id) => byId.get(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined && m.kind === 'text')
    .slice(0, b.quoteBudget);
  if (messages.length > 0) evidence[b.id] = anonymizeMessages(messages, pseudonymizer);
}

if (mode === 'verify') {
  write('writer-system.txt', WRITER_SYSTEM);
  write(
    'writer-prompt.txt',
    writerPrompt({
      language,
      brief: { language: brief.language, kind: brief.kind, notes: brief.notes },
      voice: discovery.voice,
      groupSummary: discovery.groupIdentity.summary,
      briefs: plan.briefs,
      evidence,
    }),
  );
  write('audit-stage5.json', JSON.stringify({ verified: verified.length, rejected }, null, 2));
  process.exit(0);
}

/* ---- stage 8: check the copy -------------------------------------------- */

const written = WrittenDeckSchema.parse(JSON.parse(readFileSync(writtenPath!, 'utf8')));
const slides: Slide[] = [];
const rejectedSlides: { id: string; issues: unknown[] }[] = [];

for (const slide of written.slides) {
  const planned = plan.briefs.find((b) => b.id === slide.id);
  const checked = verifySlideCopy(
    {
      ...slide,
      stats: planned?.stats ?? [],
      evidenceMessageIds: planned?.evidenceMessageIds ?? [],
    },
    ctx,
  );
  if (checked.action === 'reject') {
    rejectedSlides.push({ id: slide.id, issues: checked.issues });
    continue;
  }
  if (slides.some((kept) => isDuplicate(kept, checked.value))) {
    rejectedSlides.push({ id: slide.id, issues: [{ code: 'duplicate', message: 'Repeats an earlier slide.' }] });
    continue;
  }
  slides.push(checked.value);
}

const dictionary = verifyDictionary(written.dictionary, ctx);

console.log(`\nSTAGE 8 — slides written ${written.slides.length}, kept ${slides.length}, rejected ${rejectedSlides.length}`);
for (const r of rejectedSlides) {
  console.log(`  REJECT ${r.id}`);
  for (const i of r.issues as { code: string; message: string }[]) {
    console.log(`         ${i.code}: ${i.message}`);
  }
}
console.log(`  dictionary kept ${dictionary.kept.length}, rejected ${dictionary.rejected.length}`);
for (const r of dictionary.rejected) {
  console.log(`  REJECT dictionary "${r.phrase}": ${r.issues.map((i) => i.code).join(', ')}`);
}

/* Names go back on last, exactly as in the browser. */
const final = {
  slides: restoreDeep(slides, pseudonymizer),
  dictionary: restoreDeep(dictionary.kept, pseudonymizer),
  audit: { rejectedSlides, rejectedDictionary: dictionary.rejected, suppressed: plan.suppressed },
};

write('report.json', JSON.stringify(final, null, 2));
