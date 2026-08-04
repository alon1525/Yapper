import { describe, expect, it } from 'vitest';
import { detectLanguage, isRtl, minWordLength, stopwordsFor } from '../src/lang/language';
import { parseChat } from '../src/parse/parse';
import { computeStats } from '../src/stats/stats';
import { countLaughter } from '../src/stats/text';

const build = (rows: [string, string][]) =>
  rows.map(([sender, body], i) => `13/01/2023, 10:${String(i).padStart(2, '0')} - ${sender}: ${body}`).join('\n');

describe('language detection', () => {
  it('detects a Hebrew conversation', () => {
    const raw = build(
      Array.from({ length: 30 }, (_, i) => ['אלון', `זאת הודעה מספר ${i} בקבוצה שלנו`] as [string, string]),
    );
    expect(detectLanguage(parseChat(raw).messages)).toBe('he');
  });

  it('detects an English conversation', () => {
    const raw = build(
      Array.from({ length: 30 }, (_, i) => ['Alon', `this is message number ${i} in our group`] as [string, string]),
    );
    expect(detectLanguage(parseChat(raw).messages)).toBe('en');
  });

  it('lays Hebrew out right-to-left and nothing else', () => {
    expect(isRtl('he')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('other')).toBe(false);
  });

  it('uses a shorter word floor for Hebrew', () => {
    expect(minWordLength('he')).toBe(2);
    expect(minWordLength('en')).toBe(3);
  });

  it('never filters with the wrong stopword list', () => {
    // An unknown language gets no filtering at all — deleting real content
    // words is worse than leaving function words in the ranking.
    expect(stopwordsFor('other').size).toBe(0);
    expect(stopwordsFor('he').has('אני')).toBe(true);
    expect(stopwordsFor('en').has('the')).toBe(true);
  });

  it('keeps Hebrew slang out of the stopword list', () => {
    // יאללה / סבבה / אחי are exactly the words whose frequency is funny.
    for (const slang of ['יאללה', 'סבבה', 'אחי', 'וואלה']) {
      expect(stopwordsFor('he').has(slang)).toBe(false);
    }
  });
});

describe('Hebrew word statistics', () => {
  it('filters Hebrew function words instead of English ones', () => {
    const raw = build([
      ['אלון', 'אני חושב שזה משחק ממש טוב'],
      ['שרה', 'גם אני חושבת שהמשחק טוב'],
      ['אלון', 'משחק משחק משחק'],
    ]);
    const s = computeStats(parseChat(raw));
    expect(s.language).toBe('he');
    const top = s.topWords.map((w) => w.value);
    expect(top[0]).toBe('משחק');
    // Hebrew pronouns must not win the ranking.
    expect(top).not.toContain('אני');
  });
});

describe('laughter', () => {
  it('recognises Hebrew laughter', () => {
    // Without this, candidate-moment scoring finds almost nothing in a Hebrew
    // chat, because laughter is the signal it leans on hardest.
    expect(countLaughter('חחחחח')).toBe(1);
    expect(countLaughter('ההההה')).toBe(1);
    expect(countLaughter('חח')).toBe(0);
  });

  it('still recognises English laughter', () => {
    expect(countLaughter('hahaha')).toBe(1);
    expect(countLaughter('lol that is great')).toBe(1);
    expect(countLaughter('😂😂')).toBe(2);
  });
});

describe('Hebrew anonymisation', () => {
  it('redacts names carrying a glued-on Hebrew preposition', async () => {
    const { createPseudonymizer } = await import('../src/anonymize/anonymize.js');
    const p = createPseudonymizer(['נדב', 'אלון']);
    // "to Nadav" / "and Nadav" — a plain letter-boundary rule reads these as
    // one word and leaks the name intact.
    expect(p.scrub('תגידו לנדב שהוא איחר')).toBe('תגידו לPerson A שהוא איחר');
    expect(p.scrub('ונדב לא הגיע')).toBe('וPerson A לא הגיע');
    expect(p.scrub('נדב הגיע')).toBe('Person A הגיע');
  });
});
