import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from './languages';

/**
 * What `/api/detective` accepts.
 *
 * Out of the route for the same reason the premium schema is: a route file may
 * only export handlers, so a schema declared inside one is unreachable from a
 * test, and every bound in it is a number written twice — once here and once
 * in the payload builder that has to stay under it. The pipeline test parses a
 * real payload with the real schema, which is how a builder that grows past
 * its own route gets caught before a reader does.
 */

export const MessageSchema = z.object({
  id: z.number().int().min(0),
  sender: z.string().max(40),
  time: z.string().max(10),
  date: z.string().max(12),
  text: z.string().max(4000),
  edited: z.boolean().optional(),
});

export const RequestSchema = z.object({
  token: z.string().max(500),
  language: z.enum(['en', 'he', 'other']),
  participantCount: z.number().int().min(1).max(500),
  brief: z
    .object({
      /* Built from the language table rather than written out again — a
         language on the cards but not in this enum is one the reader can pick
         and the route then rejects. */
      language: z.enum(REPORT_LANGUAGE_CODES),
      kind: z.string().max(40),
      tone: z.enum(['roast', 'gentle']).optional(),
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
    activeDays: z.number(),
    perDay: z.number(),
    firstDay: z.string().max(12),
    lastDay: z.string().max(12),
  }),
  people: z
    .array(
      z.object({
        sender: z.string().max(40),
        messages: z.number(),
        share: z.number(),
        firstDay: z.string().max(12),
        lastDay: z.string().max(12),
        nightShare: z.number(),
        longestSilenceDays: z.number(),
        stillGone: z.boolean(),
        signature: z.string().max(120).nullable(),
        arrivalClaims: z.number(),
      }),
    )
    .max(60),
  phrases: z
    .array(
      z.object({
        phrase: z.string().max(120),
        count: z.number(),
        speakers: z.number(),
        firstSpeaker: z.string().max(40),
        firstDay: z.string().max(12),
        exampleMessageIds: z.array(z.number().int().min(0)).max(8),
      }),
    )
    .max(40),
  contagions: z
    .array(
      z.object({
        phrase: z.string().max(120),
        patientZero: z.string().max(40),
        adopters: z
          .array(
            z.object({
              sender: z.string().max(40),
              day: z.string().max(12),
              messageId: z.number().int().min(0),
            }),
          )
          .max(60),
        incubationDays: z.number(),
        exampleMessageIds: z.array(z.number().int().min(0)).max(8),
      }),
    )
    .max(20),
  interactions: z.object({
    pingPong: z
      .object({
        a: z.string().max(40),
        b: z.string().max(40),
        exchanges: z.number(),
        longestVolley: z.number(),
      })
      .nullable(),
    killers: z
      .array(
        z.object({
          sender: z.string().max(40),
          kills: z.number(),
          index: z.number(),
          exampleMessageIds: z.array(z.number().int().min(0)).max(8),
        }),
      )
      .max(10),
    monologues: z
      .array(
        z.object({
          sender: z.string().max(40),
          length: z.number(),
          day: z.string().max(12),
          startId: z.number().int().min(0),
          endId: z.number().int().min(0),
        }),
      )
      .max(10),
    mentions: z
      .array(z.object({ by: z.string().max(40), target: z.string().max(40), count: z.number() }))
      .max(40),
  }),
  commitments: z.object({
    repeatedArrivals: z
      .array(
        z.object({
          sender: z.string().max(40),
          day: z.string().max(12),
          claims: z.number(),
          messageIds: z.array(z.number().int().min(0)).max(20),
        }),
      )
      .max(12),
    questions: z
      .array(
        z.object({
          kind: z.string().max(20),
          count: z.number(),
          topAsker: z.string().max(40).nullable(),
        }),
      )
      .max(10),
  }),
  stalledPlans: z
    .array(
      z.object({
        category: z.string().max(20),
        topics: z.array(z.string().max(60)).max(8),
        months: z.array(z.string().max(8)).max(120),
        mentions: z.number(),
        participants: z.array(z.string().max(40)).max(60),
        exampleMessageIds: z.array(z.number().int().min(0)).max(10),
      }),
    )
    .max(10),
  conversations: z
    .array(
      z.object({
        id: z.string().max(20),
        day: z.string().max(12),
        messageCount: z.number(),
        participants: z.array(z.string().max(40)).max(60),
        keywords: z.array(z.string().max(60)).max(12),
        summary: z.string().max(400),
        scores: z.object({
          comedy: z.number(),
          conflict: z.number(),
          laughter: z.number(),
          recall: z.number(),
        }),
        messages: z.array(MessageSchema).max(40),
      }),
    )
    .max(24),
});

