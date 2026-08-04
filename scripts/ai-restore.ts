/**
 * The second half of the round trip: takes a model reply written entirely in
 * `Person A` tokens and puts the real names back, exactly as the browser does.
 *
 *   npx vite-node scripts/ai-restore.ts -- <mapping.json> <reply.json>
 *
 * The assertion at the end is the point. `restoreDeep` walks every string field
 * of the reply, and a token that survives means it sat somewhere the walk does
 * not reach — which reads as a bug to the user, on the slide, in their language.
 * Eyeballing Hebrew output would not reveal it.
 */

import { readFileSync } from 'node:fs';
import { createPseudonymizer, restoreDeep } from '@wrapped/core';
import { PreviewSchema } from '../apps/web/lib/aiPrompt';

const [mappingPath, replyPath] = process.argv.slice(2);
if (!mappingPath || !replyPath) {
  throw new Error('usage: ai-restore.ts <mapping.json> <reply.json>');
}

const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as Record<string, string>;
const raw = JSON.parse(readFileSync(replyPath, 'utf8')) as unknown;

// The same validation the route applies before anything reaches the slide.
const parsed = PreviewSchema.safeParse(raw);
if (!parsed.success) {
  console.error('SCHEMA INVALID — the route would have returned 502:');
  console.error(parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

// Rebuilt from the participant order, which is how the browser rebuilds it too.
const p = createPseudonymizer(Object.values(mapping));
const restored = restoreDeep(parsed.data, p);

const survivors = JSON.stringify(restored).match(/Person [A-Z]+/g) ?? [];

for (const memory of restored.memories) {
  console.log(`\n## ${memory.title}`);
  console.log(memory.story);
  console.log(`cast: ${memory.cast.join(', ')}`);
}
console.log(`\n## ${restored.award.name}`);
console.log(`${restored.award.winner} — ${restored.award.reason}`);
console.log(`\n## narrative\n${restored.narrative}`);
console.log(`\nschema             valid`);
console.log(`unrestored tokens  ${survivors.length === 0 ? 'none' : survivors.join(', ')}`);

if (survivors.length > 0) process.exitCode = 1;
