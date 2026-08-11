import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { WrittenDeckSchema } from '@wrapped/core';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { generateStructured } from '@/lib/generate';
import { gatePaidRequest } from '@/lib/paidRoute';
import { WRITER_SYSTEM, writerPrompt } from '@/lib/writerPrompt';

/**
 * Stage 7 — the comedy pass.
 *
 * Receives briefs that have already been planned and verified, and returns
 * finished copy. It is given no chat to search and no freedom to introduce a
 * fact: the figures on each brief are the only ones permitted, the quotes are
 * the only ones permitted, and the browser re-checks both against the real
 * messages when the reply lands.
 *
 * Same gate as the other paid routes, because this is the request that reaches
 * the expensive model.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

/** The pass whose output people actually read, so it gets the better model. */
const MODEL = process.env.WRAPPED_WRITER_MODEL ?? 'claude-opus-5';

const MAX_EXCERPT_CHARS = 120_000;

const StatSchema = z.object({
  label: z.string().max(60),
  value: z.union([z.number(), z.string().max(40)]),
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
  }),
  voice: z.object({
    register: z.string().max(300),
    roastTolerance: z.number().min(0).max(1),
    darkHumour: z.boolean(),
  }),
  groupSummary: z.string().max(600),
  briefs: z
    .array(
      z.object({
        id: z.string().max(80),
        type: z.string().max(30),
        format: z.string().max(30),
        angle: z.string().max(600),
        stats: z.array(StatSchema).max(12),
        people: z.array(z.string().max(40)).max(60),
        evidenceMessageIds: z.array(z.number().int().min(0)).max(40),
        findingIds: z.array(z.string().max(60)).max(8),
        sensitivity: z.enum(['low', 'medium', 'high']),
        strength: z.number(),
        targetLength: z.number().int().min(40).max(700),
      }),
    )
    .max(40),
  evidence: z.record(
    z.string().max(80),
    z
      .array(
        z.object({
          id: z.number().int().min(0),
          sender: z.string().max(40),
          time: z.string().max(10),
          date: z.string().max(12),
          text: z.string().max(1000),
          edited: z.boolean().optional(),
        }),
      )
      .max(8),
  ),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const senders = [
    ...payload.briefs.flatMap((b) => b.people),
    ...Object.values(payload.evidence).flatMap((quotes) => quotes.map((q) => q.sender)),
  ];

  const blocked = await gatePaidRequest(request, payload, {
    bucket: 'write',
    maxExcerptChars: MAX_EXCERPT_CHARS,
    senders,
  });
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI writing is not configured on this server.' },
      { status: 503 },
    );
  }

  const result = await generateStructured(new Anthropic(), {
    model: MODEL,
    system: WRITER_SYSTEM,
    prompt: writerPrompt({
      language: payload.language,
      brief: payload.brief,
      voice: payload.voice,
      groupSummary: payload.groupSummary,
      // The route's own schema is intentionally looser than core's — it
      // validates shape and size for safety, and core's types carry the meaning.
      briefs: payload.briefs as never,
      evidence: payload.evidence,
    }),
    schema: WrittenDeckSchema,
    maxTokens: 20000,
    stage: 'write',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}
