import { describe, expect, it } from 'vitest';
import { createPseudonymizer } from '../src/anonymize/anonymize';
import { parseChat } from '../src/parse/parse';
import { createVerificationContext, verifyFinding, verifySlideCopy } from '../src/report/verify';
import type { Finding, Slide } from '../src/report/schema';

/**
 * The false alarms.
 *
 * On the first real deck the verifier threw away ten of twenty-one slides,
 * seven of them for "carrying a phone number" that was the date something
 * happened, and three for "inventing" a figure that the planner had computed
 * for the slide next door. Every test here is one of those, kept from coming
 * back — and the two at the end are the new rejection, which is the register
 * of analysis.
 */

const CHAT = [
  '12/01/2023, 20:00 - Daniel: tomorrow we start seriously',
  '12/01/2023, 20:01 - Ron: you said that in november',
  '12/01/2023, 20:02 - Daniel: I work 10 to 16 so after that',
  '19/03/2023, 09:15 - Daniel: gym at 7 tomorrow, everyone in',
  '19/03/2023, 09:40 - Ron: im in',
].join('\n');

function context() {
  const parsed = parseChat(CHAT);
  const p = createPseudonymizer(parsed.participants);
  return { parsed, p, ctx: createVerificationContext(parsed, p) };
}

const slide = (over: Partial<Slide> = {}): Slide => ({
  id: 's1',
  type: 'stat',
  format: 'plain',
  title: 'A title',
  subtitle: '',
  body: 'A body.',
  quotes: [],
  people: ['Person A'],
  stats: [],
  scores: [],
  jokeScores: [],
  evidenceMessageIds: [],
  closer: '',
  confidence: 0.9,
  sensitivity: 'low',
  visualDirection: '',
  shareCaption: '',
  ...over,
});

const codes = (v: { issues: { code: string }[] }) => v.issues.map((i) => i.code);

describe('dates are not phone numbers', () => {
  it('lets a slide name the day something happened', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({
        body: 'On 2023-03-19 he said it again.',
        stats: [{ label: 'Date', value: '2023-03-19' }],
      }),
      ctx,
    );
    expect(codes(verdict)).not.toContain('sensitive-data');
    expect(verdict.action).toBe('include');
  });

  it('lets a finding name the days it rests on', () => {
    const { ctx } = context();
    const finding: Finding = {
      id: 'f1',
      kind: 'member_persona',
      claim: 'Person A vanished on 2023-01-12 and came back on 2023-03-19',
      detail: '',
      people: ['Person A'],
      evidenceMessageIds: [0, 3],
      quotes: [],
      confidence: 0.9,
      comedy: 0.5,
      recognition: 0.5,
      uniqueness: 0.5,
      sensitivity: 'low',
      suggestedTitle: '',
    };
    const verdict = verifyFinding(finding, ctx);
    expect(codes(verdict)).not.toContain('sensitive-data');
    expect(verdict.action).not.toBe('reject');
  });

  it('still catches a number somebody could ring', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide({ body: 'call him on 054-123-4567' }), ctx);
    expect(codes(verdict)).toContain('sensitive-data');
    expect(verdict.action).toBe('reject');
  });
});

describe('figures that were not invented', () => {
  it('allows a figure the planner wrote into a stat label', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({ body: 'In 2024-03 it peaked at 12.', stats: [{ label: '2024-03', value: 12 }] }),
      ctx,
    );
    expect(codes(verdict)).not.toContain('invented-number');
  });

  it('allows a figure computed for another slide of the same deck, and only then', () => {
    const { ctx } = context();
    const copy = slide({ body: 'Then came the 352 messages.' });

    expect(codes(verifySlideCopy(copy, ctx))).toContain('invented-number');
    expect(codes(verifySlideCopy(copy, ctx, [], { figures: [352] }))).not.toContain(
      'invented-number',
    );
  });

  it('allows a number the person themselves typed', () => {
    const { ctx } = context();
    const copy = slide({ body: 'Works 10 to 16, apparently.' });

    // Through the slide's own evidence…
    expect(codes(verifySlideCopy({ ...copy, evidenceMessageIds: [2] }, ctx))).not.toContain(
      'invented-number',
    );
    // …or through the spread of their lines the writer was shown.
    expect(
      codes(verifySlideCopy(copy, ctx, [], { texts: ['I work 10 to 16 so after that'] })),
    ).not.toContain('invented-number');
    // And not otherwise.
    expect(codes(verifySlideCopy(copy, ctx))).toContain('invented-number');
  });
});

describe('the register of analysis', () => {
  it('rejects a slide that talks like software describing people', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide({ body: 'The data shows he replies fast.' }), ctx);
    expect(codes(verdict)).toContain('generic-phrasing');
    expect(verdict.action).toBe('reject');
  });

  it('rejects it in Hebrew too, where word boundaries do not exist', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide({ body: 'הנתונים מראים שהוא עונה מהר.' }), ctx);
    expect(codes(verdict)).toContain('generic-phrasing');
    expect(verdict.action).toBe('reject');

    const card = verifySlideCopy(slide({ body: 'מעניין לציין שבכל קבוצה יש אחד כזה.' }), ctx);
    expect(card.action).toBe('reject');
  });

  it('leaves a slide alone for merely containing the word "data"', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide({ body: 'He asked for the data plan password. Twice.' }), ctx);
    expect(codes(verdict)).not.toContain('generic-phrasing');
  });
});
