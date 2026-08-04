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
import { buildPremiumPayload } from '../apps/web/lib/premiumPayload';
import { PREMIUM_SYSTEM, premiumPrompt } from '../apps/web/lib/premiumPrompt';

const [exportPath, outDir = 'dry-run'] = process.argv.slice(2);
if (!exportPath) throw new Error('usage: ai-dry-run.ts <export.txt> [outDir]');

const text = readFileSync(exportPath, 'utf8');
const parsed = parseChat(text);
const stats = computeStats(parsed, { fileName: exportPath });
const moments = findCandidateMoments(parsed);
const { payload, pseudonymizer } = buildPreviewPayload({
  parsed,
  stats,
  moments,
  fileName: exportPath,
});

const prompt = userPrompt(payload);

// The paid payload is a different shape with strictly more surface: eighteen
// per-person digests, each carrying a vocabulary list and a quoted message.
// Distinctive words are the likeliest leak in the product — a nickname used by
// exactly one person is precisely what "words this person uses more than
// anyone else" is built to find — so it is gated by the same check.
const premium = buildPremiumPayload({ parsed, stats, moments, fileName: exportPath });
const premiumText = premiumPrompt(premium.payload);

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
const paid = scan(`${premiumText}\n${JSON.stringify(premium.payload)}`);
const leaks = [...free.leaks, ...paid.leaks];
const embedded = [...free.embedded, ...paid.embedded];

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'payload.json'), JSON.stringify(payload, null, 2), 'utf8');
writeFileSync(join(outDir, 'prompt.txt'), `${SYSTEM}\n\n===== USER =====\n\n${prompt}`, 'utf8');
writeFileSync(
  join(outDir, 'premium-payload.json'),
  JSON.stringify(premium.payload, null, 2),
  'utf8',
);
writeFileSync(
  join(outDir, 'premium-prompt.txt'),
  `${PREMIUM_SYSTEM}\n\n===== USER =====\n\n${premiumText}`,
  'utf8',
);
writeFileSync(
  join(outDir, 'mapping.json'),
  JSON.stringify(Object.fromEntries(pseudonymizer.reverse), null, 2),
  'utf8',
);

const promptChars = SYSTEM.length + prompt.length;
const premiumChars = PREMIUM_SYSTEM.length + premiumText.length;
console.log(`participants        ${parsed.participants.length}`);
console.log(`messages            ${stats.totalMessages}`);
console.log(`language            ${payload.language}`);
console.log(`span                ${stats.span.label}`);
console.log(`moments in payload  ${payload.moments.length}`);
console.log(`excerpt messages    ${payload.moments.reduce((n, m) => n + m.messages.length, 0)}`);
console.log(`prompt characters   ${promptChars} (free) · ${premiumChars} (premium)`);
console.log(`premium people      ${premium.payload.people.length}`);
console.log(`premium moments     ${premium.payload.moments.length}`);
console.log(`premium eras        ${premium.payload.eras.length}`);
console.log(`leaked names        ${leaks.length === 0 ? 'none' : [...new Set(leaks)].join(', ')}`);
if (embedded.length > 0) {
  console.log(`  (inside other words, correctly left alone: ${[...new Set(embedded)].join(', ')})`);
}

if (leaks.length > 0) process.exitCode = 1;
