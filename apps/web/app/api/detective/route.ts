import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { DiscoverySchema } from '@wrapped/core';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { DETECTIVE_SYSTEM, detectivePrompt } from '@/lib/detectivePrompt';
import { generateStructured } from '@/lib/generate';
import { gatePaidRequest } from '@/lib/paidRoute';

/**
 * Stage 4 — the investigation.
 *
 * Returns structured findings with message ids and nothing else. It writes no
 * copy, so nothing it returns is shown to anybody: the browser verifies every
 * finding against the reader's real messages first, and only what survives is
 * sent back to `/api/write`.
 *
 * Entitlement-gated for the same reason `/api/premium` is — this reaches a paid
 * model — and through the same extracted gate, so the two cannot drift.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Configurable, and deliberately allowed to be a cheaper model than the writer.
 * This pass reads a lot and produces a little structured output; the comedy pass
 * reads a little and produces the thing people actually see. If only one of them
 * gets the expensive model, it should be the second.
 */
const MODEL = process.env.WRAPPED_DETECTIVE_MODEL ?? 'claude-opus-5';

const MAX_EXCERPT_CHARS = 300_000;

const MessageSchema = z.object({
  id: z.number().int().min(0),
  sender: z.string().max(40),
  time: z.string().max(10),
  date: z.string().max(12),
  text: z.string().max(4000),
  edited: z.boolean().optional(),
});

const RequestSchema = z.object({
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

export async function POST(request: Request) {
  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // Defence in depth over every field that names somebody, not only the
  // transcript. The detective payload carries names in far more places than the
  // moment excerpts did: per-person rows, phrase attribution, contagion
  // adopters, interaction pairs, plan participants.
  const senders = [
    ...payload.people.map((p) => p.sender),
    ...payload.phrases.map((p) => p.firstSpeaker),
    ...payload.contagions.flatMap((c) => [c.patientZero, ...c.adopters.map((a) => a.sender)]),
    ...(payload.interactions.pingPong
      ? [payload.interactions.pingPong.a, payload.interactions.pingPong.b]
      : []),
    ...payload.interactions.killers.map((k) => k.sender),
    ...payload.interactions.monologues.map((m) => m.sender),
    ...payload.interactions.mentions.flatMap((m) => [m.by, m.target]),
    ...payload.commitments.repeatedArrivals.map((r) => r.sender),
    ...payload.commitments.questions.flatMap((q) => (q.topAsker ? [q.topAsker] : [])),
    ...payload.stalledPlans.flatMap((s) => s.participants),
    ...payload.conversations.flatMap((c) => [
      ...c.participants,
      ...c.messages.map((m) => m.sender),
    ]),
  ];

  const blocked = await gatePaidRequest(request, payload, {
    bucket: 'detective',
    maxExcerptChars: MAX_EXCERPT_CHARS,
    senders,
  });
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    // No key means no investigation. Returning an empty discovery rather than an
    // error keeps the deck walkable: the planner still produces every statistic
    // slide, and the report is simply the deterministic half of itself.
    return NextResponse.json(
      {
        groupIdentity: { summary: '', confidence: 0, evidenceMessageIds: [] },
        voice: { register: '', roastTolerance: 0.5, darkHumour: false },
        findings: [],
      },
      { headers: { 'Cache-Control': 'no-store', 'X-Wrapped-Demo': '1' } },
    );
  }

  const result = await generateStructured(new Anthropic(), {
    model: MODEL,
    system: DETECTIVE_SYSTEM,
    prompt: detectivePrompt(payload),
    schema: DiscoverySchema,
    maxTokens: 16000,
    stage: 'detective',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}
