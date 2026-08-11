import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Per-IP request limits for the routes that cost money to serve.
 *
 * Why this needs a store at all: on Vercel every request can land on a fresh
 * serverless instance, so a counter held in a module-level `Map` gives an
 * attacker a brand new bucket on most requests. That is worse than no limiter,
 * because it looks like protection. The counter has to live somewhere both
 * instances can see, which is what Upstash is here for — a key-value store with
 * a TTL, not a database, and nothing in this product is persisted in it beyond
 * a per-IP integer that expires on its own.
 *
 * This is the *inner* net. The outer one is a Vercel Firewall rate-limit rule,
 * which rejects at the edge before a function is ever invoked — see SECURITY.md.
 * Two layers because they fail differently: the Firewall keeps working when
 * Upstash is down, and this one keeps working when a request slips past the
 * edge rule.
 *
 * With no Upstash credentials configured this is a no-op that says so once at
 * startup, so local development and a first deploy both work untouched.
 */

export type Bucket = 'preview' | 'premium' | 'checkout' | 'card' | 'detective' | 'write';

/**
 * Deliberately generous per hour rather than tight per minute. Mobile carriers
 * put thousands of real people behind one CGNAT address, so a limit tuned to
 * "one person could not possibly need more than this" blocks a coffee shop.
 * These are set to stop a script in a loop, which is the actual threat — a
 * scripted drain wants thousands of requests, not twenty.
 */
const LIMITS: Record<Bucket, { requests: number; window: '1 h' }> = {
  // The free AI story. The only expensive route with no gate in front of it,
  // so it is the one a drain would target.
  preview: { requests: 15, window: '1 h' },
  // The paid report — the most expensive single call in the product.
  premium: { requests: 10, window: '1 h' },
  // Cheap, but it mints entitlements, so it should not be a free faucet.
  checkout: { requests: 20, window: '1 h' },
  // CPU rather than tokens: a 1080×1920 rasterise per call.
  card: { requests: 40, window: '1 h' },
  // The two halves of the staged report. Bucketed separately so exhausting one
  // does not lock the other, and set to the same ceiling as `premium` because a
  // full report is one call to each — a caller who has run ten of these has run
  // ten reports, which is what the limit is trying to express.
  detective: { requests: 10, window: '1 h' },
  write: { requests: 10, window: '1 h' },
};

const configured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    '[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN are unset — per-IP limits are OFF. ' +
      'Fine locally; on any deploy with a model key set — ANTHROPIC_API_KEY or ' +
      'OPENAI_API_KEY — configure them or a Vercel Firewall rule.',
  );
}

const redis = configured ? Redis.fromEnv() : null;
const limiters = new Map<Bucket, Ratelimit>();

function limiter(bucket: Bucket): Ratelimit | null {
  if (!redis) return null;
  let existing = limiters.get(bucket);
  if (!existing) {
    const { requests, window } = LIMITS[bucket];
    existing = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `yapped:${bucket}`,
      analytics: false,
    });
    limiters.set(bucket, existing);
  }
  return existing;
}

/**
 * The caller's address as Vercel sees it.
 *
 * `x-forwarded-for` is spoofable in general, but not here: Vercel's proxy
 * overwrites it with the connecting address rather than appending to whatever
 * the client sent, so on a deploy the first entry is the real client. Off
 * Vercel there is no limiter running anyway.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

export async function checkRate(bucket: Bucket, request: Request): Promise<RateResult> {
  const rl = limiter(bucket);
  if (!rl) {
    warnOnce();
    return { ok: true };
  }

  try {
    const { success, reset } = await rl.limit(clientIp(request));
    if (success) return { ok: true };
    return { ok: false, retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
  } catch (error) {
    // Fails open, on purpose. An Upstash outage should not take the product
    // down with it, and the Firewall rule is still standing in front of this.
    // Logged loudly because "the limiter has been off for a week" is exactly
    // the thing that goes unnoticed.
    console.error('[rateLimit] store unreachable — allowing request', error);
    return { ok: true };
  }
}

/** The 429 every route returns, so the shape and the header stay in one place. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Try again in a little while.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    },
  );
}
