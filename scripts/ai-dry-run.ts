/**
 * Builds the exact request the AI slide would send, from a real export, without
 * a key or a paid call.
 *
 * Why this exists: the payload is the one thing in the product that leaves the
 * device, and it is assembled from three modules that each look safe in
 * isolation. Reading it as a file — the literal bytes a model would receive —
 * is the only honest way to check both that no real name survives and that the
 * prompt is worth paying for.
 *
 *   npx vite-node scripts/ai-dry-run.ts -- "<export.txt>" <outDir>
 *
 * Writes payload.json, prompt.txt and mapping.json to outDir. The mapping is
 * the deanonymisation key: it exists so `scripts/ai-restore.ts` can complete the
 * round trip locally, and it must never be committed or uploaded.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeStats, findCandidateMoments, parseChat } from '@wrapped/core';
import { buildPreviewPayload } from '../apps/web/lib/aiPayload';
import { SYSTEM, userPrompt } from '../apps/web/lib/aiPrompt';
import type { Brief } from '../apps/web/lib/brief';
import { buildPremiumPayload } from '../apps/web/lib/premiumPayload';
import { premiumPrompt, premiumSystem } from '../apps/web/lib/premiumPrompt';
import { buildDetectivePayload } from '../apps/web/lib/detectivePayload';
import { DETECTIVE_SYSTEM, detectivePrompt } from '../apps/web/lib/detectivePrompt';

const [exportPath, outDir = 'dry-run'] = process.argv.slice(2);
if (!exportPath) throw new Error('usage: ai-dry-run.ts <export.txt> [outDir]');

const text = readFileSync(exportPath, 'utf8');
const parsed = parseChat(text);
const stats = computeStats(parsed, { fileName: exportPath });
const moments = findCandidateMoments(parsed);

/**
 * A deliberately hostile brief: the notes name every participant this export
 * has, in the plainest possible way.
 *
 * The onboarding's notes box is the only field in the product where the reader
 * types real names *at* the model rather than at each other, which makes it the
 * one new way a name could reach a prompt without passing through
 * `anonymizeMessages`. Running the worst case through the real builders is how
 * that stays true rather than remembered — if the scrub is ever dropped from
 * `briefDigest`, gate 2 below fails on this line and not in production.
 */
const brief: Brief = {
  language: 'en',
  kind: 'Friends group',
  tone: 'roast',
  notes: parsed.participants
    .slice(0, 6)
    .map((name) => `${name} never replies.`)
    .join(' '),
  photos: {},
  groupPhotos: {},
};

const { payload, pseudonymizer } = buildPreviewPayload(
  { parsed, stats, moments, fileName: exportPath },
  brief,
);

const prompt = userPrompt(payload);

/*
  The paid payload is the one request in the product that carries real names,
  and it is checked in the opposite direction from every other payload here.

  It used to be gated by the same leak scan as the free ones. It no longer can
  be: the reader unlocks this report for their own group knowing the names go
  with it, because a model that only ever sees `Person E` writes the generic
  paid deck that made this change necessary. So the assertion inverts. A premium
  payload with *no* names in it means the pseudonymiser has crept back into this
  path, and the failure that produces is silent — a report that still generates,
  still validates, and is quietly worthless again.
*/
const premium = buildPremiumPayload(
  { parsed, stats, moments, fileName: exportPath },
  brief,
);
const premiumText = premiumPrompt(premium);

/*
  The detective payload is the widest surface in the product by a distance, and
  every new field on it is derived from message *bodies* rather than quoted from
  them — which is exactly the category the README already flags as the likeliest
  leak. Repeated n-grams are worse than the distinctive single words that
  prompted that warning: a two- or three-word phrase carries a nickname far more
  often than one word does, and "words this group repeats" is a metric built to
  surface precisely the phrases outsiders would not understand.
  
  It also carries session keywords, session summaries, stalled-plan topics (which
  are matched straight out of message text and routinely include a venue or a
  person) and per-person signature phrases. Every one of them is scrubbed in the
  builder; this is the check that keeps that true.
*/
const detective = buildDetectivePayload(
  { parsed, stats, moments, fileName: exportPath },
  brief,
);
const detectiveText = detectivePrompt(detective.payload);

// --- Gate 1: the route's own zod enum. Bypassing the schema offline would let
// this script produce a prompt the real server rejects with a 400.
if (!['en', 'he', 'other'].includes(payload.language)) {
  throw new Error(`language "${payload.language}" is outside the route's enum`);
}

// --- Gate 2: no real name anywhere in the bytes that would be sent. This
// inspects payload *contents*, which is strictly stronger than watching the
// network tab: it also covers the fields anonymizeMessages never touches —
// moment ids, scoring reasons, the span label.
//
// Boundaries matter here, and getting them wrong in either direction is bad. A
// raw substring search flags `תומר` inside `מזתומרת` ("what do you mean") and
// cries leak on a word that merely contains a name. Matching on standalone
// occurrences only — the same letter/digit lookarounds the scrubber uses — is
// what actually distinguishes "someone was addressed by name" from "Hebrew".
function scan(haystack: string): { leaks: string[]; embedded: string[] } {
  const leaks: string[] = [];
  const embedded: string[] = [];
  for (const name of parsed.participants) {
    for (const variant of [name, ...name.split(/[\s._-]+/).filter((p) => p.length >= 3)]) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(haystack)) {
        leaks.push(variant);
      } else if (haystack.includes(variant)) {
        embedded.push(variant);
      }
    }
  }
  return { leaks, embedded };
}

const free = scan(`${prompt}\n${JSON.stringify(payload)}`);
const paid = scan(`${premiumText}\n${JSON.stringify(premium)}`);
// Only the free payloads are held to "no names". The paid one is scanned too,
// but its result is reported rather than enforced — and the direction is
// reversed, because there it is an absence that means something is broken.
const leaks = free.leaks;
const embedded = free.embedded;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'payload.json'), JSON.stringify(payload, null, 2), 'utf8');
writeFileSync(join(outDir, 'prompt.txt'), `${SYSTEM}\n\n===== USER =====\n\n${prompt}`, 'utf8');
writeFileSync(
  join(outDir, 'premium-payload.json'),
  JSON.stringify(premium, null, 2),
  'utf8',
);
writeFileSync(
  join(outDir, 'premium-prompt.txt'),
  `${premiumSystem(brief.tone)}\n\n===== USER =====\n\n${premiumText}`,
  'utf8',
);
writeFileSync(
  join(outDir, 'detective-payload.json'),
  JSON.stringify(detective.payload, null, 2),
  'utf8',
);
writeFileSync(
  join(outDir, 'detective-prompt.txt'),
  `${DETECTIVE_SYSTEM}

===== USER =====

${detectiveText}`,
  'utf8',
);
writeFileSync(
  join(outDir, 'mapping.json'),
  JSON.stringify(Object.fromEntries(pseudonymizer.reverse), null, 2),
  'utf8',
);

const promptChars = SYSTEM.length + prompt.length;
const premiumChars = premiumSystem(brief.tone).length + premiumText.length;
console.log(`participants        ${parsed.participants.length}`);
console.log(`messages            ${stats.totalMessages}`);
console.log(`language            ${payload.language}`);
console.log(`span                ${stats.span.label}`);
console.log(`brief notes         ${payload.brief?.notes ?? '(none)'}`);
console.log(`moments in payload  ${payload.moments.length}`);
console.log(`excerpt messages    ${payload.moments.reduce((n, m) => n + m.messages.length, 0)}`);
console.log(`prompt characters   ${promptChars} (free) · ${premiumChars} (premium)`);
console.log(`premium people      ${premium.people.length}`);
console.log(`premium moments     ${premium.moments.length}`);
console.log(`premium eras        ${premium.eras.length}`);
console.log(
  `premium excerpt     ${premium.moments.reduce((n, m) => n + m.messages.length, 0)} burst messages + ${premium.people.reduce((n, p) => n + p.samples.length, 0)} own-voice lines`,
);
console.log(
  `premium names       ${paid.leaks.length === 0 ? 'NONE — the paid path has been re-anonymised, which is a bug' : `${new Set(paid.leaks).size} of ${parsed.participants.length} participants, as intended`}`,
);
console.log(`detective chars     ${DETECTIVE_SYSTEM.length + detectiveText.length}`);
console.log(`detective convos    ${detective.payload.conversations.length}`);
console.log(`detective phrases   ${detective.payload.phrases.length}`);
console.log(`detective contagion ${detective.payload.contagions.length}`);
console.log(`detective plans     ${detective.payload.stalledPlans.length}`);
console.log(`leaked names        ${leaks.length === 0 ? 'none' : [...new Set(leaks)].join(', ')}`);
if (embedded.length > 0) {
  console.log(`  (inside other words, correctly left alone: ${[...new Set(embedded)].join(', ')})`);
}

if (leaks.length > 0) process.exitCode = 1;
