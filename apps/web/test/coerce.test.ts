import { describe, expect, it } from 'vitest';
import { WrittenDeckSchema, normalizeWrittenDeck } from '@wrapped/core';
import { coerceToSchema } from '../lib/coerce';

/**
 * The run this was written for.
 *
 * A real deck came back from the writer, was paid for, and was thrown away —
 * twice, on different fields each time. Nothing in it was untrue; it was
 * over-budget. These are the exact violations from that trace:
 *
 *   slides.0.format      invented a fourteenth format
 *   slides.1.quotes.*.date   carried a time as well as a day
 *   slides.5.quotes.0.text   was empty
 *   slides.12.stats          had more than six entries
 *   dictionary.*.quotes      had more than two
 *
 * Every one is a layout budget rather than a claim about the chat, so every one
 * should now cost its own tail and nothing else.
 */

const quote = (text: string, date = '2024-03-05') => ({
  messageId: 12,
  speaker: 'Person A',
  text,
  date,
});

const slide = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  type: 'custom_discovery',
  format: 'plain',
  title: 'A title',
  ...over,
});

function build(over: Record<string, unknown> = {}) {
  return { slides: [slide(over)], dictionary: [] };
}

const run = (raw: unknown) => coerceToSchema(WrittenDeckSchema, normalizeWrittenDeck(raw));

describe('a deck that is over budget still ships', () => {
  it('takes the costume off a format that does not exist', () => {
    const result = run(build({ format: 'group_chat_receipt' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.format).toBe('plain');
  });

  it('cuts a date at the day rather than at the field width', () => {
    // Truncating to the schema's 12 characters would leave "2024-03-05 1",
    // which then fails verification and loses the quote.
    const result = run(build({ quotes: [quote('hello', '2024-03-05 14:22:31')] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.quotes[0]!.date).toBe('2024-03-05');
  });

  it('drops a quote with nothing in it, and keeps the rest of the slide', () => {
    const result = run(build({ quotes: [quote(''), quote('a real line')] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.quotes).toHaveLength(1);
    expect(result.value.slides[0]!.quotes[0]!.text).toBe('a real line');
  });

  it('keeps the first six stats and discards the seventh', () => {
    const stats = Array.from({ length: 9 }, (_, i) => ({ label: `stat ${i}`, value: i }));
    const result = run(build({ stats }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.stats).toHaveLength(6);
    expect(result.value.slides[0]!.stats[0]!.label).toBe('stat 0');
  });

  it('trims prose that ran past the card', () => {
    const result = run(build({ body: 'x'.repeat(900) }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.body).toHaveLength(700);
  });

  it('holds a dictionary entry to two quotes', () => {
    const result = run({
      slides: [slide()],
      dictionary: [
        {
          phrase: 'the bit',
          definition: 'a definition',
          quotes: [quote('one'), quote('two'), quote('three'), quote('four')],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dictionary[0]!.quotes).toHaveLength(2);
  });

  it('drops many empty quotes in one pass, not one per round', () => {
    // One drop per round put a ceiling on how badly the writer could misbehave
    // before the deck was discarded anyway — six empties used to exhaust it.
    const empties = Array.from({ length: 4 }, () => quote(''));
    const result = run({
      slides: [
        slide({ quotes: [...empties, quote('kept one')] }),
        slide({ id: 's2', quotes: [quote(''), quote(''), quote('kept two')] }),
      ],
      dictionary: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.quotes.map((q) => q.text)).toEqual(['kept one']);
    expect(result.value.slides[1]!.quotes.map((q) => q.text)).toEqual(['kept two']);
  });

  it('removes the right elements when several go from one array', () => {
    // Splicing low-to-high would shift the survivors under the later indices and
    // delete the wrong quotes. This is the assertion that catches that.
    const result = run(
      build({
        quotes: [quote('first'), quote(''), quote('second'), quote('')],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slides[0]!.quotes.map((q) => q.text)).toEqual(['first', 'second']);
  });

  it('handles every violation from the trace at once, and says it did', () => {
    const result = run({
      slides: [
        slide({ format: 'meme_format', quotes: [quote('kept', '2024-03-05 14:22')] }),
        slide({
          id: 's2',
          quotes: [quote(''), quote('survivor')],
          stats: Array.from({ length: 8 }, (_, i) => ({ label: `s${i}`, value: i })),
        }),
      ],
      dictionary: [{ phrase: 'p', definition: 'd', quotes: [quote('1'), quote('2'), quote('3')] }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coerced).toBe(true);
    expect(result.value.slides).toHaveLength(2);
    expect(result.value.slides[0]!.format).toBe('plain');
    expect(result.value.slides[0]!.quotes[0]!.date).toBe('2024-03-05');
    expect(result.value.slides[1]!.quotes).toHaveLength(1);
    expect(result.value.slides[1]!.stats).toHaveLength(6);
    expect(result.value.dictionary[0]!.quotes).toHaveLength(2);
  });
});

describe('what it will not do', () => {
  it('says so when the reply is wrong in a way trimming cannot fix', () => {
    // A missing title is not a budget. Inventing one would put words on a slide
    // that no model wrote and no reader asked for, so this still fails.
    const result = coerceToSchema(WrittenDeckSchema, {
      slides: [{ id: 's1', type: 'custom_discovery', format: 'plain' }],
      dictionary: [],
    });

    expect(result.ok).toBe(false);
  });

  it('leaves a reply that already fits completely alone', () => {
    const raw = build({ body: 'short', quotes: [quote('fine')] });
    const result = run(structuredClone(raw));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coerced).toBe(false);
    expect(result.value.slides[0]!.body).toBe('short');
  });

  it('does not mutate the caller\'s object', () => {
    const raw = build({ stats: Array.from({ length: 9 }, (_, i) => ({ label: `s${i}`, value: i })) });
    coerceToSchema(WrittenDeckSchema, raw);

    expect((raw.slides[0] as unknown as { stats: unknown[] }).stats).toHaveLength(9);
  });
});
