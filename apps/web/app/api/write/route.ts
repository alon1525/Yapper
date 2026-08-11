import { NextResponse } from 'next/server';
import { WrittenDeckSchema } from '@wrapped/core';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { loadFixture } from '@/lib/fixture';
import { generateStructured } from '@/lib/generate';
import { modelConfigured, modelFor, modelMissingMessage } from '@/lib/providers';
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
        /* Whitelisted like everything else on a brief. Left out, the writer is
           asked to rename axes it was never shown and invents the lot. */
        scoreAxes: z
          .array(
            z.object({
              key: z.string().max(40),
              value: z.number().int().min(0).max(100),
              meaning: z.string().max(160),
            }),
          )
          .max(16)
          .default([]),
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

  if (!modelConfigured()) {
    /*
      The same escape hatch the other two written routes have, and the stage that
      needed it most: this is where slide *layout* is decided, and a format that
      overflows its card or reads flat is only visible once real copy is playing
      through the real deck. `/api/detective` degrades to an empty discovery
      instead, so the planner still briefs every statistic and persona slide and
      a fixture written against those ids plays end to end with no key attached.

      Scoped exactly as `fixture.ts` describes: reachable only on a deploy with
      no key, and only when `WRAPPED_FIXTURE_DIR` points somewhere local. It
      cannot stand in for a generation somebody paid for.
    */
    const written = loadFixture('write');
    if (written) {
      const parsed = WrittenDeckSchema.safeParse(written);
      if (!parsed.success) {
        console.error('[write] fixture failed the schema', parsed.error.issues);
        return NextResponse.json({ error: 'The deck fixture is not valid.' }, { status: 500 });
      }
      return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(
      { error: 'AI writing is not configured on this server.' },
      { status: 503 },
    );
  }

  const model = modelFor('write');
  if (!model) {
    console.error(`[write] ${modelMissingMessage('write')}`);
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }

  const result = await generateStructured({
    model,
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
