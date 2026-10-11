import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { findCandidateMoments } from '../src/moments/moments';
import { isSubstantive, looksPasted, pickVoiceSamples, substanceOf } from '../src/stats/samples';

/**
 * The material the paid report is written from.
 *
 * Every case here is one the real 25,812-message export actually produced. The
 * old payload sent 360 messages of which 42% were `<image>` placeholders and
 * bare `חחחח`, and gave each character card one "longest message" that turned
 * out three times in four to be something the person had forwarded rather than
 * written. Both failures generate cleanly, validate cleanly, and produce a
 * report that reads like a horoscope — so they can only be caught here.
 */

/** Builds an Android-format export from compact `[day, time, sender, body]`. */
function build(rows: [string, string, string, string][]): string {
  return rows.map(([d, t, s, b]) => `${d}, ${t} - ${s}: ${b}`).join('\n');
}

describe('what counts as something somebody said', () => {
  it('does not count laughter as content', () => {
    expect(substanceOf('חחחחחחחח')).toBe(0);
    expect(substanceOf('hahahaha')).toBe(0);
    expect(substanceOf('😂😂😂')).toBe(0);
    expect(substanceOf('lmao')).toBe(0);
  });

  it('keeps the words attached to the laughter', () => {
    // The window scorer rewards laughs, so `חחח לגמרי` is the exact shape that
    // scored highest and said least. The reply is still a reply.
    expect(substanceOf('חחחח לגמרי')).toBe(5);
  });

  it('rejects media placeholders and one-word reflexes', () => {
    const parsed = parseChat(
      build([
        ['12/01/2023', '09:00', 'Alon', 'image omitted'],
        ['12/01/2023', '09:01', 'Alon', 'ok'],
        ['12/01/2023', '09:02', 'Alon', 'בא לי משהו מתוק'],
      ]),
    );
    const [media, oneWord, real] = parsed.messages;
    expect(isSubstantive(media!)).toBe(false);
    expect(isSubstantive(oneWord!)).toBe(false);
    expect(isSubstantive(real!)).toBe(true);
  });
});

describe('the forwarded-chain-letter problem', () => {
  it('rejects a bulleted list however long', () => {
    expect(
      looksPasted(['ציוד אישי:', '• בגד ים', '• מים 3 ליטר', '• קרם הגנה', '• נעליים'].join('\n')),
    ).toBe(true);
  });

  it('keeps a long rant, which is the most characteristic thing anyone sends', () => {
    // One breath, no line breaks. This is a person; the packing list above is
    // not, and length alone cannot tell them apart.
    expect(looksPasted('bla '.repeat(150))).toBe(false);
  });

  it('rejects a long multi-paragraph forward', () => {
    const forward = ['שלום, שמי מושיק וולף', '', 'אני מצטער שאני עומד לחפור אבל זה קריטי.', '', 'x'.repeat(450)].join('\n');
    expect(looksPasted(forward)).toBe(true);
  });
});

describe('a spread of somebody in their own words', () => {
  const rows: [string, string, string, string][] = [];
  for (let i = 0; i < 60; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    rows.push([`${day}/01/2023`, '09:00', 'Alon', `ordinary message number ${i}`]);
    rows.push([`${day}/01/2023`, '09:01', 'Sarah', `also talking here ${i}`]);
  }
  // One line that made the other person laugh, late in the history so an even
  // spread alone would be unlikely to reach it.
  rows.push(['28/01/2023', '10:00', 'Alon', 'I am surrounded by pussies']);
  rows.push(['28/01/2023', '10:01', 'Sarah', 'חחחחחחחח']);
  const parsed = parseChat(build(rows));

  it('gives every speaker their own lines, capped', () => {
    const samples = pickVoiceSamples(parsed, { perPerson: 10 });
    expect(samples.get('Alon')).toHaveLength(10);
    expect(samples.get('Sarah')).toHaveLength(10);
    for (const m of samples.get('Alon') ?? []) expect(m.sender).toBe('Alon');
  });

  it('reaches the line that landed, not just an even stride', () => {
    const bodies = (pickVoiceSamples(parsed, { perPerson: 10 }).get('Alon') ?? []).map((m) => m.body);
    expect(bodies).toContain('I am surrounded by pussies');
  });

  it('does not credit somebody for laughing at themselves', () => {
    const parsedSelf = parseChat(
      build([
        ['12/01/2023', '09:00', 'Alon', 'here is my brilliant observation'],
        ['12/01/2023', '09:01', 'Alon', 'חחחחחחחח'],
      ]),
    );
    // Nothing to assert about ordering with one candidate; the point is that a
    // self-laugh does not make it a highlight, so the run stays deterministic.
    const samples = pickVoiceSamples(parsedSelf, { perPerson: 5 });
    expect(samples.get('Alon')).toHaveLength(1);
  });

  it('is deterministic — two identical exports must produce one prompt', () => {
    const a = pickVoiceSamples(parsed, { perPerson: 8 }).get('Alon')?.map((m) => m.id);
    const b = pickVoiceSamples(parsed, { perPerson: 8 }).get('Alon')?.map((m) => m.id);
    expect(a).toEqual(b);
  });
});

describe('the readable-text floor on candidate moments', () => {
  /* Six stickers and one word — the shape that scored highest on the real
     export, because laughter and density are exactly what a sticker produces. */
  const stickerStorm = build([
    ['12/01/2023', '20:00', 'Alon', 'sticker omitted'],
    ['12/01/2023', '20:00', 'Sarah', 'sticker omitted'],
    ['12/01/2023', '20:01', 'Alon', 'sticker omitted'],
    ['12/01/2023', '20:01', 'Sarah', 'חחחחח'],
    ['12/01/2023', '20:02', 'Alon', 'sticker omitted'],
    ['12/01/2023', '20:02', 'Sarah', 'sticker omitted'],
    ['12/01/2023', '20:03', 'Alon', 'lol'],
  ]);

  it('still ranks it when no floor is asked for', () => {
    // The free preview and the detective rank against these scores, so the
    // default must not move under them.
    expect(findCandidateMoments(parseChat(stickerStorm))).toHaveLength(1);
  });

  it('drops it once the paid report asks for readable text', () => {
    expect(
      findCandidateMoments(parseChat(stickerStorm), { minReadableShare: 0.5 }),
    ).toHaveLength(0);
  });

  it('keeps a window where people actually spoke', () => {
    const conversation = build([
      ['12/01/2023', '20:00', 'Alon', 'so are we doing this or not'],
      ['12/01/2023', '20:00', 'Sarah', 'you said you were bringing the cake'],
      ['12/01/2023', '20:01', 'Alon', 'I said I would think about the cake'],
      ['12/01/2023', '20:01', 'Sarah', 'that is not what you said at all'],
      ['12/01/2023', '20:02', 'Alon', 'sticker omitted'],
      ['12/01/2023', '20:02', 'Sarah', 'I am cancelling the whole evening'],
    ]);
    expect(
      findCandidateMoments(parseChat(conversation), { minReadableShare: 0.5 }),
    ).toHaveLength(1);
  });
});
