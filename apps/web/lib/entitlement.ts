import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The paywall seam.
 *
 * Premium content is gated on *generation*, not on display. If the full report
 * existed in the browser behind a blurred overlay, devtools would unlock it in
 * one click — so the slides genuinely do not exist until a valid entitlement is
 * presented, and only the server can mint one.
 *
 * Today `/api/checkout` mints tokens for free. When Stripe lands, the only
 * change is *who calls `mint`*: a webhook or a verified checkout session
 * instead of the mock route. Nothing downstream moves.
 */

const TTL_MS = 15 * 60 * 1000;

/**
 * A missing secret must fail loudly rather than degrade to signing with an
 * empty string, which would validate every forged token ever presented.
 */
export function signingSecret(): string | null {
  const secret = process.env.WRAPPED_SIGNING_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export interface Claims {
  /**
   * Binds the token to one specific chat. A token minted for a 200-message
   * test chat cannot be replayed against someone's 170k-message export, which
   * is the replay that would actually cost real money.
   */
  chat: string;
  exp: number;
}

/**
 * A stable fingerprint of *which* wrapped is being paid for, derived only from
 * figures that already leave the browser. Deliberately not a content hash: the
 * client must be able to compute it before paying, and the server must be able
 * to recompute it from the payload afterwards.
 */
export function chatFingerprint(input: {
  totalMessages: number;
  spanLabel: string;
  participantCount: number;
}): string {
  return createHmac('sha256', 'wrapped-fingerprint')
    .update(`${input.totalMessages}|${input.spanLabel}|${input.participantCount}`)
    .digest('base64url')
    .slice(0, 22);
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function mint(chat: string, secret: string, now = Date.now()): string {
  const claims: Claims = { chat, exp: now + TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export type VerifyResult =
  | { ok: true; claims: Claims }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'wrong-chat' };

export function verify(
  token: string,
  expectedChat: string,
  secret: string,
  now = Date.now(),
): VerifyResult {
  const [body, mac] = token.split('.');
  if (!body || !mac) return { ok: false, reason: 'malformed' };

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(mac);
  // Length check first: timingSafeEqual throws on a length mismatch rather than
  // returning false, and a forged token is exactly where that would happen.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'signature' };
  }

  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Claims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof claims.exp !== 'number' || claims.exp < now) return { ok: false, reason: 'expired' };
  if (claims.chat !== expectedChat) return { ok: false, reason: 'wrong-chat' };

  return { ok: true, claims };
}
