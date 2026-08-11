import { describe, expect, it } from 'vitest';
import { demoReport } from '../lib/demoReport';
import { PremiumSchema } from '../lib/premiumPrompt';
import type { PremiumPayload, PersonDigest } from '../lib/premiumPayload';

/**
 * The demo report has to satisfy the same schema a model's does, because the
 * deck renders both through the same components. It failed that on the first
 * real chat it met: no scoreable bursts meant no memories at all, and a group
 * whose members had identical figures collapsed eight awards into one. Both
 * passed a typecheck and returned a body the client accepted, which is why
 * these are tests rather than a comment.
 */

function person(i: number, over: Partial<PersonDigest> = {}): PersonDigest {
  return {
    sender: `Person ${String.fromCharCode(65 + i)}`,
    share: 0.1,
    messages: 100,
    nightShare: 0.02,
    medianResponseMinutes: 2,
    longestSilenceDays: 10,
    stillGone: false,
    consistency: 0.4,
    laughsPerMessage: 0.1,
    topEmoji: ['😂'],
    distinctiveWords: ['תכלס'],
    meanLength: 25,
    questionShare: 0.1,
    oneWordShare: 0.1,
    longestMessage: null,
    ...over,
  };
}

function payload(over: Partial<PremiumPayload> = {}): PremiumPayload {
  return {
    language: 'he',
    participantCount: 4,
    fingerprint: { totalMessages: 400, spanLabel: 'Mar 2024', participantCount: 4 },
    digest: {
      totalMessages: 400,
      spanLabel: 'Mar 2024',
      perDay: 10,
      activeDays: 40,
      topEmoji: [{ value: '😂', count: 30 }],
      busiestDay: { day: '2024-03-04', count: 60 },
      longestStreakDays: 6,
      longestSilenceDays: 9,
    },
    people: [0, 1, 2, 3].map((i) => person(i)),
    eras: [{ year: 2024, messages: 400, busiestMonth: '2024-03' }],
    moments: [],
    ...over,
  };
}

describe('demoReport', () => {
  it('satisfies the schema with no moments at all', () => {
    // A quiet chat produces no scoreable bursts, and the schema still wants
    // four memories. This returned zero.
    const result = PremiumSchema.safeParse(demoReport(payload()));
    expect(result.success).toBe(true);
  });

  it('satisfies the schema when every person has identical figures', () => {
    // Every superlative then points at the same person, and deduplicating
    // winners left a single award.
    const result = PremiumSchema.safeParse(demoReport(payload()));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.awards.length).toBeGreaterThanOrEqual(4);
  });

  it('prefers distinct winners when the people actually differ', () => {
    const people = [
      person(0, { share: 0.5 }),
      person(1, { nightShare: 0.9 }),
      person(2, { longestSilenceDays: 900, stillGone: true }),
      person(3, { meanLength: 300 }),
    ];
    const report = demoReport(payload({ people, participantCount: 4 }));
    expect(new Set(report.awards.map((a) => a.winner)).size).toBeGreaterThanOrEqual(4);
  });

  it('writes one card per person, in the order given', () => {
    const report = demoReport(payload());
    expect(report.characters.map((c) => c.sender)).toEqual([
      'Person A',
      'Person B',
      'Person C',
      'Person D',
    ]);
  });

  it('holds up for a two-person chat', () => {
    const people = [person(0), person(1)];
    const result = PremiumSchema.safeParse(
      demoReport(payload({ people, participantCount: 2 })),
    );
    expect(result.success).toBe(true);
  });

  it('never invents a quote', () => {
    // Every other string here is derived. A fabricated quotation would be the
    // one line in the file that is not true of the chat.
    const report = demoReport(
      payload({
        moments: [
          {
            id: 'w1',
            reasons: ['12 bursts of laughter'],
            participants: 3,
            messages: [
              {
                id: 0,
                sender: 'Person A',
                time: '12:00',
                date: '2024-01-01',
                text: 'שורה אמיתית מתוך השיחה הזאת',
              },
            ],
          },
        ],
      }),
    );
    for (const memory of report.memories) {
      if (memory.quote) expect(memory.quote).toBe('שורה אמיתית מתוך השיחה הזאת');
    }
  });
});
