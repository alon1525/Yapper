/**
 * Validates a premium report against the real schema and completes the name
 * round trip, exactly as the browser does after paying.
 *
 *   npx vite-node scripts/premium-restore.ts -- <mapping.json> <report.json>
 *
 * The surviving-token assertion matters more here than it does for the free
 * preview: a report carries a card per person, so there are far more places a
 * token can sit in a field the restorer does not walk.
 */

import { readFileSync } from 'node:fs';
import { createPseudonymizer, restoreDeep } from '@wrapped/core';
import { PremiumSchema } from '../apps/web/lib/premiumPrompt';

const [mappingPath, reportPath] = process.argv.slice(2);
if (!mappingPath || !reportPath) {
  throw new Error('usage: premium-restore.ts <mapping.json> <report.json>');
}

const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as Record<string, string>;
const parsed = PremiumSchema.safeParse(JSON.parse(readFileSync(reportPath, 'utf8')));

if (!parsed.success) {
  console.error('SCHEMA INVALID — the route would have returned 502:');
  console.error(parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

const p = createPseudonymizer(Object.values(mapping));
const report = restoreDeep(parsed.data, p);

for (const memory of report.memories) {
  console.log(`\n## ${memory.title}`);
  console.log(memory.story);
  if (memory.quote) console.log(`   “${memory.quote}”`);
}

console.log(`\n\n=== THE CAST (${report.characters.length}) ===`);
for (const c of report.characters) {
  console.log(`\n${c.sender} — ${c.title}`);
  console.log(c.description);
  console.log(`  “${c.catchphrase}”`);
  console.log(`  ${c.verdict}`);
}

console.log('\n\n=== AWARDS ===');
for (const a of report.awards) console.log(`\n${a.name}\n  ${a.winner} — ${a.reason}`);

console.log('\n\n=== YEARS ===');
for (const e of report.eras) console.log(`${e.year}  ${e.title} — ${e.summary}`);

console.log(`\n\n${report.narrative}`);

const survivors = JSON.stringify(report).match(/Person [A-Z]+/g) ?? [];
const expected = Object.keys(mapping);

// One card per person is the contract the slides rely on; a short report would
// silently drop people from the deck rather than fail.
const cardsMatchPeople = report.characters.length === expected.length;

/**
 * Order is the failure nothing else catches. `character.sender` is positional —
 * the schema cannot express "same order as the people I gave you", so a model
 * that returns all eighteen cards shuffled produces eighteen schema-valid,
 * confidently wrong profiles, each attached to the wrong name after restore.
 * This is the one assertion that distinguishes a good report from a plausible
 * one, so it is checked before restoring rather than by reading the output.
 */
const actualOrder = parsed.data.characters.map((c) => c.sender);
const misplaced = actualOrder.filter((sender, i) => sender !== expected[i]);

console.log(`\n---`);
console.log(`schema             valid`);
console.log(`cards / people     ${report.characters.length} / ${expected.length}${cardsMatchPeople ? '' : '  ← MISMATCH'}`);
console.log(`card order         ${misplaced.length === 0 ? 'matches the people list' : `${misplaced.length} out of place ← WRONG PEOPLE`}`);
console.log(`unrestored tokens  ${survivors.length === 0 ? 'none' : survivors.join(', ')}`);
console.log(`awards to distinct ${new Set(report.awards.map((a) => a.winner)).size} / ${report.awards.length}`);

if (survivors.length > 0 || !cardsMatchPeople || misplaced.length > 0) process.exitCode = 1;
