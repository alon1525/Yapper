import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { PreviewSchema, SYSTEM, userPrompt } from '@/lib/aiPrompt';
import { loadFixture } from '@/lib/fixture';
import { failureBody, generateStructured } from '@/lib/generate';
import { modelConfigured, modelFor, modelMissingMessage } from '@/lib/providers';
import { crossSite, excerptChars, forbiddenCrossSite, payloadTooLarge } from '@/lib/guard';
import { checkRate, tooManyRequests } from '@/lib/rateLimit';

/**
 * The only route in this application that ever receives chat text.
 *
 * Reached only after the user explicitly consents on the AI slide. What arrives
 * here is already anonymised in the browser: senders are `Person A`, and
 * message bodies have had those same names, phone numbers and emails stripped.
 * Nothing is persisted — the request is read, forwarded, and discarded.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

// Opus 5 by default: this pass is the product's hook, and the humour is the
// whole point. Override to a cheaper model with WRAPPED_AI_MODEL if the volume
// justifies it — that is a cost decision, not a default.

/** Guard: every sender the client sends must already be a token. */
const SENDER_TOKEN = /^Person [A-Z]+$/;

/**
 * Ceiling on the excerpt text in one request, in characters.
 *
 * `buildPreviewPayload` sends five moments of forty messages — about forty
 * thousand characters on a talkative chat. This is several times that, so no
 * real export comes near it, and it is far below what the array bounds alone
 * would allow through.
 */
const MAX_EXCERPT_CHARS = 150_000;

const RequestSchema = z.object({
  language: z.enum(['en', 'he', 'other']),
  participantCount: z.number().int().min(1).max(500),
  /* The reader's own brief. Optional, because a request built before the
     onboarding existed is still a valid request. The notes are capped at the
     length of the box that produced them — an unbounded free-text field
     forwarded to a paid model is a bill somebody else gets to write. */
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
  digest: z.object({
    totalMessages: z.number(),
    spanLabel: z.string().max(120),
    perDay: z.number(),
    topTalker: z.object({ sender: z.string(), share: z.number() }).nullable(),
    nightOwl: z.object({ sender: z.string(), nightShare: z.number() }).nullable(),
    ghost: z.object({ sender: z.string(), days: z.number() }).nullable(),
    topEmoji: z.array(z.object({ value: z.string(), count: z.number() })).max(10),
  }),
  moments: z
    .array(
      z.object({
        id: z.string().max(40),
        reasons: z.array(z.string().max(200)).max(10),
        participants: z.number(),
        messages: z
          .array(
            z.object({
              /* An index into the reader's own message array — the anchor for
                 any citation, and meaningless to anyone without that array. */
              id: z.number().int().min(0),
              sender: z.string().max(40),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(4000),
              edited: z.boolean().optional(),
            }),
          )
          .max(50),
      }),
    )
    .max(6),
});

export async function POST(request: Request) {
  if (crossSite(request)) return forbiddenCrossSite();

  const rate = await checkRate('preview', request);
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  if (!modelConfigured()) {
    // Stand-in for the model while the deck is being designed. Only ever
    // reachable on a server with no key, so it cannot shadow a real request.
    const written = loadFixture('preview');
    if (written) {
      const parsed = PreviewSchema.safeParse(written);
      if (!parsed.success) {
        console.error('[ai-preview] fixture failed the schema', parsed.error.issues);
        return NextResponse.json({ error: 'The preview fixture is not valid.' }, { status: 500 });
      }
      return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(
      { error: 'AI is not configured on this server.' },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (excerptChars(payload) > MAX_EXCERPT_CHARS) return payloadTooLarge();

  // Defence in depth. Anonymisation happens in the browser, but if a bug ever
  // let a real name through, this refuses the request rather than forwarding
  // it — the privacy promise should not depend on client code being correct.
  for (const moment of payload.moments) {
    for (const message of moment.messages) {
      if (!SENDER_TOKEN.test(message.sender)) {
        return NextResponse.json(
          { error: 'Request rejected: senders must be anonymised before sending.' },
          { status: 400 },
        );
      }
    }
  }

  const model = modelFor('preview');
  if (!model) {
    console.error(`[ai-preview] ${modelMissingMessage('preview')}`);
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }

  const result = await generateStructured({
    model,
    system: SYSTEM,
    prompt: userPrompt(payload),
    schema: PreviewSchema,
    maxTokens: 16000,
    stage: 'ai-preview',
  });

  if (!result.ok) {
    return NextResponse.json(failureBody(result), { status: result.status });
  }

  // No store, no log, no database. The response goes straight back to the
  // browser, which maps the tokens to real names locally.
  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}
