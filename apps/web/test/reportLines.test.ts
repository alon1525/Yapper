import { describe, expect, it } from 'vitest';
import {
  courtLines,
  orgLines,
  receiptLine,
  splitLabel,
  splitTitle,
  timelineLines,
} from '@/lib/reportLines';

describe('splitLabel', () => {
  it('reads a short label off the front of a line', () => {
    expect(splitLabel('Charge: delivering a lecture')).toEqual({
      label: 'Charge',
      value: 'delivering a lecture',
    });
  });

  it('treats a late colon as punctuation', () => {
    const line = 'He said the thing everyone had been waiting for: nothing';
    expect(splitLabel(line)).toEqual({ label: null, value: line });
  });

  it('drops a bullet before looking for the label', () => {
    expect(splitLabel('- Fixed: Liat now checks the train')).toEqual({
      label: 'Fixed',
      value: 'Liat now checks the train',
    });
  });

  it('does not mistake the colon inside a time for the separator', () => {
    expect(splitLabel("Tuesday, 18:02: someone's work schedule")).toEqual({
      label: 'Tuesday, 18:02',
      value: "someone's work schedule",
    });
    expect(splitLabel('at 23:51 everyone gave up')).toEqual({
      label: null,
      value: 'at 23:51 everyone gave up',
    });
  });
});

describe('splitTitle', () => {
  it('turns at a sentence break in the middle', () => {
    expect(splitTitle('Functional? Absolutely not.')).toEqual({
      head: 'Functional?',
      tail: 'Absolutely not.',
    });
  });

  it('falls back to the last word', () => {
    expect(splitTitle('Enough to convict everyone')).toEqual({
      head: 'Enough to convict',
      tail: 'everyone',
    });
  });

  it('takes two words when the last is too short to colour', () => {
    expect(splitTitle('The member who switched to read-only')).toEqual({
      head: 'The member who switched to',
      tail: 'read-only',
    });
    expect(splitTitle('Nobody wanted to go')).toEqual({ head: 'Nobody wanted', tail: 'to go' });
  });

  it('keeps a one-word title whole', () => {
    expect(splitTitle('Guilty.')).toEqual({ head: '', tail: 'Guilty.' });
  });

  it('ignores a break too close to either end', () => {
    expect(splitTitle('No. This is the one line that matters most of all')).toEqual({
      head: 'No. This is the one line that matters most of',
      tail: 'all',
    });
  });
});

describe('courtLines', () => {
  it('reads the four lines by position', () => {
    expect(
      courtLines(
        'Charge: lecturing an empty room.\nEvidence: twelve messages, nobody present.\nVerdict: guilty.\nSentence: to be replied to with “ok”.',
      ),
    ).toEqual({
      charge: { label: 'Charge', value: 'lecturing an empty room.' },
      evidence: { label: 'Evidence', value: 'twelve messages, nobody present.' },
      verdict: { label: 'Verdict', value: 'guilty.' },
      sentence: { label: 'Sentence', value: 'to be replied to with “ok”.' },
    });
  });

  it('degrades from the end', () => {
    expect(courtLines('אישום: משהו\nראיות: משהו אחר')).toEqual({
      charge: { label: 'אישום', value: 'משהו' },
      evidence: { label: 'ראיות', value: 'משהו אחר' },
      verdict: null,
      sentence: null,
    });
  });
});

describe('receiptLine', () => {
  it('reads a trailing quantity in its common spellings', () => {
    expect(receiptLine('Reaction videos × 212')).toEqual({ item: 'Reaction videos', qty: '212' });
    expect(receiptLine('Voice notes x3')).toEqual({ item: 'Voice notes', qty: '3' });
    expect(receiptLine('Screenshots — 48')).toEqual({ item: 'Screenshots', qty: '48' });
    expect(receiptLine('19 × “sorry, was editing”')).toEqual({
      item: '19 × “sorry, was editing”',
      qty: null,
    });
  });

  it('reads a labelled count', () => {
    expect(receiptLine('Apologies: 12')).toEqual({ item: 'Apologies', qty: '12' });
  });

  it('leaves a line without a quantity whole', () => {
    expect(receiptLine('Total: one friendship, invoiced.')).toEqual({
      item: 'Total: one friendship, invoiced.',
      qty: null,
    });
  });
});

describe('orgLines', () => {
  it('separates the rows from the closing line', () => {
    expect(orgLines('CEO: Alon\nHead of logistics: Liat\nNobody reports to anyone.')).toEqual({
      rows: [
        { role: 'CEO', name: 'Alon' },
        { role: 'Head of logistics', name: 'Liat' },
      ],
      closing: 'Nobody reports to anyone.',
    });
  });

  it('lets a role run long and a closing line carry a colon', () => {
    expect(
      orgLines(
        'Most likely to derail pizza into ancient deities: Sheham Gabay-Zar\nEveryone else: turned “what time?” into a debate, which took all afternoon.',
      ),
    ).toEqual({
      rows: [{ role: 'Most likely to derail pizza into ancient deities', name: 'Sheham Gabay-Zar' }],
      closing: 'Everyone else: turned “what time?” into a debate, which took all afternoon.',
    });
  });
});

describe('timelineLines', () => {
  it('keeps the date as the label', () => {
    expect(timelineLines('March 2023: the plan is announced\nthe plan is announced again')).toEqual([
      { date: 'March 2023', beat: 'the plan is announced' },
      { date: null, beat: 'the plan is announced again' },
    ]);
  });
});
