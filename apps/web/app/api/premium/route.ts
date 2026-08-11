import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REPORT_LANGUAGE_CODES } from '@/lib/languages';
import { demoReport } from '@/lib/demoReport';
import { chatFingerprint, signingSecret, verify } from '@/lib/entitlement';
import { loadFixture } from '@/lib/fixture';
import { generateStructured } from '@/lib/generate';
import { modelConfigured, modelFor, modelMissingMessage } from '@/lib/providers';
import { crossSite, excerptChars, forbiddenCrossSite, payloadTooLarge } from '@/lib/guard';
import { PREMIUM_SYSTEM, PremiumSchema, premiumPrompt } from '@/lib/premiumPrompt';
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
export const maxDuration = 120;


const SENDER_TOKEN = /^Person [A-Z]+$/;

/**
 * Ceiling on excerpt text per request. `buildPremiumPayload` sends twelve
 * moments of thirty messages plus one long message per person — well under
 * this. The array bounds alone would allow more than a million tokens through,
 * which no valid client would ever send and no bill should ever have to cover.
 */
const MAX_EXCERPT_CHARS = 250_000;

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
        sender: z.string().max(40),
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
        longestMessage: z.string().max(600).nullable(),
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
              sender: z.string().max(40),
              time: z.string().max(10),
              date: z.string().max(12),
              text: z.string().max(4000),
              edited: z.boolean().optional(),
            }),
          )
          .max(40),
      }),
    )
    .max(14),
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

  // Defence in depth, extended to cover the per-person section — which the
  // preview route never had, and which carries names in more places than the
  // moment excerpts do.
  for (const person of payload.people) {
    if (!SENDER_TOKEN.test(person.sender)) {
      return NextResponse.json(
        { error: 'Request rejected: people must be anonymised before sending.' },
        { status: 400 },
      );
    }
  }
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

  const model = modelFor('premium');
  if (!model) {
    console.error(`[premium] ${modelMissingMessage('premium')}`);
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }

  const report = await generateStructured({
    model,
    system: PREMIUM_SYSTEM,
    prompt: premiumPrompt(payload),
    schema: PremiumSchema,
    maxTokens: 24000,
    stage: 'premium',
  });

  if (!report.ok) {
    return NextResponse.json({ error: report.error }, { status: report.status });
  }

  return NextResponse.json(report.value, { headers: { 'Cache-Control': 'no-store' } });
}
