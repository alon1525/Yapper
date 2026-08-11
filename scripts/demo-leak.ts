/**
 * Demonstrates the leak in the guard's own terms.
 *
 * Builds the deck plan exactly as `useReport.ts` does, then applies
 * `SENDER_TOKEN` — the regex `gatePaidRequest` uses to prove a payload is
 * anonymised — to every field of the outgoing request that carries a name.
 * The point is not that the regex fails. It is that it is never asked.
 */

import { readFileSync } from 'node:fs';
import {
  analyzeCommitments,
  analyzeInteractions,
  analyzePhrases,
  computeStats,
  findCandidateMoments,
  findStalledPlans,
  parseChat,
  planDeck,
} from '@wrapped/core';
import { buildDetectivePayload } from '../apps/web/lib/detectivePayload';
import { SENDER_TOKEN } from '../apps/web/lib/paidRoute';
import type { Brief } from '../apps/web/lib/brief';

const exportPath = process.argv[2]!;
const parsed = parseChat(readFileSync(exportPath, 'utf8'));
const stats = computeStats(parsed, { fileName: exportPath });
const brief: Brief = { language: 'he', kind: 'Friends group', notes: '', photos: {}, groupPhotos: {} };
const { pseudonymizer } = buildDetectivePayload(
  { parsed, stats, moments: findCandidateMoments(parsed), fileName: exportPath },
  brief,
);

const language = stats.language;
const plan = planDeck({
  stats,
  interactions: analyzeInteractions(parsed),
  commitments: analyzeCommitments(parsed, language),
  phrases: analyzePhrases(parsed, language),
  stalledPlans: findStalledPlans(parsed, language),
  findings: [],
  tokenOf: (name) => pseudonymizer.tokenFor(name),
});

const real = parsed.participants;
const hit = (s: string) => real.filter((n) => s.includes(n) || s.toLowerCase().includes(n.toLowerCase()));

console.log('SENDER_TOKEN =', SENDER_TOKEN.source);
console.log('');
console.log('--- fields the guard DOES check on /api/write ---');
let checked = 0;
for (const b of plan.briefs) for (const p of b.people) { checked++; if (!SENDER_TOKEN.test(p)) console.log('  FAIL', p); }
console.log(`  briefs[].people: ${checked} values, all token-shaped, all checked`);

console.log('');
console.log('--- fields the guard does NOT check on /api/write ---');
let leaked = 0;
for (const b of plan.briefs) {
  for (const s of b.stats) {
    const value = String(s.value);
    const names = hit(value);
    if (names.length > 0) {
      leaked++;
      console.log(`  briefs["${b.id}"].stats[].value = ${JSON.stringify(value)}`);
      console.log(`      contains real participant name(s): ${names.join(', ')}`);
      console.log(`      SENDER_TOKEN.test(...) = ${SENDER_TOKEN.test(value)}  <-- never called on this field`);
    }
  }
}
console.log('');
console.log(leaked === 0 ? 'no leak found' : `${leaked} stat value(s) carry a real name into the request body`);
