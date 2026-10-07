import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { inferGenders } from '../src/stats/gender';

/**
 * The writer never sees a name, and Hebrew conjugates for gender. These check
 * that the gender is read off how people write about themselves, that a thin
 * or split signal yields no answer rather than a wrong one, and that a chat in
 * another language yields nothing at all.
 */

const CHAT = [
  '12/01/2023, 20:00 - דנה: אני יכולה להגיע בשמונה',
  '12/01/2023, 20:01 - יואב: אני לא יכול היום',
  '12/01/2023, 20:02 - דנה: אני באה עם עוגה',
  '12/01/2023, 20:03 - יואב: אני מגיע מאוחר',
  '12/01/2023, 20:04 - דנה: אני חושבת שזה יהיה כיף',
  '12/01/2023, 20:05 - יואב: אני כבר בדרך',
  '12/01/2023, 20:06 - יואב: אני עייף אבל אני בא',
  '12/01/2023, 20:07 - נועה: אני יכולה',
  '12/01/2023, 20:08 - שחר: אני יכול',
  '12/01/2023, 20:09 - שחר: אני יכולה',
  '12/01/2023, 20:10 - שחר: אני בא',
  '12/01/2023, 20:11 - שחר: אני באה',
  // רוני never says anything about herself; the others do.
  '12/01/2023, 20:12 - רוני: ok',
  '12/01/2023, 20:13 - דנה: רוני את באה?',
  '12/01/2023, 20:14 - יואב: רוני אמרה שהיא מאחרת',
  '12/01/2023, 20:15 - דנה: רוני, תגידי אם לקנות לך',
].join('\n');

describe('inferGenders', () => {
  const genders = inferGenders(parseChat(CHAT));

  it('reads the gender off first-person predicates', () => {
    expect(genders.get('דנה')).toBe('f');
    expect(genders.get('יואב')).toBe('m');
  });

  it('says nothing about somebody with too few lines to tell', () => {
    expect(genders.has('נועה')).toBe(false);
  });

  it('reads it off how the others address somebody who rarely speaks', () => {
    expect(genders.get('רוני')).toBe('f');
  });

  it('says nothing when the signal is split', () => {
    expect(genders.has('שחר')).toBe(false);
  });

  it('finds nothing in a chat that is not Hebrew', () => {
    const english = parseChat(
      [
        '12/01/2023, 20:00 - Ann: I can make it at eight',
        '12/01/2023, 20:01 - Bo: I am tired but I am coming',
        '12/01/2023, 20:02 - Ann: I think it will be fun',
      ].join('\n'),
    );
    expect(inferGenders(english).size).toBe(0);
  });
});
