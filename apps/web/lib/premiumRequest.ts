import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from './languages';

/**
 * The wire contract for the paid report, kept out of the route so it can be
 * checked against the thing that has to satisfy it.
 *
 * It lived in `app/api/premium/route.ts` until the payload grew and four of
 * these bounds had to move at once — the moment count, the messages per moment,
 * the width of a sender, and a new per-person array. Every one of those is a
 * number written twice, once here and once in `premiumPayload.ts`, and when the
 * two disagree the result is a 400 "Malformed request." on a request that has
 * already been paid for and already cost a model call to nobody.
 *
 * Route files may only export handlers and a short list of config values, so a
 * test cannot reach a schema declared inside one. Moving it here is what lets
 * `premiumPayload.test.ts` assert the round trip: build a real payload, parse it
 * with the real schema, and fail in CI rather than at the till.
 */

export const RequestSchema = z.object({
  token: z.string().max(500),
  language: z.enum(['en', 'he', 'other']),
  participantCount: z.number().int().min(1).max(500),
  /* Optional, and bounded: the notes field is free text the reader typed, and
     an unbounded one forwarded to a paid model is somebody else's bill. */
  brief: z
    .object({
      /* Built from the language table rather than written out again — a
         language on the cards but not in this enum is one the reader can pick
         and the route then rejects. */
      language: z.enum(REPORT_LANGUAGE_CODES),
      kind: z.string().max(40),
      /* The register control. Absent on a client that predates it, and the
         fallback is the default rather than the timid one — see `brief.ts`. */
      tone: z.enum(['roast', 'gentle']).default('roast'),
      notes: z.string().max(600),
    })
    .optional(),
  fingerprint: z.object({
    totalMessages: z.number().int().min(1),
    spanLabel: z.string().max(120),
    participantCount: z.number().int().min(1).max(500),
  }),
  digest: z.object({
    totalMessages: z.number(),
    spanLabel: z.string().max(120),
    perDay: z.number(),
    activeDays: z.number(),
    topEmoji: z.array(z.object({ value: z.string(), count: z.number() })).max(10),
    busiestDay: z.object({ day: z.string().max(20), count: z.number() }).nullable(),
    longestStreakDays: z.number(),
    longestSilenceDays: z.number(),
  }),
  people: z
    .array(
      z.object({
        sender: z.string().max(80),
        share: z.number(),
        messages: z.number(),
        nightShare: z.number(),
        medianResponseMinutes: z.number().nullable(),
        longestSilenceDays: z.number(),
        stillGone: z.boolean(),
        consistency: z.number(),
        laughsPerMessage: z.number(),
        topEmoji: z.array(z.string().max(20)).max(5),
        distinctiveWords: z.array(z.string().max(60)).max(10),
        meanLength: z.number(),
        questionShare: z.number(),
        oneWordShare: z.number(),
        /* Their own messages. This replaced a single `longestMessage`, which
           on real exports was usually a forwarded chain letter rather than
           anything the person wrote — see `premiumPayload.ts`. */
        samples: z
          .array(
            z.object({
              id: z.number().int().min(0),
              sender: z.string().max(80),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(1000),
              edited: z.boolean().optional(),
            }),
          )
          .max(40)
          .default([]),
      }),
    )
    .max(60),
  eras: z
    .array(
      z.object({
        year: z.number().int(),
        messages: z.number(),
        busiestMonth: z.string().max(20).nullable(),
      }),
    )
    .max(30),
  moments: z
    .array(
      z.object({
        id: z.string().max(40),
        reasons: z.array(z.string().max(200)).max(10),
        participants: z.number(),
        messages: z
          .array(
            z.object({
              /* An index into the reader's own message array. It is the anchor
                 for every citation the model makes, and it is meaningless to
                 anyone who does not hold that array — so it is the one new
                 field here that carries no identity. */
              id: z.number().int().min(0),
              /* Real display names now, not `Person A`. Widened because a
                 WhatsApp display name is whatever somebody typed into their
                 own phone, emoji and all. */
              sender: z.string().max(80),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(4000),
              edited: z.boolean().optional(),
            }),
          )
          .max(60),
      }),
    )
    .max(160),
});

export type PremiumRequest = z.infer<typeof RequestSchema>;
