# Security

Where this app's risk actually sits, what was changed, and the two things that
still need doing in the Vercel dashboard before money is involved.

Read the last two sections before wiring up Stripe. They answer the questions
that decide the architecture: whether you need a database, and where the
entitlement should be minted.

---

## What the review found

Most of it passed, and the parts that passed are the parts that usually fail.

**No secrets are exposed.** Every environment variable is read in server-only
code — `entitlement.ts`, `fixture.ts`, and the four route handlers. There is no
`NEXT_PUBLIC_*` anywhere, so nothing is inlined into the browser bundle. Git
history is clean: `apps/web/.env.example` is the only env file ever committed,
and the `sk-ant-` string in it is the placeholder, not a key. `.gitignore` denies
every `.env` variant and re-allows only the template, which is the right way
round.

**Input handling was already sound.** All four routes validate with Zod before
touching the body. React escapes everything it renders and this codebase has no
HTML sink at all — no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no
`document.write` — so there is no XSS surface to sanitise. There is no database
and no SQL, so there is no injection surface either; your instinct there was
right. The `notes` box is the one field where a user types free text at a model,
and `briefDigest` already scrubs it and `aiPrompt.ts` already fences it as
untrusted.

Four things were wrong. In order of how much they matter:

### 1. The expensive routes had no abuse limit *(fixed, needs config)*

`POST /api/ai-preview` was reachable by anyone, with no gate of any kind, and it
calls Opus 5 at `max_tokens: 16000`. `POST /api/premium` sits behind an
entitlement that `/api/checkout` hands out for free to anyone who asks, then
calls Opus 5 at `max_tokens: 24000`. A twenty-line script in a loop was an
uncapped charge on your Anthropic account.

This is not currently live, because `ANTHROPIC_API_KEY` is not set in the Vercel
project — both routes fall through to the demo path today. **It becomes real the
moment you add that key**, which is the same moment you start charging. See
[Before you set `ANTHROPIC_API_KEY`](#before-you-set-anthropic_api_key).

### 2. The entitlement was bound to nothing that constrained the report *(fixed)*

`verify()` checked the token against `payload.fingerprint`, but the report was
written from `payload.digest`, `payload.people` and `payload.moments` — separate
fields the client filled in independently. Sending a constant `fingerprint`
while swapping the content underneath produced a token that validated against
every chat in turn. The binding that the code's comments described as stopping
replay did not stop it.

Harmless today, since checkout is free. With Stripe live it is one payment for
unlimited reports. `premium/route.ts` now rejects a payload whose declared
fingerprint disagrees with the digest it would be generated from. The client
already derived both from the same analysis, so nothing on the wire changed.

### 3. The per-field caps multiplied into an enormous ceiling *(fixed)*

Each Zod bound looked strict on its own. Together, `moments.max(8)` ×
`messages.max(80)` × `text.max(4000)` was 2.5 MB of text — roughly 640,000
tokens — from a client that normally sends about forty thousand characters. Every
one of those payloads validated. The premium schema was worse, at about 1.2M
tokens.

Array bounds are now tightened to just above what the client actually sends, and
both routes additionally reject on total excerpt characters (`excerptChars` in
`lib/guard.ts`), because bounding the aggregate is the check that does not
decay as the schema grows.

The ceilings were sized against three real exports rather than estimated — a cap
that rejects a genuine chat is a bug wearing a security badge. Measured on the
largest, a 173,319-message group of 18:

| | Largest real payload | Cap | Headroom |
| --- | --- | --- | --- |
| Preview | 5,440 chars | 150,000 | 27× |
| Premium | 15,245 chars | 250,000 | 16× |

So the caps cannot fire for a real user, while still turning a 640,000-token
worst case into a 38,000-token one. The client's own constants
(`MOMENTS_IN_PREVIEW`, `MESSAGES_PER_MOMENT`, `MOMENTS`) now carry comments
naming the route cap they must stay under, since raising one without the other
would turn every real request into a bare "Malformed request."

### 4. No security headers *(fixed)*

No CSP, no framing protection, and `X-Powered-By` advertised the framework
version to anyone scanning. All set in `next.config.mjs`.

---

## What changed

| File | Change |
| --- | --- |
| `lib/rateLimit.ts` | New. Per-IP limits for all four routes, backed by Upstash. No-op with a startup warning when unconfigured. |
| `lib/guard.ts` | New. Cross-site origin refusal and the aggregate payload ceiling. |
| `app/api/*/route.ts` | All four routes call both guards before doing work. |
| `app/api/premium/route.ts` | Fingerprint/digest agreement check (finding 2); tightened array bounds. |
| `app/api/ai-preview/route.ts` | Tightened array bounds; excerpt ceiling. |
| `next.config.mjs` | CSP and security headers; `poweredByHeader: false`. |
| `.env.example` | Documents the two Upstash variables. |

Verified with `next build && next start`: all 88 tests pass, headers are present
on a live response, a cross-origin POST gets 403, a same-origin POST still works,
and the page renders under the CSP with no console violations and no broken
fonts, images, or worker.

### On the rate limiter, and why it is not a `Map`

The obvious no-database approach is an in-memory counter. On Vercel it is close
to useless: each request can land on a fresh serverless instance with a fresh
counter, so an attacker gets a clean bucket most of the time. It would have
looked like protection while providing almost none, which is worse than leaving
it off. The counter has to live somewhere both instances can see.

The limiter **fails open** — if Upstash is unreachable the request is allowed and
the failure is logged loudly. An outage at Upstash should not take your product
down, and the Firewall rule below is still standing in front of it.

### On the origin check, honestly

`crossSite()` refuses a request whose `Origin` header names a different host.
That stops another site driving these routes with a visitor's browser, and it
stops the app being framed and clicked. It does **not** stop `curl -H 'Origin:
…'`, and it is not meant to. Scripted abuse is the rate limiter's job. A missing
`Origin` is allowed rather than refused, because some privacy extensions strip it
and breaking real users to inconvenience an attacker for the ten seconds it takes
to add a header is a bad trade.

### On `script-src 'unsafe-inline'`

The CSP is tight everywhere except script-src, which allows inline scripts. Next
hydration and flight data are inline; the strict alternative is a per-request
nonce, which needs middleware on every route and gives up static rendering. The
trade is defensible here specifically because there is no HTML sink anywhere in
the codebase, so there is no way to get a script tag onto the page for the policy
to have to catch. If that ever changes — the first
`dangerouslySetInnerHTML` — switch to nonces.

`connect-src 'self'` is the directive that matters most: it is the browser
refusing to send a chat anywhere but this origin. It makes the privacy promise a
header rather than only copy.

---

## Before you set `ANTHROPIC_API_KEY`

Two dashboard steps. Do both — they fail differently, which is the point of
having two.

### 1. Vercel Firewall rate-limit rule (free tier, no code)

This rejects at the edge, before a function is invoked, so a flood costs you
nothing at all. Hobby includes **one** rate-limit rule per project (Pro gets 40),
IP-keyed, windows from 10s to 10min, with 1,000,000 allowed requests included.
One rule is enough if you point it at the expensive paths.

Project → **Firewall** → **Configure** → **New** → **Rate Limit**. (The **New**
menu offers Rule, Rate Limit and IP Block; rate limiting is really an *action* on
a rule, so picking **Rate Limit** just opens the rule form with that action
pre-selected. **Rule** gets you to the same place in one more step.)

There is a natural-language box; this description produces the right rule:

> Rate limit requests to /api/ai-preview and /api/premium to 30 per minute per IP

**Which layer is actually limiting you:** the in-code limits are the real
control — 15/hour for the preview, 10/hour for the premium report. The edge rule
is deliberately looser and is there for volumetric floods and for the case where
Upstash is down, since the code limiter fails open. Do not read the edge rule as
your protection; it will almost never fire in normal operation. If you would
rather the edge rule be the primary control, it has to be tighter than the code
limits, and on Hobby you get one rule to spend on that.

Set the action to **Log** first and watch the traffic for a day, then switch it to
**Deny**. Vercel's own docs recommend that order, and it is how you find out you
accidentally matched your own smoke tests.

### 2. Upstash credentials (free tier)

Create a database at [console.upstash.com](https://console.upstash.com), then add
to the Vercel project's environment variables:

```
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Until these are set the app logs `[rateLimit] … per-IP limits are OFF` on first
request and runs unthrottled.

---

## Do you need a database?

Three separate questions that get three different answers.

**For the wrapped itself — no.** Parsing, statistics and moment detection all run
in the browser; the only things that ever leave are anonymised excerpts, and
those are read, forwarded and discarded. Storing anything would weaken the
product's central claim without buying you a feature. Keep it as it is.

**For rate limiting — not a database, but you do need a shared counter.** Upstash
is a key-value store holding per-IP integers that expire on their own. It holds
nothing about your users and nothing you would have to answer for. The Vercel
Firewall rule needs nothing at all.

**For charging people — Stripe is your record.** You do not need a payments
table, an orders table, or a users table. Stripe already stores the customer, the
payment, the receipt and the refund, and its dashboard is a better admin panel
than one you would build. What you *do* need is one small thing, below.

---

## When you wire up Stripe

The existing comments claim adding Stripe is "a change to this file only." That
is nearly true, and the part that isn't is the part that matters.

**Mint on the verified session, not on a webhook.** A webhook fires
out-of-band, so the browser has no way to receive the token without polling
something — which would force you to build the store you are trying to avoid.
Instead:

1. `/api/checkout` creates a Stripe Checkout Session and **puts the chat
   fingerprint in the session's `metadata`**. This is the load-bearing step. The
   fingerprint has to travel with the payment, not alongside it.
2. `success_url` returns to your app with `{CHECKOUT_SESSION_ID}`.
3. A new route retrieves the session server-side, checks
   `payment_status === 'paid'`, and mints for `session.metadata.chat` — **never
   for a fingerprint the client sends back**. Trusting the client's copy at that
   step re-opens finding 2 by a different door.

**The one thing that needs storage: single-use tokens.** A minted entitlement is
currently valid for its full 15-minute TTL and can be presented repeatedly. Today
that is free anyway. Once it represents a payment, it is N reports for one
purchase. Add a `jti` to the claims in `entitlement.ts` and record it in Upstash
with a 15-minute TTL when it is redeemed; refuse a `jti` already present. You
will already have Upstash for rate limiting, so this costs nothing extra. The
same marker on the Stripe session id stops a `success_url` being replayed.

**Keep `WRAPPED_PAYMENTS_LIVE`.** The 501 it triggers is a good failsafe — it
means a half-finished deploy refuses to hand out reports rather than quietly
giving them away. Set it the moment real payments exist.

---

## Known and accepted

**`npm audit` is clean** — 0 vulnerabilities, on Next 16.

Three high-severity advisories arrived transitively through `next@15`: `postcss`
source-map disclosure, and `sharp` inheriting four libvips CVEs. Next 16 ships
patched versions of both, so the upgrade is the fix and no `overrides` block is
needed. If you ever need to solve this without a major upgrade, root `overrides`
pinning `postcss` and `sharp` also works — but note that **npm ignores overrides
while a stale `node_modules` exists**. Editing `package.json` and reinstalling,
even after deleting `package-lock.json`, changes nothing; only removing
`node_modules` outright makes npm re-resolve. An override that appears to do
nothing is usually this, not an override that cannot work.

### The Next 16 upgrade

Almost none of Next 16's breaking changes touch this app: there is no
`middleware`, no `next/image`, no dynamic route params, no `cookies()`/`headers()`,
no `next lint`, no custom webpack config, no parallel routes, and no
`scroll-behavior: smooth` on `<html>`. So the upgrade was `next`, `react`,
`react-dom` and the React types, plus `engines.node` to `>=20.9` to match Next
16's floor.

The real risk was **Turbopack**, which is the default builder in 16. Three things
in this app are exactly what a bundler swap breaks, so each was verified running,
not just compiling:

| | How it was checked |
| --- | --- |
| The analyzer Web Worker | Ran a real 1.3 MB export through the UI — parsed, found all 5 people with correct per-person counts, identified the unnamed phone number, Hebrew names intact |
| `@resvg/resvg-js` native addon + `outputFileTracingIncludes` | `POST /api/share-card` returned a valid 213 KB PNG with Hebrew rendered right-to-left and the emoji SVG drawn from `assets/emoji` |
| The security headers and guards | All five headers present on a live response, `X-Powered-By` absent, cross-origin POST still 403 |

Plus typecheck clean, 136 tests passing, and a successful production build.

**Client-side zip handling** caps input at 400 MB and only inflates the `.txt`
entry. A zip bomb here costs the attacker their own tab; nothing reaches your
server. Not a server-side risk.

**The pseudonymiser catches WhatsApp display names, not invented nicknames.**
`anonymize.ts` says so, and the landing copy is written to match. Keep those two
in sync — the honesty of the claim is doing real work.
