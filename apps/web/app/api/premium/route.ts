import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { demoReport } from '@/lib/demoReport';
import { chatFingerprint, signingSecret, verify } from '@/lib/entitlement';
import { loadFixture } from '@/lib/fixture';
import { failureBody, generateStructured } from '@/lib/generate';
import { modelConfigured, modelFor, modelMissingMessage } from '@/lib/providers';
import { crossSite, excerptChars, forbiddenCrossSite, payloadTooLarge } from '@/lib/guard';
import { PremiumSchema, premiumPrompt, premiumSystem } from '@/lib/premiumPrompt';
import { checkRate, tooManyRequests } from '@/lib/rateLimit';

/**
 * The paid generation.
 *
 * Gated on generation rather than display: without a valid entitlement this
 * route writes nothing, so the premium slides do not exist anywhere the browser
 * could reach them. That is also the expensive path — this is the only request
 * in the product that can run to several thousand output tokens — so the order
 * of checks matters: entitlement first, model last.
 */

export const runtime = 'nodejs';

/**
 * Five minutes, raised from two when the payload grew.
 *
 * This request now sends roughly 3,400 messages rather than 360, and can still
 * ask for up to 24,000 output tokens — a report with a card for every member of
 * an eighteen-person group is not short. `generateStructured` also takes a
 * second turn when the first reply fails validation, which doubles the worst
 * case rather than adding to it.
 *
 * A timeout here is the most expensive failure in the product: the model has
 * been paid for, the work is done, and the reader sees an error. The host may
 * clamp this to whatever the plan allows, which is the correct behaviour — it
 * cannot be lower than the old value, so asking is free.
 */
export const maxDuration = 300;

/**
 * Ceiling on excerpt text per request.
 *
 * The paid payload is the one request in this product that carries real names
 * and a substantial slice of the chat: up to 120 bursts of fifty messages, plus
 * thirty of each person's own lines. On a real 25,812-message export that is
 * 3,400 messages and about 75,000 characters of excerpt.
 *
 * This ceiling is a backstop against a hostile client, not a budget — the
 * honest client counts its own characters and sends less material rather than
 * risk this (`MOMENT_CHAR_BUDGET` in `premiumPayload.ts`, currently 400k plus
 * 80k of per-person lines). It sits above that and far below what the per-field
 * bounds alone would permit, which is 160 windows of sixty 4,000-character
 * messages: thirty-eight megabytes, from a payload that validates.
 *
 * Measured, not guessed. `npx vite-node scripts/ai-dry-run.ts` prints the
 * premium prompt size for a real export; re-run it before moving this.
 */
const MAX_EXCERPT_CHARS = 600_000;

const RequestSchema = z.object({
  token: z.string().max(500),
  language: z.enum(['en', 'he', 'other']),
  participantCount: z.number().int().min(1).max(500),
  /* Optional, and bounded: the notes field is free text the reader typed, and
     an unbounded one forwarded to a paid model is somebody else's bill. */
  brief: z
    .object({
      /* Built from the language table rather than written out again — a
         language on the cards but not in this enum is one the reader can pick
         and the route then rejects. */
      language: z.enum(REPORT_LANGUAGE_CODES),
      kind: z.string().max(40),
      /* The register control. Absent on a client that predates it, and the
         fallback is the default rather than the timid one — see `brief.ts`. */
      tone: z.enum(['roast', 'gentle']).default('roast'),
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
    perDay: z.number(),
    activeDays: z.number(),
    topEmoji: z.array(z.object({ value: z.string(), count: z.number() })).max(10),
    busiestDay: z.object({ day: z.string().max(20), count: z.number() }).nullable(),
    longestStreakDays: z.number(),
    longestSilenceDays: z.number(),
  }),
  people: z
    .array(
      z.object({
        sender: z.string().max(80),
        share: z.number(),
        messages: z.number(),
        nightShare: z.number(),
        medianResponseMinutes: z.number().nullable(),
        longestSilenceDays: z.number(),
        stillGone: z.boolean(),
        consistency: z.number(),
        laughsPerMessage: z.number(),
        topEmoji: z.array(z.string().max(20)).max(5),
        distinctiveWords: z.array(z.string().max(60)).max(10),
        meanLength: z.number(),
        questionShare: z.number(),
        oneWordShare: z.number(),
        /* Their own messages. This replaced a single `longestMessage`, which
           on real exports was usually a forwarded chain letter rather than
           anything the person wrote — see `premiumPayload.ts`. */
        samples: z
          .array(
            z.object({
              id: z.number().int().min(0),
              sender: z.string().max(80),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(1000),
              edited: z.boolean().optional(),
            }),
          )
          .max(40)
          .default([]),
      }),
    )
    .max(60),
  eras: z
    .array(
      z.object({
        year: z.number().int(),
        messages: z.number(),
        busiestMonth: z.string().max(20).nullable(),
      }),
    )
    .max(30),
  moments: z
    .array(
      z.object({
        id: z.string().max(40),
        reasons: z.array(z.string().max(200)).max(10),
        participants: z.number(),
        messages: z
          .array(
            z.object({
              /* An index into the reader's own message array. It is the anchor
                 for every citation the model makes, and it is meaningless to
                 anyone who does not hold that array — so it is the one new
                 field here that carries no identity. */
              id: z.number().int().min(0),
              /* Real display names now, not `Person A`. Widened because a
                 WhatsApp display name is whatever somebody typed into their
                 own phone, emoji and all. */
              sender: z.string().max(80),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(4000),
              edited: z.boolean().optional(),
            }),
          )
          .max(60),
      }),
    )
    .max(160),
});

export async function POST(request: Request) {
  if (crossSite(request)) return forbiddenCrossSite();

  const rate = await checkRate('premium', request);
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  const secret = signingSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Payments are not configured on this server.' }, { status: 503 });
  }

  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // Entitlement before anything expensive. The fingerprint is recomputed from
  // the payload rather than trusted from it, so a token minted for one chat
  // cannot generate a report for another.
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
  // `digest`, `people` and `moments` — and until this check existed, those were
  // separate fields the client filled in independently. Declaring a constant
  // fingerprint while swapping the content underneath produced a token that
  // validated against every chat in turn, which is exactly the replay the
  // fingerprint is there to stop.
  //
  // The client already derives both from the same analysis, so agreement costs
  // an honest caller nothing. Checked after the entitlement so a caller with no
  // token learns nothing about the payload rules.
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

  if (excerptChars(payload) > MAX_EXCERPT_CHARS) return payloadTooLarge();

  // Only after the entitlement holds. An unentitled caller learns nothing
  // about how this server is configured, and the check that costs money is
  // never reached by someone who has not passed the check that gates it.
  //
  // With no key configured, return the deterministic report rather than an
  // error: the paid deck is then walkable end to end while the product is
  // being built, and the response says plainly that it is a sample.
  if (!modelConfigured()) {
    // A hand-written report, when one is configured, is closer to the thing
    // being designed for than the deterministic sample is — so it wins, and it
    // is not labelled a demo, because the point of it is to be read as the
    // real output would be.
    const written = loadFixture('premium');
    if (written) {
      const parsed = PremiumSchema.safeParse(written);
      if (!parsed.success) {
        console.error('[premium] fixture failed the schema', parsed.error.issues);
        return NextResponse.json({ error: 'The report fixture is not valid.' }, { status: 500 });
      }
      return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Validated like any other report. A deterministic builder is exactly the
    // thing that looks obviously correct and quietly returns four fewer
    // memories than the schema requires on a chat with no scoreable bursts —
    // which is how the demo deck came back with no memory slides at all.
    const demo = PremiumSchema.safeParse(demoReport(payload));
    if (!demo.success) {
      console.error('[premium] demo report failed its own schema', demo.error.issues);
      return NextResponse.json({ error: 'Could not build your report.' }, { status: 500 });
    }
    return NextResponse.json(demo.data, {
      headers: { 'Cache-Control': 'no-store', 'X-Wrapped-Demo': '1' },
    });
  }

  /*
    This route used to refuse any sender that was not `Person A`, and that check
    is deliberately gone rather than accidentally missing.

    The paid report is now written from real names. It is the only route in the
    product that is — the preview, the detective and the writer all still
    pseudonymise, and all three still enforce it — because a model that has only
    ever seen `Person E` cannot repeat the joke this group makes about somebody's
    name, cannot tell that two nicknames belong to one person, and writes the
    could-be-anyone prose the paid deck was being refunded for.

    What still stands between a chat and this endpoint: the entitlement, which is
    minted per-chat and checked first; the fingerprint agreement check, so a
    token cannot be replayed against different content; the rate limiter; the
    cross-site check; and the excerpt ceiling. `/privacy` §3 states plainly that
    this one request carries names, and the onboarding says so before the reader
    unlocks. If you are adding a *second* route that sends real names, that
    paragraph is the thing to update first.
  */

  const model = modelFor('premium');
  if (!model) {
    console.error(`[premium] ${modelMissingMessage('premium')}`);
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }

  const report = await generateStructured({
    model,
    system: premiumSystem(payload.brief?.tone ?? 'roast'),
    prompt: premiumPrompt(payload),
    schema: PremiumSchema,
    maxTokens: 24000,
    stage: 'premium',
  });

  if (!report.ok) {
    return NextResponse.json(failureBody(report), { status: report.status });
  }

  return NextResponse.json(report.value, { headers: { 'Cache-Control': 'no-store' } });
}
