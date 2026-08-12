import { NextResponse } from 'next/server';
import { chatFingerprint, signingSecret, verify } from './entitlement';
import { crossSite, excerptChars, forbiddenCrossSite, payloadTooLarge } from './guard';
import { checkRate, tooManyRequests, type Bucket } from './rateLimit';

/**
 * The gate every request that can reach a paid model has to pass.
 *
 * Extracted rather than copied. `/api/premium` grew this sequence one check at
 * a time, each for a reason recorded in its own comment, and the pipeline added
 * two more routes that can spend the same money. A second hand-written copy
 * would be correct on the day it was written and one commit behind for the rest
 * of its life — and the check most likely to be forgotten is the one that stops
 * a token minted for a twelve-message test chat being replayed against a
 * hundred-thousand-message export.
 *
 * Order is deliberate and unchanged from the original:
 *   1. cross-site, 2. rate limit, 3. secret configured, 4. entitlement,
 *   5. fingerprint agreement, 6. payload size, 7. anonymisation.
 *
 * Entitlement precedes everything expensive, and the fingerprint check follows
 * it so that a caller with no token learns nothing about the payload rules.
 */

/** Every sender the client sends must already be a token. */
const SENDER_TOKEN = /^Person [A-Z]+$/;

export interface PaidRequest {
  token: string;
  participantCount: number;
  fingerprint: { totalMessages: number; spanLabel: string; participantCount: number };
  /** Must agree with `fingerprint`, or the entitlement is being reused. */
  digest: { totalMessages: number; spanLabel: string };
  /* The excerpt-bearing collections, all optional: each route carries a
     different one, and `excerptChars` sums whichever are present. */
  brief?: { notes: string };
  moments?: { messages: { text: string }[] }[];
  conversations?: { messages: { text: string }[] }[];
  evidence?: Record<string, { text: string }[]>;
  /* Every route's person row carries a sender and differs after that. The two
     quoted fields belong to the premium payload alone — a spread of each
     person's own lines, and historically a single longest message — and are
     optional here so the same gate accepts every shape. Kept in step with
     `excerptChars` in `guard.ts`, which is what actually measures them. */
  people?: { sender: string; longestMessage?: string | null; samples?: { text: string }[] }[];
}

export interface GateOptions {
  /** Rate-limit bucket. Distinct per route so one cannot exhaust another. */
  bucket: Bucket;
  /** Ceiling on excerpt characters for this route. */
  maxExcerptChars: number;
  /**
   * Every string in the payload that names somebody. Checked against the token
   * shape, because the privacy guarantee must not depend on client code being
   * correct.
   */
  senders?: readonly string[];
}

/** Null when the request may proceed; a response to return when it may not. */
export async function gatePaidRequest(
  request: Request,
  payload: PaidRequest,
  options: GateOptions,
): Promise<Response | null> {
  if (crossSite(request)) return forbiddenCrossSite();

  const rate = await checkRate(options.bucket, request);
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  const secret = signingSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'Payments are not configured on this server.' },
      { status: 503 },
    );
  }

  // The fingerprint is recomputed from the payload rather than trusted from it,
  // so a token minted for one chat cannot generate a report for another.
  const result = verify(payload.token, chatFingerprint(payload.fingerprint), secret);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === 'expired'
            ? 'That unlock has expired. Unlock again to generate your report.'
            : 'This report has not been unlocked.',
      },
      { status: result.reason === 'expired' ? 410 : 402 },
    );
  }

  // The entitlement binds to `fingerprint`, but the report is written from
  // `digest` — and those are separate fields the client fills in independently.
  // Declaring a constant fingerprint while swapping the content underneath
  // produced a token that validated against every chat in turn, which is exactly
  // the replay the fingerprint exists to stop.
  if (
    payload.fingerprint.totalMessages !== payload.digest.totalMessages ||
    payload.fingerprint.spanLabel !== payload.digest.spanLabel ||
    payload.fingerprint.participantCount !== payload.participantCount
  ) {
    return NextResponse.json(
      { error: 'This unlock does not match the report being requested.' },
      { status: 402 },
    );
  }

  if (excerptChars(payload) > options.maxExcerptChars) return payloadTooLarge();

  for (const sender of options.senders ?? []) {
    if (!SENDER_TOKEN.test(sender)) {
      return NextResponse.json(
        { error: 'Request rejected: senders must be anonymised before sending.' },
        { status: 400 },
      );
    }
  }

  return null;
}

export { SENDER_TOKEN };
