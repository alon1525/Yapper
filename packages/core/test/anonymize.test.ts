import { describe, expect, it } from 'vitest';
import {
  anonymizeMessages,
  createPseudonymizer,
  evidenceId,
  parseEvidenceId,
  restoreDeep,
  transcriptLine,
} from '../src/anonymize/anonymize';
import { parseChat } from '../src/parse/parse';

const people = ['Alon Cohen', 'Sarah Levi', 'Dave'];

describe('pseudonymizer', () => {
  it('assigns stable tokens in the order given', () => {
    const p = createPseudonymizer(people);
    expect(p.tokenFor('Alon Cohen')).toBe('Person A');
    expect(p.tokenFor('Sarah Levi')).toBe('Person B');
    expect(p.tokenFor('Dave')).toBe('Person C');
  });

  it('keeps labelling past 26 participants', () => {
    const many = Array.from({ length: 28 }, (_, i) => `User${i}`);
    const p = createPseudonymizer(many);
    expect(p.tokenFor('User25')).toBe('Person Z');
    expect(p.tokenFor('User26')).toBe('Person AA');
    expect(p.tokenFor('User27')).toBe('Person AB');
  });

  it('redacts names that appear inside message text, not just senders', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('Alon why did you do that')).toBe('Person A why did you do that');
    // A bare first name of a two-part display name must also be caught.
    expect(p.scrub('ask Sarah about it')).toBe('ask Person B about it');
  });

  it('consumes the longest name variant first', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('Alon Cohen is here')).toBe('Person A is here');
  });

  it('is case-insensitive but does not shred ordinary words', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('ALON!! and dave')).toBe('Person A!! and Person C');
    // "Dave" must not match inside another word.
    expect(p.scrub('we went to Davenport')).toBe('we went to Davenport');
  });

  it('redacts phone numbers and emails', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('call me on +972 54-123-4567')).toBe('call me on [phone]');
    expect(p.scrub('mail alon@example.com')).toBe('mail [email]');
  });

  it('keeps a link domain so recurring-link jokes survive', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('watch https://youtube.com/watch?v=secret123')).toBe(
      'watch [link:youtube.com]',
    );
  });

  it('leaves short number runs alone', () => {
    const p = createPseudonymizer(people);
    expect(p.scrub('be there at 8:30')).toBe('be there at 8:30');
  });
});

describe('restore', () => {
  it('maps tokens back to real names', () => {
    const p = createPseudonymizer(people);
    expect(p.restore('Person A somehow replied first every time')).toBe(
      'Alon Cohen somehow replied first every time',
    );
  });

  it('walks nested structures from a model reply', () => {
    const p = createPseudonymizer(people);
    const reply = {
      title: 'Person B strikes again',
      bullets: ['Person A said no', { note: 'and Person C agreed' }],
      score: 7,
    };
    expect(restoreDeep(reply, p)).toEqual({
      title: 'Sarah Levi strikes again',
      bullets: ['Alon Cohen said no', { note: 'and Dave agreed' }],
      score: 7,
    });
  });

  it('round-trips through scrub and restore', () => {
    const p = createPseudonymizer(people);
    const original = 'Alon Cohen told Dave that Sarah Levi was right';
    expect(p.restore(p.scrub(original))).toBe(original);
  });
});

describe('anonymizeMessages', () => {
  it('emits no real names anywhere in the payload', () => {
    const parsed = parseChat(
      [
        '12/01/2023, 09:00 - Alon Cohen: Sarah are you coming',
        '12/01/2023, 09:01 - Sarah Levi: ask Dave, my number is 054-123-4567',
        '15/01/2023, 09:02 - Dave: <Media omitted>',
      ].join('\n'),
    );
    const p = createPseudonymizer(parsed.participants);
    const payload = JSON.stringify(anonymizeMessages(parsed.messages, p));

    for (const name of ['Alon', 'Cohen', 'Sarah', 'Levi', 'Dave']) {
      expect(payload).not.toContain(name);
    }
    expect(payload).toContain('Person A');
    expect(payload).toContain('[phone]');
    expect(payload).toContain('<unknown>');
  });

  /*
    This assertion used to read `not.toContain('2023')` — the date was withheld
    on purpose, on the reasoning that a model needs pacing and not a calendar.

    Reversed deliberately. A dated report is most of what the product is for:
    "May 2023: everyone believed the trip was happening" is the nostalgia slide,
    and "the prophecy that aged badly" cannot be told without knowing when the
    prophecy was made and when it failed. Withholding the date did not prevent a
    model from writing those — it made it guess, and a confidently wrong date is
    worse than no date.

    The trade is small: the payload already carried the span label, the busiest
    day and a per-year breakdown, and the message *text* is far more identifying
    than the day it was sent on. What is still withheld is the thing that
    actually identifies someone — the name — and that has not changed.
  */
  it('carries the day and the time, so a memory can be dated', () => {
    const parsed = parseChat('12/01/2023, 23:47 - Alon: late one');
    const p = createPseudonymizer(parsed.participants);
    const [msg] = anonymizeMessages(parsed.messages, p);
    expect(msg!.time).toBe('23:47');
    expect(msg!.date).toBe('2023-01-12');
  });

  it('carries the message id, so a claim can be traced to a message', () => {
    const parsed = parseChat(
      ['12/01/2023, 23:47 - Alon: one', '12/01/2023, 23:48 - Sarah: two'].join('\n'),
    );
    const p = createPseudonymizer(parsed.participants);
    const out = anonymizeMessages(parsed.messages, p);

    // The id is the index into the real message array, which is what makes it
    // resolvable back to a body and a sender the model never saw.
    expect(out.map((m) => m.id)).toEqual([0, 1]);
    expect(parsed.messages[out[1]!.id]!.body).toBe('two');
  });

  it('round-trips an evidence id through its wire format', () => {
    expect(evidenceId(1234)).toBe('m1234');
    expect(parseEvidenceId('m1234')).toBe(1234);
    expect(parseEvidenceId(' m0 ')).toBe(0);
    // Anything a model might hallucinate instead of a citation.
    expect(parseEvidenceId('message 12')).toBeNull();
    expect(parseEvidenceId('m')).toBeNull();
    expect(parseEvidenceId('12')).toBeNull();
    expect(parseEvidenceId('m12x')).toBeNull();
  });

  it('renders a transcript line the writer can cite back', () => {
    const parsed = parseChat('12/01/2023, 23:47 - Alon: late one');
    const p = createPseudonymizer(parsed.participants);
    const [msg] = anonymizeMessages(parsed.messages, p);
    expect(transcriptLine(msg!)).toBe('m0 [2023-01-12 23:47] Person A: late one');
  });
});
