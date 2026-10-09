import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import {
  detectLanguage,
  minWordLength,
  stopwordsFor,
  wordSegmenterFor,
} from '../src/lang/language';
import { countWords, extractWords } from '../src/stats/text';

/**
 * Japanese does not put spaces between words, which is the whole of the
 * problem: every tokeniser in this package was written for a language that
 * does, and handed a Japanese chat it returns whole clauses and calls them
 * words. These are the tests for the seam.
 */

/* Long enough to clear the fifty-character floor `detectLanguage` uses before
   it will call a language at all — four one-line messages are not evidence. */
const JA_LINES = [
  '12/01/2023, 09:05 - 中村: 今日は寿司を食べたけど本当においしかった',
  '12/01/2023, 09:06 - 田中: いいな、私も寿司が食べたいと思っていたところ',
  '12/01/2023, 09:07 - 中村: 明日も寿司にしようかな、あの店は最高だった',
  '15/01/2023, 23:47 - 田中: 寿司の店を予約しておくね、七時でいいですか',
].join('\n');

describe('a Japanese chat', () => {
  it('is detected as Japanese rather than as "other"', () => {
    expect(detectLanguage(parseChat(JA_LINES).messages)).toBe('ja');
  });

  it('is still detected when the group swears in English half the time', () => {
    const mixed = [
      '12/01/2023, 09:05 - 中村: 今日は寿司を食べたんだけど最高だった lol',
      '12/01/2023, 09:06 - 田中: マジでうらやましい、写真送って nice',
      '12/01/2023, 09:07 - 中村: 明日もあの店に行こうと思ってる yes',
      '12/01/2023, 09:08 - 田中: 寿司の店を予約しておくね ok thanks',
      '12/01/2023, 09:09 - 中村: 助かる、七時くらいでお願いします',
    ].join('\n');
    expect(detectLanguage(parseChat(mixed).messages)).toBe('ja');
  });

  it('does not mistake an English chat for Japanese', () => {
    const en = [
      '12/01/2023, 09:05 - Alon: good morning everyone',
      '12/01/2023, 09:06 - Sarah: why are you awake at this hour',
      '12/01/2023, 09:07 - Alon: I could ask you the same thing',
    ].join('\n');
    expect(detectLanguage(parseChat(en).messages)).toBe('en');
  });

  it('breaks a sentence into words instead of returning the sentence', () => {
    const segmenter = wordSegmenterFor('ja');
    const words = extractWords(
      '今日は寿司を食べた',
      stopwordsFor('ja'),
      minWordLength('ja'),
      segmenter,
    );
    // Without a segmenter this is one nine-character "word" — which is how the
    // vocabulary slide ended up showing whole clauses, each with a count of one.
    expect(words.length).toBeGreaterThan(1);
    expect(words).toContain('寿司');
    // は and を are particles, not vocabulary.
    expect(words).not.toContain('は');
    expect(words).not.toContain('を');
  });

  it('counts the words in a message rather than the sentences', () => {
    const segmenter = wordSegmenterFor('ja');
    expect(countWords('今日は寿司を食べた')).toBe(1);
    expect(countWords('今日は寿司を食べた', segmenter)).toBeGreaterThan(3);
  });

  it('finds the word the group actually repeats', () => {
    const segmenter = wordSegmenterFor('ja');
    const counts = new Map<string, number>();
    for (const m of parseChat(JA_LINES).messages) {
      for (const w of extractWords(m.body, stopwordsFor('ja'), minWordLength('ja'), segmenter)) {
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
    expect(counts.get('寿司')).toBe(4);
  });

  it('leaves every other language on the regex path', () => {
    expect(wordSegmenterFor('en')).toBeNull();
    expect(wordSegmenterFor('he')).toBeNull();
    expect(extractWords('the quick brown fox', stopwordsFor('en'), 3)).toEqual([
      'quick',
      'brown',
      'fox',
    ]);
  });
});
