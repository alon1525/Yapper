import { describe, expect, it } from 'vitest';
import {
  DiscoverySchema,
  WrittenDeckSchema,
  analyzeCommitments,
  analyzeInteractions,
  analyzePhrases,
  computeStats,
  createPseudonymizer,
  createVerificationContext,
  findCandidateMoments,
  findStalledPlans,
  isDuplicate,
  parseChat,
  planDeck,
  restoreDeep,
  verifyFinding,
  verifySlideCopy,
  type Discovery,
  type Finding,
  type Slide,
} from '@wrapped/core';
import { buildDetectivePayload } from '@/lib/detectivePayload';
import { detectivePrompt } from '@/lib/detectivePrompt';
import { RequestSchema as DetectiveRequestSchema } from '@/lib/detectiveRequest';
import { excerptChars } from '@/lib/guard';
import { writerPrompt } from '@/lib/writerPrompt';

/**
 * The spine, end to end, with the two model calls replaced by fixtures.
 *
 * The point is not that a happy path works — it is that the stages between the
 * calls actually stop things. A model reply containing an invented quote and a
 * fabricated statistic goes in; a deck with neither comes out; and the fact that
 * something was dropped is recorded rather than swallowed.
 */

/*
  Each day is a real burst rather than two or three lines. An earlier version of
  this fixture had four-message days, which segment into sessions below the
  minimum — so `payload.conversations` came back empty and the loop that checks
  every excerpted id passed by iterating over nothing. The length assertions
  below exist so that cannot happen again silently.
*/
const CHAT = [
  '12/01/2023, 20:00 - Daniel: tomorrow we start seriously',
  '12/01/2023, 20:01 - Ron: you said that in november',
  '12/01/2023, 20:02 - Daniel: this time is different',
  '12/01/2023, 20:03 - Avi: hahaha',
  '12/01/2023, 20:04 - Ron: protein is not a personality',
  '12/01/2023, 20:05 - Daniel: I bought the good one this time',
  '12/01/2023, 20:06 - Avi: he did buy it',

  '19/02/2023, 09:15 - Daniel: gym at 7 tomorrow, everyone in',
  '19/02/2023, 09:16 - Ron: im in',
  '19/02/2023, 09:17 - Avi: im in',
  '19/02/2023, 09:18 - Daniel: finally',
  '19/02/2023, 09:19 - Ron: what time again',
  '19/02/2023, 09:20 - Daniel: seven',
  '19/02/2023, 22:10 - Daniel: actually lets move it to sunday',

  '03/03/2023, 08:00 - Daniel: tomorrow we start seriously, no excuses',
  '03/03/2023, 08:01 - Avi: we have heard this before',
  '03/03/2023, 08:02 - Ron: hahaha',
  '03/03/2023, 08:03 - Daniel: this time I mean it',
  '03/03/2023, 08:04 - Avi: you always mean it',
  '03/03/2023, 08:05 - Ron: that is the problem',

  '14/04/2023, 19:00 - Daniel: tomorrow we start seriously',
  '14/04/2023, 19:01 - Ron: incredible',
  '14/04/2023, 19:02 - Avi: four for four',
  '14/04/2023, 19:03 - Daniel: supportive as always',
  '14/04/2023, 19:04 - Ron: we are extremely supportive',
].join('\n');

function setup() {
  const parsed = parseChat(CHAT);
  const stats = computeStats(parsed);
  const moments = findCandidateMoments(parsed);
  const analysis = { parsed, stats, moments, fileName: 'chat.txt' };
  const p = createPseudonymizer(parsed.participants);
  return { analysis, parsed, stats, p, ctx: createVerificationContext(parsed, p) };
}

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'f1',
  kind: 'member_persona',
  claim: 'Person A schedules workouts he does not attend',
  detail: 'He restates the same intention across four months.',
  people: ['Person A'],
  evidenceMessageIds: [0, 4, 7, 9],
  quotes: [],
  confidence: 0.9,
  comedy: 0.85,
  recognition: 0.9,
  uniqueness: 0.8,
  sensitivity: 'low',
  suggestedTitle: '',
  ...over,
});

describe('the detective payload', () => {
  it('carries a resolvable message id for every excerpted line', () => {
    const { analysis, parsed } = setup();
    const { payload } = buildDetectivePayload(analysis);

    // Guards the loop below against passing by being empty.
    expect(payload.conversations.length).toBeGreaterThan(0);
    expect(payload.conversations.flatMap((c) => c.messages).length).toBeGreaterThan(0);

    for (const conversation of payload.conversations) {
      for (const message of conversation.messages) {
        // The id must point at the real message the excerpt was cut from, or
        // nothing downstream can be verified.
        expect(parsed.messages[message.id]).toBeDefined();
        expect(parsed.messages[message.id]!.id).toBe(message.id);
      }
    }
  });

  it('anonymises every sender it carries', () => {
    const { analysis } = setup();
    const { payload } = buildDetectivePayload(analysis);
    const serialised = JSON.stringify(payload);

    for (const name of ['Daniel', 'Ron', 'Avi']) {
      expect(serialised).not.toContain(name);
    }
    expect(serialised).toContain('Person A');
  });

  it('renders message ids into the prompt the model reads', () => {
    const { analysis } = setup();
    const { payload } = buildDetectivePayload(analysis);
    const prompt = detectivePrompt(payload);

    expect(prompt).toMatch(/^m\d+ \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] Person [A-Z]+:/m);
  });

  it('always fits the schema the route parses it with', () => {
    // The route's array bounds are applied in the builder, and this is the
    // check that they stay applied. The chat is built to overflow one of them:
    // twenty-five arrival announcements in one evening, against a ceiling of
    // twenty ids per repeated arrival. Before the bound was applied this was
    // "Malformed request." to a reader who had already paid.
    const evening = Array.from({ length: 25 }, (_, i) => {
      const minute = String(i * 2).padStart(2, '0');
      return `20/05/2023, 19:${minute} - Daniel: 5 min away`;
    });
    const parsed = parseChat([CHAT, ...evening].join('\n'));
    const stats = computeStats(parsed);
    const analysis = { parsed, stats, moments: findCandidateMoments(parsed), fileName: 'chat.txt' };
    const { payload } = buildDetectivePayload(analysis);

    const arrival = payload.commitments.repeatedArrivals[0];
    expect(arrival).toBeDefined();
    expect(arrival!.claims).toBeGreaterThan(20);

    const result = DetectiveRequestSchema.safeParse({ ...payload, token: 'x' });
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it('is counted by the request-size ceiling', () => {
    const { analysis } = setup();
    const { payload } = buildDetectivePayload(analysis);

    // A payload shape the ceiling does not know about is a route with no
    // ceiling at all — the per-field caps alone would let megabytes through.
    expect(excerptChars(payload)).toBeGreaterThan(0);
  });
});

describe('verification between the two model calls', () => {
  it('throws away a fabricated finding and keeps the real one', () => {
    const { ctx } = setup();

    const discovery: Discovery = DiscoverySchema.parse({
      groupIdentity: {
        summary: 'A gym group that schedules more than it trains',
        confidence: 0.9,
        evidenceMessageIds: [0, 4],
      },
      voice: { register: 'Blunt, short, heavy on sarcasm', roastTolerance: 0.8, darkHumour: false },
      findings: [
        finding({ id: 'real' }),
        finding({
          id: 'invented',
          quotes: [
            {
              messageId: 0,
              speaker: 'Person A',
              text: 'I have never missed a workout in my life',
              date: '2023-01-12',
            },
          ],
        }),
        finding({ id: 'unsupported', evidenceMessageIds: [0] }),
        finding({ id: 'ghost-ids', evidenceMessageIds: [900, 901] }),
      ],
    });

    const kept: { finding: Finding; strength: number }[] = [];
    const rejected: string[] = [];
    for (const f of discovery.findings) {
      const verdict = verifyFinding(f, ctx);
      if (verdict.action === 'reject') rejected.push(f.id);
      else kept.push({ finding: verdict.value, strength: verdict.strength });
    }

    expect(kept.map((k) => k.finding.id)).toEqual(['real']);
    expect(rejected).toEqual(['invented', 'unsupported', 'ghost-ids']);
  });

  it('plans a deck from what survived, and records what did not', () => {
    const { parsed, stats, p, ctx } = setup();
    const verified = [finding({ id: 'real' })]
      .map((f) => verifyFinding(f, ctx))
      .map((v) => ({ finding: v.value, strength: v.strength }));

    const plan = planDeck({
      stats,
      interactions: analyzeInteractions(parsed),
      commitments: analyzeCommitments(parsed, stats.language),
      phrases: analyzePhrases(parsed, stats.language),
      stalledPlans: findStalledPlans(parsed, stats.language),
      findings: verified,
      tokenOf: (name) => p.tokenFor(name),
    });

    expect(plan.briefs.some((b) => b.id === 'custom-real')).toBe(true);
    // A chat this small cannot support most statistic slides, and every one it
    // dropped must say why.
    expect(plan.suppressed.length).toBeGreaterThan(0);
    for (const note of plan.suppressed) expect(note.reason).toBeTruthy();
  });
});

describe('the writer is boxed in', () => {
  it('is told the only figures it may use', () => {
    const { parsed, stats, p } = setup();
    const plan = planDeck({
      stats,
      interactions: analyzeInteractions(parsed),
      commitments: analyzeCommitments(parsed, stats.language),
      phrases: analyzePhrases(parsed, stats.language),
      stalledPlans: findStalledPlans(parsed, stats.language),
      findings: [],
      tokenOf: (name) => p.tokenFor(name),
    });

    const prompt = writerPrompt({
      language: 'en',
      voice: { register: 'blunt', roastTolerance: 0.8, darkHumour: false },
      groupSummary: 'A gym group that schedules more than it trains',
      briefs: plan.briefs,
      evidence: {},
    });

    expect(prompt).toContain('the only figures you may use on this slide');
    // Every planned brief here happens to carry figures, so the other branch is
    // exercised directly rather than hoped for.
    expect(
      writerPrompt({
        language: 'en',
        voice: { register: 'blunt', roastTolerance: 0.8, darkHumour: false },
        groupSummary: 'x',
        briefs: [
          {
            id: 'bare',
            type: 'custom_discovery',
            format: 'plain',
            angle: 'a slide with nothing countable behind it',
            stats: [],
            scoreAxes: [],
            people: ['Person A'],
            evidenceMessageIds: [],
            findingIds: [],
            sensitivity: 'low',
            strength: 0.7,
            targetLength: 180,
          },
        ],
        evidence: {},
      }),
    ).toContain('no figures for this slide — do not introduce any.');
  });

  it('is handed the measurements as material, and the register it was asked for', () => {
    const { parsed, stats, p } = setup();
    const plan = planDeck({
      stats,
      interactions: analyzeInteractions(parsed),
      commitments: analyzeCommitments(parsed, stats.language),
      phrases: analyzePhrases(parsed, stats.language),
      stalledPlans: findStalledPlans(parsed, stats.language),
      findings: [],
      tokenOf: (name) => p.tokenFor(name),
    });
    const voice = { register: 'blunt', roastTolerance: 0.8, darkHumour: false };

    const roast = writerPrompt({
      language: 'en',
      brief: { language: 'en', kind: 'Friends group', tone: 'roast', notes: '' },
      voice,
      groupSummary: 'x',
      briefs: plan.briefs,
      evidence: {},
    });
    expect(roast).toContain('asked for the roast');
    // The axes are never asked for as bars any more.
    expect(roast).not.toContain('rename each one');

    const gentle = writerPrompt({
      language: 'en',
      brief: { language: 'en', kind: 'Family', tone: 'gentle', notes: '' },
      voice,
      groupSummary: 'x',
      briefs: plan.briefs,
      evidence: {},
    });
    expect(gentle).toContain('go easy');

    // A dossier asks for its official title in the field the card reads it from.
    const dossier = writerPrompt({
      language: 'en',
      voice,
      groupSummary: 'x',
      briefs: [
        {
          id: 'persona-person-a',
          type: 'persona',
          format: 'profile',
          angle: 'x',
          stats: [],
          scoreAxes: [{ key: 'volume', value: 97, meaning: 'sends far more than anyone' }],
          people: ['Person A'],
          evidenceMessageIds: [],
          findingIds: [],
          sensitivity: 'low',
          strength: 0.7,
          targetLength: 420,
        },
      ],
      evidence: {},
    });
    expect(dossier).toContain('`closer` is required here');
    expect(dossier).toContain('sends far more than anyone: 97/100');
  });

  it('rejects written copy that invented a statistic', () => {
    const { ctx } = setup();
    const written = WrittenDeckSchema.parse({
      slides: [
        {
          id: 'custom-real',
          type: 'custom_discovery',
          format: 'scientific_report',
          title: 'The fittest group that never trains',
          subtitle: '',
          // 1,740 was never supplied to it.
          body: 'After 1,740 gym mentions, the confirmed workout count remains 4.',
          quotes: [],
          people: ['Person A'],
          stats: [],
          evidenceMessageIds: [0, 4],
          confidence: 0.9,
          sensitivity: 'low',
          visualDirection: '',
          shareCaption: '',
        },
      ],
      dictionary: [],
    });

    // The planner's figures are what the slide is checked against, never the
    // writer's own — a writer that returned its own `stats` could otherwise
    // legitimise any number simply by listing it.
    const verdict = verifySlideCopy(
      { ...written.slides[0]!, stats: [{ label: 'Confirmed workouts', value: 4 }] },
      ctx,
    );

    expect(verdict.action).toBe('reject');
    expect(verdict.issues.map((i) => i.code)).toContain('invented-number');
  });

  it('accepts copy that interprets the figures it was given', () => {
    const { ctx, p } = setup();
    const slide: Slide = WrittenDeckSchema.parse({
      slides: [
        {
          id: 'custom-real',
          type: 'custom_discovery',
          format: 'plain',
          title: 'Four fresh starts, one gym',
          subtitle: '',
          body: 'Person A has begun taking this seriously 4 separate times. The gym has yet to be informed.',
          quotes: [
            {
              messageId: 0,
              speaker: p.tokenFor('Daniel'),
              text: 'tomorrow we start seriously',
              date: '2023-01-12',
            },
          ],
          people: ['Person A'],
          stats: [{ label: 'Fresh starts', value: 4 }],
          evidenceMessageIds: [0, 4, 7, 9],
          confidence: 0.9,
          sensitivity: 'low',
          visualDirection: '',
          shareCaption: '',
        },
      ],
      dictionary: [],
    }).slides[0]!;

    const verdict = verifySlideCopy(slide, ctx);
    expect(verdict.action).toBe('include');
    expect(verdict.value.quotes).toHaveLength(1);
  });

  it('drops a second slide that repeats the first', () => {
    const { ctx } = setup();
    const base = {
      type: 'custom_discovery' as const,
      format: 'plain' as const,
      subtitle: '',
      quotes: [],
      people: ['Person A'],
      stats: [],
      scores: [],
      jokeScores: [],
      evidenceMessageIds: [0, 4],
      closer: '',
      confidence: 0.9,
      sensitivity: 'low' as const,
      visualDirection: '',
      shareCaption: '',
    };
    const a: Slide = {
      ...base,
      id: 'a',
      title: 'Always starting tomorrow',
      body: 'Person A keeps announcing that tomorrow everything changes forever.',
    };
    const b: Slide = {
      ...base,
      id: 'b',
      title: 'Tomorrow, always',
      body: 'Person A keeps announcing that tomorrow everything changes forever again.',
    };

    const kept: Slide[] = [];
    for (const slide of [a, b]) {
      const verdict = verifySlideCopy(slide, ctx);
      if (verdict.action !== 'reject' && !kept.some((k) => isDuplicate(k, verdict.value))) {
        kept.push(verdict.value);
      }
    }

    expect(kept.map((s) => s.id)).toEqual(['a']);
  });
});

describe('names come back only in the browser', () => {
  it('restores tokens to real names after everything else has run', () => {
    const { p } = setup();
    const slide = {
      id: 's1',
      title: 'Person A starts again',
      quotes: [{ messageId: 0, speaker: 'Person A', text: 'x', date: '2023-01-12' }],
    };

    const restored = restoreDeep(slide, p);
    expect(restored.title).toBe('Daniel starts again');
    expect(restored.quotes[0]!.speaker).toBe('Daniel');
  });
});
