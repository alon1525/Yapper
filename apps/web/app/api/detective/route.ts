import { NextResponse } from 'next/server';
import { DiscoverySchema } from '@wrapped/core';
import { z } from 'zod';
import { DETECTIVE_SYSTEM, detectivePrompt } from '@/lib/detectivePrompt';
import { failureBody, generateStructured } from '@/lib/generate';
import { modelConfigured, modelFor, modelMissingMessage } from '@/lib/providers';
import { gatePaidRequest } from '@/lib/paidRoute';
import { RequestSchema } from '@/lib/detectiveRequest';

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

const MAX_EXCERPT_CHARS = 300_000;

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

  if (!modelConfigured()) {
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

  const model = modelFor('detective');
  if (!model) {
    console.error(`[detective] ${modelMissingMessage('detective')}`);
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }

  const result = await generateStructured({
    model,
    system: DETECTIVE_SYSTEM,
    prompt: detectivePrompt(payload),
    schema: DiscoverySchema,
    maxTokens: 16000,
    stage: 'detective',
  });

  if (!result.ok) {
    return NextResponse.json(failureBody(result), { status: result.status });
  }

  return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
}
