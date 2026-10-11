import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DiscoverySchema, WrittenDeckSchema } from '@wrapped/core';
import { PreviewSchema } from '../lib/aiPrompt';
import { PremiumSchema } from '../lib/premiumPrompt';

/**
 * The door that has to stay shut.
 *
 * Every stage sends its schema with `strict: true`, which is what makes a
 * structured reply structured — without it the host takes the schema as advice
 * and a writer inventing a fourteenth slide format draws no complaint until zod
 * sees it, one paid call later.
 *
 * Strict mode has one requirement that is easy to break by accident: every
 * property must be listed in `required`. A single `.optional()` anywhere in a
 * stage's schema makes the host reject the whole request with a 400, and it
 * does so at the stage that carries that field and nowhere else — so the way
 * this breaks in production is one route failing while the other three are
 * fine, which reads like anything except a schema change.
 *
 * `.default()` is the shape to reach for instead: after parsing, a defaulted
 * field is always present, so zod lists it as required and the host is happy.
 *
 * This test costs nothing and runs offline. It caught the field that was
 * already wrong, and it is here so the next one never reaches a deployment.
 */

const STAGES: [string, z.ZodType][] = [
  ['preview', PreviewSchema],
  ['detective', DiscoverySchema],
  ['write', WrittenDeckSchema],
  ['premium', PremiumSchema],
];

interface Fault {
  where: string;
  problem: string;
}

/** Every object in the document, `$defs` included, that strict mode would reject. */
function faults(node: unknown, path: string, found: Fault[] = []): Fault[] {
  if (node === null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    node.forEach((item, i) => faults(item, `${path}[${i}]`, found));
    return found;
  }

  const record = node as Record<string, unknown>;
  const properties = record.properties;

  if (properties && typeof properties === 'object') {
    const keys = Object.keys(properties);
    const required = new Set(Array.isArray(record.required) ? (record.required as string[]) : []);
    const missing = keys.filter((key) => !required.has(key));

    if (missing.length > 0) {
      found.push({
        where: path || '(root)',
        problem: `optional, so strict mode rejects the request: ${missing.join(', ')}`,
      });
    }
    if (record.additionalProperties !== false) {
      found.push({ where: path || '(root)', problem: 'additionalProperties is not false' });
    }
  }

  for (const [key, value] of Object.entries(record)) {
    faults(value, path ? `${path}.${key}` : key, found);
  }
  return found;
}

describe('every stage schema survives strict mode', () => {
  for (const [stage, schema] of STAGES) {
    it(`${stage} has no optional properties`, () => {
      const json = z.toJSONSchema(schema, { io: 'output', target: 'draft-2020-12' });
      const problems = faults(json, '');

      expect(
        problems.map((f) => `${f.where}: ${f.problem}`),
        `Use .default(...) rather than .optional() — see the note at the top of this file.`,
      ).toEqual([]);
    });
  }
});
