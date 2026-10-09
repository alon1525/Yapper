import { describe, expect, it } from 'vitest';
import { EN, type CopyKey } from '@/lib/copy/en';
import { DE } from '@/lib/copy/de';
import { ES } from '@/lib/copy/es';
import { FR } from '@/lib/copy/fr';
import { HE } from '@/lib/copy/he';
import { JA } from '@/lib/copy/ja';
import { PT } from '@/lib/copy/pt';
import { RU } from '@/lib/copy/ru';

/**
 * The eight tables against the one that defines them.
 *
 * A translation is checked against English in two ways the type system does
 * not. Every placeholder English fills has to be filled in the same sentence
 * in every other language — `{name}` dropped from a punchline is a punchline
 * about nobody, and `{n}` misspelled as `{N}` renders as a literal brace.
 * Hebrew is the exception for the hour: it writes a 24-hour clock, so it
 * takes `{h24}` where English takes `{h}`, and `hour()` supplies both.
 *
 * And every English key has to exist, because a key that is missing falls
 * back to English silently — a Spanish report with one English sentence on
 * the wall is exactly the bug the tables exist to prevent, and nothing else
 * would ever report it.
 */
const TABLES = { de: DE, es: ES, fr: FR, he: HE, ja: JA, pt: PT, ru: RU };

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(template: string): Set<string> {
  return new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]!));
}

/** `{h}` and `{h24}` are the same hour, offered twice. */
function normaliseHour(set: Set<string>): Set<string> {
  const out = new Set(set);
  if (out.has('h24')) {
    out.delete('h24');
    out.add('h');
  }
  return out;
}

const KEYS = Object.keys(EN) as CopyKey[];

describe.each(Object.entries(TABLES))('%s', (_code, table) => {
  it('has every key English has', () => {
    const missing = KEYS.filter((key) => !(key in table));
    expect(missing).toEqual([]);
  });

  it('has no key English does not', () => {
    const extra = Object.keys(table).filter((key) => !(key in EN));
    expect(extra).toEqual([]);
  });

  it('fills every placeholder the English sentence fills', () => {
    const wrong: string[] = [];
    for (const key of KEYS) {
      const translated = table[key];
      if (translated === undefined) continue;
      const want = normaliseHour(placeholders(EN[key]));
      const got = normaliseHour(placeholders(translated));
      if ([...want].some((p) => !got.has(p)) || [...got].some((p) => !want.has(p))) {
        wrong.push(`${key}: expected {${[...want].join(', ')}}, got {${[...got].join(', ')}}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('leaves no sentence empty', () => {
    const empty = KEYS.filter((key) => key in table && table[key]!.trim() === '');
    expect(empty).toEqual([]);
  });
});
