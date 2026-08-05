import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PreviewSchema, SYSTEM, userPrompt } from '@/lib/aiPrompt';

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
const MODEL = process.env.WRAPPED_AI_MODEL ?? 'claude-opus-5';

/** Guard: every sender the client sends must already be a token. */
const SENDER_TOKEN = /^Person [A-Z]+$/;

const RequestSchema = z.object({
  language: z.enum(['en', 'he', 'other']),
  participantCount: z.number().int().min(1).max(500),
  /* The reader's own brief. Optional, because a request built before the
     onboarding existed is still a valid request. The notes are capped at the
     length of the box that produced them — an unbounded free-text field
     forwarded to a paid model is a bill somebody else gets to write. */
  brief: z
    .object({
      language: z.enum(['en', 'he']),
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
              sender: z.string().max(40),
              time: z.string().max(10),
              text: z.string().max(4000),
            }),
          )
          .max(80),
      }),
    )
    .max(8),
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
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

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Safety classifiers can decline a request outright; a group chat can
      // contain anything. Falling back keeps a real refusal rare.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { format: zodOutputFormat(PreviewSchema) },
      messages: [{ role: 'user', content: userPrompt(payload) }],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        {
          error:
            'The AI declined to write about this chat. Your statistics are all still here.',
        },
        { status: 422 },
      );
    }

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return NextResponse.json({ error: 'Empty response from the model.' }, { status: 502 });
    }

    const preview = PreviewSchema.parse(JSON.parse(text.text));

    // No store, no log, no database. The response goes straight back to the
    // browser, which maps the tokens to real names locally.
    return NextResponse.json(preview, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests right now. Try again in a minute.' },
        { status: 429 },
      );
    }
    console.error('[ai-preview] generation failed', error);
    return NextResponse.json({ error: 'Could not write your story.' }, { status: 502 });
  }
}
