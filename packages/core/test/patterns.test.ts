import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { detectLanguage } from '../src/lang/language';
import { analyzePhrases, signatureWords } from '../src/patterns/phrases';
import { analyzeInteractions } from '../src/patterns/interactions';
import { analyzeCommitments, findStalledPlans } from '../src/patterns/commitments';
import { scoreRecall, segmentConversations } from '../src/sessions/sessions';
import {
  CONTAGION_GROUP,
  FIVE_MINUTES_GROUP,
  GYM_GROUP,
  MEDIA_GROUP,
  MONOLOGUE_GROUP,
  MULTILINGUAL_GROUP,
  PING_PONG_GROUP,
  QUIET_GROUP,
  SOMBRE_PEAK_GROUP,
  STALLED_PLAN_GROUP,
} from './groups';

const load = (text: string) => {
  const parsed = parseChat(text);
  return { parsed, language: detectLanguage(parsed.messages) };
};

describe('segmentConversations', () => {
  it('cuts a chat into sessions with stable, citable ids', () => {
    const { parsed, language } = load(GYM_GROUP);
    const sessions = segmentConversations(parsed, language);

    expect(sessions.length).toBeGreaterThan(1);
    for (const s of sessions) {
      // The id must resolve to the session's own first message, or a finding
      // that cites a conversation cannot be traced back to one.
      expect(s.id).toBe(`c${s.startId}`);
      expect(parsed.messages[s.startId]!.id).toBe(s.startId);
      expect(s.endId).toBeGreaterThanOrEqual(s.startId);
      expect(s.participants.length).toBeGreaterThan(0);
    }
  });

  it('does not read a condolence thread as either funny or a fight', () => {
    const { parsed, language } = load(SOMBRE_PEAK_GROUP);
    const sessions = segmentConversations(parsed, language);

    // The bereavement burst is by far the densest, longest and most
    // participated-in window in this chat — every automated signal points at it.
    const peak = [...sessions].sort((a, b) => b.messageCount - a.messageCount)[0]!;
    expect(peak.messageCount).toBeGreaterThanOrEqual(8);

    // It must not look like comedy, and it must not look like an argument.
    expect(peak.laughter).toBe(0);
    expect(peak.conflict).toBeLessThan(0.35);
    expect(peak.comedy).toBeLessThan(0.6);
  });

  it('adapts the session break to a chat that speaks four times a year', () => {
    const { parsed, language } = load(QUIET_GROUP);
    const sessions = segmentConversations(parsed, language, { minMessages: 1 });
    // Four messages months apart are four conversations, not one.
    expect(sessions.length).toBe(4);
  });

  it('scores recall from vocabulary that comes back later', () => {
    const { parsed, language } = load(GYM_GROUP);
    const scored = scoreRecall(segmentConversations(parsed, language), parsed);
    expect(scored.some((s) => s.recall > 0)).toBe(true);
  });
});

describe('analyzePhrases', () => {
  it('finds a phrase that escaped from one person to the whole group', () => {
    const { parsed, language } = load(CONTAGION_GROUP);
    const { contagions } = analyzePhrases(parsed, language, { minCount: 4 });

    const spread = contagions.find((c) => c.phrase.includes('בלגן'));
    expect(spread).toBeDefined();
    expect(spread!.patientZero).toBe('Gil');
    expect(spread!.adopters.map((a) => a.sender)).toEqual(
      expect.arrayContaining(['Dana', 'Ori']),
    );
    // Gil said it alone from January; Dana picked it up in May.
    expect(spread!.incubationDays).toBeGreaterThan(90);
  });

  it('does not call two people in one conversation a contagion', () => {
    // Everyone uses the phrase on the same day — that is a conversation.
    const parsed = parseChat(
      [
        '01/03/2023, 10:00 - A: same phrase here',
        '01/03/2023, 10:01 - B: same phrase here',
        '01/03/2023, 10:02 - C: same phrase here',
        '01/03/2023, 10:03 - A: same phrase here',
        '01/03/2023, 10:04 - B: same phrase here',
      ].join('\n'),
    );
    const { contagions } = analyzePhrases(parsed, 'en', { minCount: 3 });
    expect(contagions).toHaveLength(0);
  });

  it('attributes a signature phrase to its owner with citable uses', () => {
    const { parsed, language } = load(GYM_GROUP);
    const { signatures } = analyzePhrases(parsed, language, {
      minCount: 3,
      minSignatureUses: 3,
    });

    const sig = signatures.find((s) => s.phrase.includes('start seriously'));
    expect(sig).toBeDefined();
    expect(sig!.owner).toBe('Daniel');
    expect(sig!.ownership).toBe(1);
    for (const use of sig!.examples) {
      expect(parsed.messages[use.messageId]!.sender).toBe('Daniel');
    }
  });

  it('gives every signature word a real message to point at', () => {
    const { parsed, language } = load(GYM_GROUP);
    for (const word of signatureWords(parsed, language)) {
      for (const ex of word.examples) {
        const m = parsed.messages[ex.messageId]!;
        expect(m.sender).toBe(word.owner);
        expect(m.body.toLocaleLowerCase()).toContain(word.word);
      }
    }
  });

  it('survives a chat that mixes two scripts in one sentence', () => {
    const { parsed, language } = load(MULTILINGUAL_GROUP);
    expect(() => analyzePhrases(parsed, language, { minCount: 2 })).not.toThrow();
  });
});

describe('analyzeInteractions', () => {
  it('finds the pair who only talk to each other, not the two loudest', () => {
    const { parsed } = load(PING_PONG_GROUP);
    const { pingPong } = analyzeInteractions(parsed);

    expect(pingPong).not.toBeNull();
    expect([pingPong!.a, pingPong!.b].sort()).toEqual(['Rivka', 'Yossi']);
    expect(pingPong!.longestVolley).toBeGreaterThan(2);
  });

  it('measures conversation killing against how much someone talks', () => {
    const { parsed } = load(GYM_GROUP);
    const { killers } = analyzeInteractions(parsed, { conversationGapMs: 60 * 60 * 1000 });

    for (const k of killers) {
      expect(k.index).toBeGreaterThan(0);
      for (const ex of k.examples) {
        expect(parsed.messages[ex.messageId]!.sender).toBe(k.sender);
      }
    }
  });

  it('finds a monologue and how long it went unanswered', () => {
    const { parsed } = load(MONOLOGUE_GROUP);
    const { monologues } = analyzeInteractions(parsed);

    const run = monologues[0]!;
    expect(run.sender).toBe('Roi');
    expect(run.length).toBe(14);
    expect(parsed.messages[run.startId]!.sender).toBe('Roi');
    expect(parsed.messages[run.endId]!.sender).toBe('Roi');
    // Roi typed into the void at 02:10 and was answered at 09:30.
    expect(run.silenceAfterMinutes).toBeGreaterThan(400);
  });

  it('counts a name mentioned inside a message, including glued Hebrew prefixes', () => {
    const parsed = parseChat(
      [
        '01/03/2023, 10:00 - נדב: היי',
        '01/03/2023, 10:01 - רועי: אמרתי לנדב שזה בסדר',
        '01/03/2023, 10:02 - רועי: ונדב הסכים',
        // Must NOT count: נדב is not a word here, it is inside another one.
        '01/03/2023, 10:03 - רועי: מזתומרת',
      ].join('\n'),
    );
    const { mentionCounts } = analyzeInteractions(parsed);

    const row = mentionCounts.find((m) => m.by === 'רועי' && m.target === 'נדב');
    expect(row?.count).toBe(2);
  });
});

describe('analyzeCommitments', () => {
  it('catches the same person arriving four times in one evening', () => {
    const { parsed, language } = load(FIVE_MINUTES_GROUP);
    const { repeatedArrivals } = analyzeCommitments(parsed, language);

    const evening = repeatedArrivals.find((r) => r.day === '2023-07-07');
    expect(evening).toBeDefined();
    expect(evening!.sender).toBe('Eitan');
    expect(evening!.claims).toBe(4);
    for (const id of evening!.messageIds) {
      expect(parsed.messages[id]!.sender).toBe('Eitan');
    }
  });

  it('does not treat two arrivals a week apart as a contradiction', () => {
    const { parsed, language } = load(FIVE_MINUTES_GROUP);
    const { repeatedArrivals } = analyzeCommitments(parsed, language);
    // 7 July has four; 14 July has three. Neither day may be merged with the other.
    for (const r of repeatedArrivals) expect(r.spanMinutes).toBeLessThan(4 * 60);
  });

  it('rates commitments per hundred messages, not by raw count', () => {
    const { parsed, language } = load(FIVE_MINUTES_GROUP);
    const { people } = analyzeCommitments(parsed, language);
    const eitan = people.find((p) => p.sender === 'Eitan')!;
    expect(eitan.counts.arriving).toBeGreaterThanOrEqual(6);
    expect(eitan.rate).toBeGreaterThan(0);
  });

  it('classifies the recurring questions a group actually asks', () => {
    const { parsed, language } = load(MULTILINGUAL_GROUP);
    const { questions } = analyzeCommitments(parsed, language);
    expect(questions.map((q) => q.kind)).toEqual(
      expect.arrayContaining(['when', 'what_plan']),
    );
  });
});

describe('findStalledPlans', () => {
  it('finds a plan whose vocabulary never moved on', () => {
    const { parsed, language } = load(STALLED_PLAN_GROUP);
    const plans = findStalledPlans(parsed, language, { minMonths: 3 });

    expect(plans.length).toBeGreaterThan(0);
    const trip = plans[0]!;
    expect(trip.category).toBe('travel');
    expect(trip.months.length).toBeGreaterThanOrEqual(4);
    // Every cited message must mention one of the plan's own words, so the
    // receipts drawer shows the group actually discussing it.
    for (const id of trip.exampleMessageIds) {
      const body = parsed.messages[id]!.body.toLocaleLowerCase();
      expect(trip.topics.some((t) => body.includes(t))).toBe(true);
    }
  });

  it('reports one stalled plan, not one per word in it', () => {
    const { parsed, language } = load(STALLED_PLAN_GROUP);
    const plans = findStalledPlans(parsed, language, { minMonths: 3 });

    // "trip", "hotel", "booking" and "spreadsheet" are one holiday that never
    // happened. Four slides about it would be four ways of saying the same joke.
    expect(plans.filter((p) => p.category === 'travel')).toHaveLength(1);
    expect(plans[0]!.topics).toEqual(expect.arrayContaining(['trip', 'hotel']));
  });

  it('finds nothing in a chat with no plan at all', () => {
    const { parsed, language } = load(MONOLOGUE_GROUP);
    expect(findStalledPlans(parsed, language)).toHaveLength(0);
  });
});

describe('edited messages', () => {
  it('records the flag and keeps the marker out of the body', () => {
    const parsed = parseChat(MEDIA_GROUP);
    const edited = parsed.messages.find((m) => m.edited);

    expect(edited).toBeDefined();
    expect(edited!.body).toBe('I edited this one');
    expect(edited!.kind).toBe('text');
    // Everything else stays unflagged rather than carrying `edited: false`.
    expect(parsed.messages.filter((m) => m.edited)).toHaveLength(1);
  });

  it('still classifies an edited media message as media', () => {
    const parsed = parseChat('01/02/2023, 10:00 - Nir: <Media omitted> <This message was edited>');
    expect(parsed.messages[0]!.kind).toBe('attachment');
    expect(parsed.messages[0]!.edited).toBe(true);
  });
});
