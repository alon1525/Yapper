import { describe, expect, it } from 'vitest';
import { createPseudonymizer } from '../src/anonymize/anonymize';
import { parseChat } from '../src/parse/parse';
import {
  createVerificationContext,
  isDuplicate,
  similarity,
  verifyDictionary,
  verifyFinding,
  verifySlideCopy,
} from '../src/report/verify';
import type { DictionaryEntry, Finding, Slide } from '../src/report/schema';

/**
 * These are the tests that matter most in the whole suite.
 *
 * Every other test here asks "did we compute the right number". These ask "can a
 * model put words in somebody's mouth and have them printed" — which is the one
 * failure that would make the product not worth shipping. They are written as
 * rejections first and acceptances second, on purpose: a verifier that accepts
 * everything passes every happy-path test ever written.
 */

/*
  Two days on purpose. A single-day chat cannot distinguish "rejected because the
  quote was invented" from "rejected because everything happened at once", and
  several rules below turn on the difference.
*/
const CHAT = [
  '12/01/2023, 20:00 - Daniel: tomorrow we start seriously',
  '12/01/2023, 20:01 - Ron: you said that in november',
  '12/01/2023, 20:02 - Daniel: this time is different',
  '12/01/2023, 20:03 - Avi: <Media omitted>',
  '19/03/2023, 09:15 - Daniel: gym at 7 tomorrow, everyone in',
  '19/03/2023, 09:40 - Ron: im in',
  '19/03/2023, 22:10 - Daniel: actually lets move it to sunday',
  '20/03/2023, 11:00 - Avi: call me on 054-123-4567',
].join('\n');

function context() {
  const parsed = parseChat(CHAT);
  const p = createPseudonymizer(parsed.participants);
  return { parsed, p, ctx: createVerificationContext(parsed, p) };
}

/** Ids: Daniel is the top talker, so `Person A`. Verified below rather than assumed. */
const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'f1',
  kind: 'member_persona',
  claim: 'Person A schedules workouts he does not attend',
  detail: '',
  people: ['Person A'],
  evidenceMessageIds: [0, 4, 6],
  quotes: [],
  confidence: 0.9,
  comedy: 0.8,
  recognition: 0.8,
  uniqueness: 0.8,
  sensitivity: 'low',
  suggestedTitle: '',
  ...over,
});

describe('verifyFinding — rejections', () => {
  it('rejects a quote nobody ever said', () => {
    const { ctx } = context();
    const verdict = verifyFinding(
      finding({
        quotes: [
          {
            messageId: 0,
            speaker: 'Person A',
            text: 'I have never missed a single workout in my life',
            date: '2023-01-12',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('quote-not-found');
    expect(verdict.strength).toBe(0);
  });

  it('rejects a finding whose evidence ids do not exist', () => {
    const { ctx } = context();
    const verdict = verifyFinding(finding({ evidenceMessageIds: [900, 901] }), ctx);

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('evidence-missing');
  });

  it('rejects a standing claim built from a single day', () => {
    const { ctx } = context();
    // Both messages are real, both are on 12 January. A persona is a pattern,
    // and one evening is not one.
    const verdict = verifyFinding(finding({ evidenceMessageIds: [0, 2] }), ctx);

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('single-occasion');
  });

  it('rejects a broad claim resting on one message', () => {
    const { ctx } = context();
    const verdict = verifyFinding(finding({ evidenceMessageIds: [0] }), ctx);

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('thin-evidence');
  });

  it('rejects a claim that cites only a system notice', () => {
    const parsed = parseChat(
      [
        '12/01/2023, 19:59 - Messages and calls are end-to-end encrypted.',
        '12/01/2023, 20:00 - Daniel: hi',
      ].join('\n'),
    );
    const p = createPseudonymizer(parsed.participants);
    const ctx = createVerificationContext(parsed, p);

    const verdict = verifyFinding(finding({ evidenceMessageIds: [0] }), ctx);
    expect(verdict.action).toBe('reject');
  });

  it('rejects a finding carrying a phone number', () => {
    const { ctx } = context();
    const verdict = verifyFinding(
      finding({ claim: 'Person C keeps giving out 054-123-4567 to strangers' }),
      ctx,
    );

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('sensitive-data');
  });

  it('rejects an inferred diagnosis, however funnily phrased', () => {
    const { ctx } = context();
    for (const claim of [
      'Person A is clearly depressed about the gym',
      'Person A is secretly religious',
      'Person A suffers from chronic optimism',
    ]) {
      const verdict = verifyFinding(finding({ claim }), ctx);
      expect(verdict.action, claim).toBe('reject');
      expect(verdict.issues.map((i) => i.code), claim).toContain('off-limits');
    }
  });

  it('rejects a claim about somebody who is not in the chat', () => {
    const { ctx } = context();
    const verdict = verifyFinding(finding({ people: ['Person Z'] }), ctx);
    expect(verdict.issues.map((i) => i.code)).toContain('unknown-person');
    expect(verdict.value.people).not.toContain('Person Z');
  });
});

describe('verifyFinding — acceptance and repair', () => {
  it('accepts a real quote, and reports who really said it', () => {
    const { ctx, p, parsed } = context();
    const daniel = p.tokenFor('Daniel');

    const verdict = verifyFinding(
      finding({
        quotes: [
          {
            messageId: 0,
            speaker: daniel,
            text: 'tomorrow we start seriously',
            date: '2023-01-12',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.action).toBe('include');
    expect(verdict.value.quotes[0]!.speaker).toBe(daniel);
    expect(parsed.messages[verdict.value.quotes[0]!.messageId]!.body).toBe(
      'tomorrow we start seriously',
    );
  });

  it('repairs a quote credited to the wrong speaker rather than dropping it', () => {
    const { ctx, p } = context();
    const ron = p.tokenFor('Ron');

    const verdict = verifyFinding(
      finding({
        // Ron said this, not Daniel.
        quotes: [
          {
            messageId: 1,
            speaker: p.tokenFor('Daniel'),
            text: 'you said that in november',
            date: '2023-01-12',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.action).toBe('rewrite');
    expect(verdict.issues.map((i) => i.code)).toContain('quote-wrong-speaker');
    expect(verdict.value.quotes[0]!.speaker).toBe(ron);
  });

  it('repairs a quote pinned one message off, and corrects its date', () => {
    const { ctx } = context();
    const verdict = verifyFinding(
      finding({
        quotes: [
          {
            messageId: 5, // really m4
            speaker: 'Person A',
            text: 'gym at 7 tomorrow',
            date: '2020-01-01',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.action).toBe('rewrite');
    expect(verdict.value.quotes[0]!.messageId).toBe(4);
    expect(verdict.value.quotes[0]!.date).toBe('2023-03-19');
  });

  it('does not launder a fabricated quote by searching the whole chat', () => {
    const { ctx } = context();
    // The words exist in the chat — at m0, far outside the repair radius of the
    // cited m7. Repair is for clerical slips, not for retrieval.
    const verdict = verifyFinding(
      finding({
        evidenceMessageIds: [4, 6],
        quotes: [
          {
            messageId: 40,
            speaker: 'Person A',
            text: 'tomorrow we start seriously',
            date: '2023-01-12',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.action).toBe('reject');
  });

  it('lets a single-occasion claim through when the slide is about that occasion', () => {
    const { ctx } = context();
    const verdict = verifyFinding(
      finding({ kind: 'legendary_moment', evidenceMessageIds: [0, 1, 2] }),
      ctx,
    );

    // A legendary moment is *supposed* to be one night.
    expect(verdict.action).not.toBe('reject');
  });

  it('scores a well-supported finding above a barely-supported one', () => {
    const { ctx } = context();
    const thin = verifyFinding(finding({ evidenceMessageIds: [0, 4] }), ctx);
    const thick = verifyFinding(finding({ evidenceMessageIds: [0, 1, 2, 4, 5, 6] }), ctx);

    expect(thick.strength).toBeGreaterThan(thin.strength);
  });
});

describe('invented ratings', () => {
  it('lets a joke score be impossible without calling it a fabricated figure', () => {
    // The whole point of the field. `∞/100` and `-14/100` are not claims about
    // the chat, and running the statistics rule over them rejected the deck for
    // doing the one thing it was asked to do.
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({
        format: 'profile',
        body: 'The only man here who can lose an argument he started with himself.',
        jokeScores: [
          { label: 'Ability to escalate', value: '∞/100' },
          { label: 'Restraint', value: '0/100' },
          { label: 'Collective braincell', value: '1.7' },
          { label: 'Communicating efficiently', value: '-14/100' },
        ],
      }),
      ctx,
    );

    expect(verdict.action).not.toBe('reject');
    expect(verdict.issues.map((i) => i.code)).not.toContain('invented-number');
    expect(verdict.value.jokeScores).toHaveLength(4);
  });

  it('still polices what a label says about somebody', () => {
    // A rating is prose on a card. Formatting a protected trait as a score is
    // not a loophole, and this is the assertion that keeps it from becoming one.
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({ format: 'profile', jokeScores: [{ label: 'Person A is depressed', value: '100' }] }),
      ctx,
    );

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('off-limits');
  });
});

const slide = (over: Partial<Slide> = {}): Slide => ({
  id: 's1',
  type: 'custom_discovery',
  format: 'plain',
  title: 'The fittest group that never trains',
  subtitle: '',
  body: 'Seven workouts survived contact with a calendar.',
  quotes: [],
  people: ['Person A'],
  stats: [{ label: 'Workouts', value: 7 }],
  scores: [],
  jokeScores: [],
  evidenceMessageIds: [0, 4],
  confidence: 0.9,
  sensitivity: 'low',
  visualDirection: '',
  shareCaption: '',
  ...over,
});

describe('verifySlideCopy', () => {
  it('rejects a number the writer invented', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({ body: '1,740 gym mentions and seven completed workouts.' }),
      ctx,
    );

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('invented-number');
  });

  it('allows a number that was supplied as a statistic', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({
        body: 'Estimated completed group workouts: 7. Gym mentions: 1740.',
        stats: [
          { label: 'Workouts', value: 7 },
          { label: 'Gym mentions', value: 1740 },
        ],
      }),
      ctx,
    );

    expect(verdict.issues.map((i) => i.code)).not.toContain('invented-number');
  });

  it('allows a number the group themselves said', () => {
    const { ctx, p } = context();
    const verdict = verifySlideCopy(
      slide({
        body: 'The 7am start time did not survive the week.',
        quotes: [
          {
            messageId: 4,
            speaker: p.tokenFor('Daniel'),
            text: 'gym at 7 tomorrow, everyone in',
            date: '2023-03-19',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.issues.map((i) => i.code)).not.toContain('invented-number');
  });

  it('flags greeting-card phrasing', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      slide({ body: 'Every group chat has one, and he is the glue that holds it together.' }),
      ctx,
    );

    expect(verdict.issues.map((i) => i.code)).toContain('generic-phrasing');
    expect(verdict.action).toBe('rewrite');
  });

  it('flags copy that will not fit the slide', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide({ body: 'x'.repeat(500) }), ctx);
    expect(verdict.issues.map((i) => i.code)).toContain('too-long');
  });

  it('drops a quote the writer retyped incorrectly', () => {
    const { ctx, p } = context();
    const verdict = verifySlideCopy(
      slide({
        quotes: [
          {
            messageId: 0,
            speaker: p.tokenFor('Daniel'),
            text: 'tomorrow we begin seriously',
            date: '2023-01-12',
          },
        ],
      }),
      ctx,
    );

    expect(verdict.value.quotes).toHaveLength(0);
    expect(verdict.issues.map((i) => i.code)).toContain('quote-not-found');
  });

  it('passes clean copy', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(slide(), ctx);
    expect(verdict.action).toBe('include');
    expect(verdict.issues).toHaveLength(0);
  });
});

describe('verifyDictionary', () => {
  const entry = (over: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
    phrase: 'tomorrow we start seriously',
    partOfSpeech: 'phrase',
    definition: 'A declaration of intent with no observed relationship to events.',
    origin: 'First recorded January 2023.',
    quotes: [],
    confidence: 0.9,
    evidenceMessageIds: [0],
    ...over,
  });

  it('keeps an entry for a phrase the group actually said', () => {
    const { ctx } = context();
    const { kept, rejected } = verifyDictionary([entry()], ctx);

    expect(rejected).toHaveLength(0);
    expect(kept[0]!.phrase).toBe('tomorrow we start seriously');
  });

  it('rejects an entry for a phrase nobody ever used', () => {
    const { ctx } = context();
    // The definition may be invention — that is what a joke dictionary is. The
    // phrase may not be, or it is not their dictionary.
    const { kept, rejected } = verifyDictionary([entry({ phrase: 'the sacred protocol' })], ctx);

    expect(kept).toHaveLength(0);
    expect(rejected[0]!.issues.map((i) => i.code)).toContain('quote-not-found');
  });

  it('rejects an entry whose evidence id does not exist', () => {
    const { ctx } = context();
    const { kept } = verifyDictionary([entry({ evidenceMessageIds: [900] })], ctx);
    expect(kept).toHaveLength(0);
  });

  it('drops an unverifiable quote but keeps the entry', () => {
    const { ctx, p } = context();
    const { kept } = verifyDictionary(
      [
        entry({
          quotes: [
            { messageId: 0, speaker: p.tokenFor('Daniel'), text: 'never said this', date: '2023-01-12' },
          ],
        }),
      ],
      ctx,
    );

    expect(kept).toHaveLength(1);
    expect(kept[0]!.quotes).toHaveLength(0);
  });
});

describe('isDuplicate', () => {
  it('catches two slides making the same point about the same person', () => {
    const a = slide({ id: 'a', type: 'persona', body: 'Person A never replies to anything at all' });
    const b = slide({ id: 'b', type: 'persona', body: 'Person A replies to nothing, ever, at all' });
    expect(isDuplicate(a, b)).toBe(true);
  });

  it('leaves genuinely different slides alone', () => {
    const a = slide({ id: 'a', title: 'The ghost', body: 'Person A vanished for eight months.' });
    const b = slide({
      id: 'b',
      title: 'Peak chaos',
      body: 'One Tuesday produced more noise than the preceding quarter.',
      people: ['Person B'],
    });
    expect(isDuplicate(a, b)).toBe(false);
  });
});

/**
 * Score bars.
 *
 * The dossier is the one slide where a model hands back something shaped like a
 * statistic, so it is the one place the "never let it invent a number" rule
 * could quietly stop holding. The value is computed in `scores.ts` and the
 * writer only renames the axis — these tests are that sentence, enforced.
 */
describe('verifySlideCopy · scores', () => {
  const AXES = [
    { key: 'putting_it_off', value: 97, meaning: 'says "later" more than anyone else' },
    { key: 'volume', value: 40, meaning: 'sends a large share of this chat' },
  ];

  const dossier = (scores: Slide['scores']): Slide =>
    slide({ format: 'profile', body: 'Most likely to be the reason it moved.', scores });

  it('keeps a renamed axis that still carries its own number', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([{ key: 'putting_it_off', label: 'Deferral addiction', value: 97 }]),
      ctx,
      AXES,
    );

    expect(verdict.action).toBe('include');
    expect(verdict.value.scores).toEqual([
      { key: 'putting_it_off', label: 'Deferral addiction', value: 97 },
    ]);
  });

  it('drops a bar whose number moved', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([{ key: 'putting_it_off', label: 'Deferral addiction', value: 12 }]),
      ctx,
      AXES,
    );

    expect(verdict.issues.map((i) => i.code)).toContain('rescored-axis');
    expect(verdict.value.scores).toHaveLength(0);
  });

  it('drops a bar citing an axis this slide was never given', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([{ key: 'charisma', label: 'Charisma', value: 99 }]),
      ctx,
      AXES,
    );

    expect(verdict.issues.map((i) => i.code)).toContain('unknown-axis');
    expect(verdict.value.scores).toHaveLength(0);
  });

  it('keeps the honest bars on a card that also has a dishonest one', () => {
    // A dossier is five bars. One bad label should cost that bar, not the card —
    // the other four are still measurements of a real person.
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([
        { key: 'putting_it_off', label: 'Deferral addiction', value: 97 },
        { key: 'volume', label: 'Yap', value: 88 },
      ]),
      ctx,
      AXES,
    );

    expect(verdict.action).not.toBe('reject');
    expect(verdict.value.scores.map((s) => s.key)).toEqual(['putting_it_off']);
  });

  it('does not let a bar smuggle an unlisted figure into the prose', () => {
    // The scores array is not a back door: a number is still only permitted in
    // the copy if a stat or an axis actually carries it.
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([{ key: 'volume', label: 'Yap', value: 40 }]),
      ctx,
      AXES,
    );
    expect(verdict.action).toBe('include');

    const invented = verifySlideCopy(
      slide({ format: 'profile', body: 'Sent 5,120 messages about nothing.', scores: [] }),
      ctx,
      AXES,
    );
    expect(invented.issues.map((i) => i.code)).toContain('invented-number');
  });

  it('rejects a bar when the slide was briefed with no axes at all', () => {
    const { ctx } = context();
    const verdict = verifySlideCopy(
      dossier([{ key: 'volume', label: 'Yap', value: 40 }]),
      ctx,
    );

    expect(verdict.issues.map((i) => i.code)).toContain('unknown-axis');
    expect(verdict.value.scores).toHaveLength(0);
  });
});

describe('isDuplicate · dossiers', () => {
  const dossier = (token: string, body: string): Slide =>
    slide({ id: `p-${token}`, type: 'persona', format: 'profile', title: token, people: [token], body });

  it('does not mistake two people for one because both titles say "most likely to"', () => {
    // Measured before names are restored, so every card carries `person` — and
    // the official title's form adds `most` and `likely` to all of them. Three
    // shared words out of four clears the text threshold, and the second person
    // loses their card with nothing on screen to explain it.
    const a = dossier('Person A', 'Most likely to survive.');
    const b = dossier('Person B', 'Most likely to vanish.');

    expect(similarity(a, b)).toBeGreaterThan(0.45);
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('still calls two cards about the same person a duplicate', () => {
    expect(
      isDuplicate(dossier('Person A', 'Most likely to survive.'), dossier('Person A', 'Most likely to vanish.')),
    ).toBe(true);
  });
});
