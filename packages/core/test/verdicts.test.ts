import { describe, expect, it } from 'vitest';
import { dedupeVerdicts } from '../src/report/verify';

/**
 * A model given permission to invent impossible ratings finds two it likes and
 * puts both on every card. These check the cap that thins them.
 */

const card = (id: string, ...values: string[]) => ({
  id,
  jokeScores: values.map((value, i) => ({ label: `thing ${i}`, value })),
});

describe('dedupeVerdicts', () => {
  it('lets a value appear on two cards and drops it from the third', () => {
    const out = dedupeVerdicts([
      card('a', '∞/100', '0/100', '7'),
      card('b', '∞/100', '1.7', '99/100'),
      card('c', '∞/100', '117/100', '0/100', 'no'),
    ]);

    expect(out[0]!.jokeScores.map((v) => v.value)).toEqual(['∞/100', '0/100', '7']);
    expect(out[1]!.jokeScores.map((v) => v.value)).toEqual(['∞/100', '1.7', '99/100']);
    expect(out[2]!.jokeScores.map((v) => v.value)).toEqual(['117/100', '0/100', 'no']);
  });

  it('never strips a card below two ratings', () => {
    const out = dedupeVerdicts([
      card('a', '∞/100', '117/100'),
      card('b', '∞/100', '117/100'),
      card('c', '∞/100', '117/100'),
    ]);
    expect(out[2]!.jokeScores).toHaveLength(2);
  });

  it('treats spacing and case as the same value', () => {
    const out = dedupeVerdicts([card('a', '100 / 100'), card('b', '100/100'), card('c', '100/100', 'x', 'y')]);
    expect(out[2]!.jokeScores.map((v) => v.value)).toEqual(['x', 'y']);
  });

  it('returns the same object when nothing changed', () => {
    const only = card('a', '0/100');
    expect(dedupeVerdicts([only])[0]).toBe(only);
  });
});
