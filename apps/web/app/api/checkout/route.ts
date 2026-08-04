import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chatFingerprint, mint, signingSecret } from '@/lib/entitlement';

/**
 * Where Stripe will go.
 *
 * Right now this mints an entitlement for anyone who asks — it is a mock till,
 * not a payment. It exists in this shape so that adding Stripe is a change to
 * *this file only*: create a Checkout Session, redirect, and mint on the
 * verified return or webhook instead of minting immediately. The token format,
 * the premium route, and the whole client flow stay exactly as they are.
 *
 * `WRAPPED_PAYMENTS_LIVE` is the switch that will refuse the mock once real
 * payments exist, so a misconfigured deploy cannot quietly hand out free
 * reports.
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  totalMessages: z.number().int().min(1),
  spanLabel: z.string().max(120),
  participantCount: z.number().int().min(1).max(500),
});

export async function POST(request: Request) {
  const secret = signingSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'Payments are not configured on this server.' },
      { status: 503 },
    );
  }

  if (process.env.WRAPPED_PAYMENTS_LIVE === 'true') {
    return NextResponse.json(
      { error: 'Real payments are enabled but no payment provider is wired up yet.' },
      { status: 501 },
    );
  }

  let input: z.infer<typeof RequestSchema>;
  try {
    input = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // Bound to this chat, so the token cannot be lifted and replayed against a
  // different (larger, more expensive) export.
  const token = mint(chatFingerprint(input), secret);

  return NextResponse.json(
    { token, mock: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
