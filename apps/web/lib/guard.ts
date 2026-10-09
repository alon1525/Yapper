/**
 * Two cheap checks that run before any route does work.
 *
 * Neither is a substitute for the rate limiter — both are trivially bypassed by
 * anyone writing a script on purpose, and they are here for the cases below
 * that, which are the common ones.
 */

/**
 * Refuses a request that a *browser* made from somewhere that is not this site.
 *
 * What it stops: another page calling these routes with a logged-in visitor's
 * browser, and someone embedding the app and driving it from a frame. Browsers
 * attach `Origin` to every POST and cannot be talked out of it from script, so
 * a mismatch here is definitive.
 *
 * What it does NOT stop: `curl -H 'Origin: https://…'`. That is deliberate —
 * scripted abuse is the rate limiter's job, and pretending otherwise would be
 * the false-confidence version of this check.
 *
 * A *missing* Origin is allowed rather than refused. Some privacy extensions
 * and proxies strip it, and refusing would break real people to inconvenience
 * an attacker for the length of time it takes to add one header.
 */
export function crossSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const host = request.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    // An Origin that is not a URL is not something a browser sends.
    return true;
  }
}

export function forbiddenCrossSite(): Response {
  return new Response(JSON.stringify({ error: 'Cross-site requests are not allowed.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Total characters of chat excerpt in a payload.
 *
 * The per-field caps in each route's schema are individually sensible and
 * collectively enormous: 8 moments × 80 messages × 4,000 characters is 2.5 MB
 * of text, roughly 640,000 tokens, from a client that normally sends about
 * forty thousand characters. Every one of those payloads validates. Multiplying
 * the maxima is how a schema that looks strict funds someone else's afternoon,
 * so the aggregate gets its own ceiling.
 */
export function excerptChars(payload: {
  brief?: { notes: string };
  /** The preview and premium routes carry scored windows. */
  moments?: { messages: { text: string }[] }[];
  /** The detective route carries segmented conversations instead. */
  conversations?: { messages: { text: string }[] }[];
  /** The writer route carries verified quotes per slide. */
  evidence?: Record<string, { text: string }[]>;
  /** …and a spread of each person's own messages, so it can hear them talk. */
  voiceSamples?: Record<string, { text: string }[]>;
  /* Optional because each route's `people` rows differ. The premium payload is
     the one that carries quoted message text per person — a spread of their own
     lines, and historically a single longest message.

     `sender` is required and unread, which is deliberate on both counts. It is
     the one field every route's person row genuinely shares, and without a
     required property this is a weak type: an argument whose properties are all
     optional and none of which match is rejected outright, so the detective's
     rows — which carry neither quoted field — stopped compiling. An index
     signature would also solve it, and did, until it turned out to demand one
     on the *argument* too, which an `interface` never has implicitly; that left
     `PremiumPayload` unable to be passed to the function measuring it. */
  people?: { sender: string; longestMessage?: string | null; samples?: { text: string }[] }[];
}): number {
  let total = payload.brief?.notes.length ?? 0;

  // Every text-bearing collection, not just the one the first route happened to
  // have. A new payload shape whose excerpts this function does not know about
  // is a route with no aggregate ceiling at all — the per-field caps would let
  // it through and the bill would be the first anyone heard of it.
  for (const group of [payload.moments, payload.conversations]) {
    for (const window of group ?? []) {
      for (const message of window.messages) total += message.text.length;
    }
  }
  for (const group of [payload.evidence, payload.voiceSamples]) {
    for (const messages of Object.values(group ?? {})) {
      for (const message of messages) total += message.text.length;
    }
  }
  for (const person of payload.people ?? []) {
    total += person.longestMessage?.length ?? 0;
    // The per-person spread is the section the paid payload deliberately grew.
    // Leaving it uncounted would mean the aggregate ceiling stopped covering
    // the largest thing under it, which is the exact failure this function
    // exists to prevent.
    for (const sample of person.samples ?? []) total += sample.text.length;
  }
  return total;
}

export function payloadTooLarge(): Response {
  return new Response(JSON.stringify({ error: 'That request is too large to process.' }), {
    status: 413,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
