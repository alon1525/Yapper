# Yapped

Drop in a WhatsApp export and get your group chat back as a story: the top
yapper, the certified ghost, the night it all went sideways, and awards nobody
asked for.

Every statistic is computed **in your browser**. AI is optional and
consent-gated. The free writing only ever sees an anonymised copy; the paid
report is the one exception, and it says so at the till. Nothing is stored —
close the tab and it is gone.

```
packages/core   Pure TypeScript engine — parse, stats, sessions, patterns,
                planning, verification, anonymise. Zero DOM dependencies, so a
                future Expo app can import it as-is.
apps/web        Next.js app. The landing page, the deck, a Web Worker, and the
                server routes.
```

## Running it

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in the signing secret
npm run dev                                    # http://localhost:3000
npm test                                       # 160 unit tests across both workspaces
```

Nothing in `.env.local` is required to see the app — the landing page, the
sample story and every statistics slide work with an empty file. See
[`apps/web/.env.example`](apps/web/.env.example) for what each variable buys
you; the short version:

| Variable | Without it |
|---|---|
| `WRAPPED_SIGNING_SECRET` | Premium unlock 503s. Set any random 16+ char string. |
| `ANTHROPIC_API_KEY` | AI slide unavailable; the detective returns no findings, so the deck is its deterministic half — every statistic slide, no discovered ones. |

Model choice per stage is configurable, because the two stages want different
things: the detective reads a great deal and returns a little structured output,
while the comedy pass reads little and writes the thing people actually see. If
only one gets the expensive model it should be the second.

| Variable | Stage | Default |
|---|---|---|
| `WRAPPED_AI_MODEL` | free preview | `claude-opus-5` |
| `WRAPPED_DETECTIVE_MODEL` | investigation | `claude-opus-5` |
| `WRAPPED_WRITER_MODEL` | comedy | `claude-opus-5` |
| `WRAPPED_PREMIUM_MODEL` | legacy single-shot report | `claude-opus-5` |

## The shape of it

**Landing → onboarding → deck.** The whole flow is one page and one component
tree. Routing between pages would mean serialising the conversation into storage
somewhere, and *your chat never leaves your device* is easier to keep true when
there is nowhere for it to be left behind.

The onboarding is seven steps and it takes the page rather than floating above
it — a modal is a detour from whatever you were reading, and this is the thing
you came to do:

```
lang    Which language should Reg write in?   (not the chat's language — the report's)
kind    What kind of chat is this?            (sets the register of the roast)
notes   Anything Reg should know?             (optional, scrubbed before it is sent)
upload  Export the chat, then drop it here
scan    Reading, on the device                (real message count, real progress)
people  Who is who?                           (rename, identify numbers, merge duplicates)
photos  Give it faces                         (optional, never leaves the browser)
```

The three steps the analyzer owns — scan, people, and the transition out of
upload — are **derived from the analyzer**, never stored separately, so there is
one answer to "what is happening" rather than two that can drift apart. The
reader's answers are one `Brief` value (`lib/brief.ts`), held in `Experience`
because it is written by a screen that unmounts before the deck that reads it.

**The parse always stops to ask who is who.** Two things are invisible in the
statistics and unfixable after them: an export names anyone missing from the
exporter's address book by phone number only, and a contact renamed partway
through a nine-year group sits on the leaderboard twice with half their messages
each. `suggestMerges` proposes the pairs — same name modulo punctuation, and it
says *renamed 2019* rather than *overlapping activity* when the two people's
active windows do not overlap — but only the reader can confirm them. The step
appears for every chat, including the ones with nothing to fix: a step that
shows up for some chats and not others is a step nobody trusts.

A merge is expressed as two names aliased to one. There is no separate merge
path, because "these two rows are the same person" and "this row is called
something else" are the same edit as far as the messages are concerned.

### Design system

The landing is parchment and editorial — Instrument Serif at poster size, Space
Grotesk for copy, DM Mono for numbers. The deck is the opposite: flat,
saturated, full-bleed colour with Anton for display and Heebo 900 for Hebrew
names.

Ten grounds rotate through the deck, sequenced so consecutive slides never
share one. **No card component names a colour.** `Slide` sets `color` and three
custom properties — `--slide-accent`, `--slide-on-accent`, `--slide-panel` —
and everything below inherits. That is what lets identical markup sit on lime
and on navy without a second look, and it is enforced by a grep: zero hits for
hardcoded colour classes anywhere under `components/cards/` except the palette
itself.

Every pair in that palette clears WCAG AA (4.5:1 body, 3:1 accent). Two of the
source design's colours did not and were adjusted: `#FF2E2E` behind body copy
is 3.4:1, and the ember `#C2571F` under white button text is 4.2:1. Both are
fine at poster size in the original and unreadable at 15px here.

### Photos

Optional, local, and never sent. Four slides can take a full-bleed photo and
every member can have a face; both are object URLs pointing at bytes the browser
already holds, revoked when the reader starts over. No payload builder reads
them and neither AI route accepts an image — leaving the field out of the
payload type is a stronger guarantee than remembering not to fill it in.

The grading is the whole trick. A photograph is the loudest thing that can be
put on a page, and the deck is flat grounds with one idea per screen — so the
photo is desaturated, dropped to roughly a third, and buried under two layers of
the slide's *own* ground. The first version graded each photo into its slide's
hue and left the luminance alone, which looked right on a 120px preview tile and
made the opener's headline unreadable at full size. Detail behind type is the
problem, not colour.

The onboarding's preview tiles and the deck read the same `photoLayers()` and
the same slot→ground table, because a photo that looks one way while you are
choosing it and another way in the story is a bug the reader has no way to
report. That table lives in `cards/photos.tsx` and the slides import their
backdrop *from* it; pointing that arrow the other way produced a real circular
import and a 500 on the whole page.

A missing photo renders nothing at all — no initials disc, no placeholder ring.
Most decks will not have photos, and a fallback avatar means adding a circle to
every slide of every chat to serve the ones that filled the step in.

### Sound

`lib/useStorySound.ts` — a four-oscillator drone through a slowly-sweeping
lowpass, plus one square-wave sting per slide, walking a scale so consecutive
slides never repeat a pitch. Synthesised rather than loaded: a few hundred
bytes of code against a few hundred kilobytes of audio, on a product whose
whole promise is that nothing gets downloaded. It works offline.

The same hook drives the sample story on the landing page and the reader's own
deck, so the two sound identical — the landing page is a promise about what the
deck will be. An `AudioContext` is only ever constructed inside a click
handler; one created outside a gesture stays suspended forever with no error to
tell you why.

## Testing against a real export

Synthetic fixtures cannot catch what actually breaks a parser — locale-specific
date order, invisible characters, dialects of system notice. Real exports are
private data and are never committed, so that suite is opt-in:

```bash
WRAPPED_REAL_EXPORT="/path/to/WhatsApp Chat with X.txt" npm test
```

It asserts the invariant that matters: **every line in the file is classified as
exactly one of header / continuation / orphan, with zero orphans.** WhatsApp
exposes no message count to compare against, so this is the check that catches
a parser bug.

## How the report is built

The report is a pipeline, not a prompt. The thing it is trying not to be is a
dashboard, and the thing that stops it being one is that **no stage both
discovers a fact and jokes about it**.

```
1  statistics        deterministic          parse → stats → phrases, interactions,
                                            commitments, stalled plans
2  segmentation      deterministic          the chat cut into conversations
3  candidates        deterministic          scored, ranked, capped
4  detective         model, structured      findings + message ids. No jokes.
5  verification      deterministic, local   every claim checked against the real
                                            messages. Rejects.
6  planning          deterministic          which slides this group has earned
7  comedy            model, structured      copy only. Cannot introduce a number.
8  quality control   deterministic, local   invented figures, banned phrasing,
                                            length, duplicates
```

Stages 5 and 8 run **in the browser**, and that is not where they ended up by
convenience. The server was only ever sent an anonymised excerpt, so the server
cannot tell a quote that was said from one that was invented. The browser still
holds every message the excerpt was cut from, so it can — and it is the browser
that throws findings away.

**Message ids are the spine.** `AnonymizedMessage` carries `Message.id`, the
prompt renders every line as `m1234 [2023-03-14 10:42] Person A: …`, and the
model is told — truthfully — that a program checks each citation and discards
what does not match. An id is an index into an array the model never sees, so it
identifies nobody; without it, `evidence_message_ids` is decoration and every
stage after stage 4 is unverifiable. The property that makes this work is that
`applyAliases` rewrites the sender field in place and preserves order, so an id
collected before the reader renamed anybody still points at the same message
after.

**The writer is never asked for a figure.** Statistics are computed in
TypeScript and handed to it as the only numbers it may use; `verifySlideCopy`
rejects any figure in the prose that is not in that list, not in a verified
quote, and not small enough to be rhetoric. "Never state a statistic, interpret
it" was already the instruction — this is the version that is enforced rather
than requested.

**The planner's real job is saying no.** Every guaranteed slide declares the
condition under which it earns its place, and the ones that fail are dropped
with a recorded reason. A night-owl slide in a group that keeps one schedule, a
leaderboard where nobody is ahead, a reply-time slide on an export that only
records minutes — each is true, and each is a rounding error with a name on it.
`plan.suppressed` keeps the list, because "why is there no ghost slide" has a
better answer than the slide would have been.

**Verification repairs before it rejects.** A model reading a forty-line window
routinely attaches the right quote to the id one row above it. That is a
clerical slip, not an invention, so a quote is searched for in the finding's own
evidence and a four-message neighbourhood, and repaired to the true speaker and
date. Widened past that it would stop being repair and start laundering
fabrications into verified quotes, which is why the radius is small and tested.

### What a text export does not contain

Stated here because the obvious assumption is wrong in both cases. WhatsApp `.txt`
exports carry **no reply metadata and no reactions** — both exist in the app and
neither is written to the file. So there is no `reactions` field anywhere in this
codebase, and what can be recovered from adjacency is named `inferredReplies`
rather than `replies`. A field that is structurally always empty is worse than an
absent one.

Edited messages *are* recoverable — WhatsApp appends `<This message was edited>`
— and the marker is stripped from the body rather than left in it. Left in, it
lands in the word counts, wins "longest message" for anyone who edits, and,
because it is written in the phone's UI language, turns "edited" into one of the
group's most-used words.

### `\b` does not work in Hebrew

JavaScript defines `\b` on `[A-Za-z0-9_]`, so it never fires between two Hebrew
letters. `/\bמתי\b/` is not a stricter match — it is a match that cannot
succeed. Written the obvious way, every Hebrew pattern in the commitment,
question, plan and conflict lexicons silently found nothing: no error, no
warning, just a Hebrew group getting an empty report section. They all use
letter/digit lookarounds and the glued single-letter prefixes instead, exactly
as the pseudonymiser does. A test caught this; nothing else would have.

## Things that are true and non-obvious

**Timezones.** WhatsApp writes timestamps in the exporter's local time with no
offset. Building a `Date` makes the runtime reinterpret them in *its* timezone,
silently shifting the whole hour histogram — Night Owl and Early Bird break by
however many hours apart they are. The parser carries `localHour` / `localDay` /
`localMonth` as integers lifted verbatim from the text, and those are the only
source for any calendar-facing statistic. `ts` is for ordering and gap
arithmetic only.

**Day/month order.** `4/15/17` is decidable; `01/02/17` is not. Resolution is
three-stage: any day-part above 12 settles it outright; otherwise the reading
that keeps the file chronologically monotonic wins; otherwise it falls back and
reports `dateOrderConfidence: 'assumed'` so the UI can offer a toggle.

**Real exports are not sorted.** The end-to-end-encryption notice carries the
*export* date, so it can sit at the top dated years after the first message, and
same-minute messages from different devices land in delivery order. A real
173k-message export shows ~35 backwards steps. Every gap calculation tolerates
this; nothing assumes monotonicity.

**Zero-width joiner is load-bearing.** U+200D sits inside the invisible-character
block that gets stripped from every line, but it is what binds 👨‍💻 and family
emoji into single glyphs. Stripping it shatters them and inflates every emoji
statistic. It is excluded by name.

**System-notice language ≠ chat language.** WhatsApp writes system notices in the
phone's UI language and messages in whatever the group speaks. A Hebrew group on
an English phone produces English "Messages and calls are end-to-end encrypted"
around Hebrew messages, so the two are detected independently.

**Text direction is per-string, not per-page.** Forcing `dir="rtl"` on the deck
reorders English UI copy around embedded numbers — "54,162 messages" renders
with the number displaced and the full stop on the wrong end. Every text node
uses `dir="auto"` instead, so English copy stays LTR and Hebrew names render RTL
even in the same sentence.

**Anton ships no Hebrew glyphs.** A headline is usually a participant's name, so
the display component checks for Hebrew and switches to Heebo 900 rather than
letting the browser fall back to whatever the system happens to have.

**A CSS animation creates a stacking context.** Every slide animates in with a
transform, which means a `z-index` on a button *inside* a slide cannot lift it
above a sibling overlay — the whole slide has to be raised instead. This is why
the sample story's final-slide buttons looked live and were not.

**Satori needs static fonts.** Variable fonts fail with an opaque
`Cannot read properties of undefined`. `apps/web/assets/fonts` holds static cuts
on purpose. Emoji are in neither font, so ~50 common ones are vendored as SVGs
in `assets/emoji` and read from disk — *not* fetched from a CDN, because
rendering a card is something a free user does and an outbound request carrying
an emoji from their chat would break the privacy claim for the sake of one
glyph. An emoji that is not vendored is dropped from the card.

Both directories are named in `outputFileTracingIncludes`. They sit outside
`public/` and outside the module graph, so without that the route works in
`next dev` and 500s in production.

**The report's language is not the chat's language.** Detection answers "what
language is this group speaking", which drives stopwords and layout. The
onboarding asks a different question — what language should the report be in —
and a Hebrew group asking for English is asking for something they can send to
someone who does not read Hebrew. The brief's answer wins in both prompts;
detection is only the fallback when there is no brief.

## Tiers and the paywall

| Tier | What the reader gets |
|---|---|
| Free | Every statistic slide, plus **one** AI memory — the hook. |
| Premium | 4–6 memories, a character card for **every** member, an awards list, a line per year, a closing paragraph. |

Premium is gated on **generation, not display**. `/api/premium` writes nothing
without a valid entitlement, so the paid slides do not exist anywhere the
browser could reach them — a blurred overlay would be one devtools click from
being free.

`/api/checkout` is where Stripe goes. Today it mints an entitlement for anyone
who asks; it exists in this shape so that adding Stripe is a change to that one
file. The token is HMAC-signed and **bound to a fingerprint of the chat**, so a
token bought for a twelve-message test chat cannot be replayed against a
170k-message export — which is the replay that would actually cost money.
`WRAPPED_SIGNING_SECRET` is required; without it checkout 503s rather than
signing with an empty string and validating every forgery ever presented.

The paywall slide says, in as many words, that no payment is set up and the
unlock is free while the product is being built. A free unlock that looks like a
purchase is the kind of thing people screenshot for the wrong reasons.

**Character cards are built from distinctive words** — the words one person uses
far more than the rest of the group, by share not by count. Plain "top words"
produces the same list for everyone in a group and therefore the same card;
the ratio is what makes a card impossible to swap with someone else's.

## Testing the AI without paying for it

```bash
npx vite-node scripts/ai-dry-run.ts -- "<export.txt>" <outDir>   # builds all three prompts, gates all three
npx vite-node scripts/ai-restore.ts -- <mapping.json> <reply.json>
npx vite-node scripts/premium-restore.ts -- <mapping.json> <report.json>
```

`ai-dry-run` writes the literal bytes a model would receive and fails if any
participant name survives in them. That is a stronger check than watching the
network tab, because it inspects payload *contents* rather than request counts —
including the fields `anonymizeMessages` never touches: moment ids, scoring
reasons, per-person vocabulary, quoted longest messages.

Boundaries matter in both directions. A raw substring search flags `תומר` inside
`מזתומרת` ("what do you mean") and reports a leak where there is none, so the
check uses the same letter/digit lookarounds the scrubber uses.

## Privacy model

Three tiers, and the code is arranged so the claim is structurally true rather
than a promise:

| Tier | What leaves the device |
|---|---|
| Free | Nothing. Parse, stats and moment detection all run in a Web Worker. |
| AI preview | Opt-in only. An anonymised digest, the top few conversation windows, and the brief. |
| Premium | Opt-in, entitlement-gated, and **the one tier that sends real names**. A few thousand messages: the top conversations, at least one window per year, and a spread of each person's own lines, plus a per-person digest. |

**The detective payload is the widest surface in the product**, and nearly every
field on it is *derived from* message bodies rather than quoted from them —
which is the category the note on distinctive words already flags as the
likeliest leak. Repeated n-grams are worse than single words: a two- or
three-word phrase carries a nickname far more often than one word does, and
"phrases this group repeats" is a metric built to surface exactly the language
outsiders would not understand. Session keywords, session summaries,
stalled-plan topics and signature phrases are all in the same category. Every
one goes through `scrub()` in the payload builder, and `ai-dry-run` walks all of
them — the gate inspects payload *contents*, so a new field that skips the
scrubber fails the gate rather than shipping.

**Message ids leave the device and that is fine.** An id is an index into the
reader's own message array. It resolves to a message only for the browser that
produced it, and it is what makes every claim in the report checkable.

**Dates leave the device now, and that is a deliberate reversal.** They used to
be withheld — `anonymizeMessages` carried the time of day and no calendar. A
dated report is most of what the product is for: "May 2023: everyone believed
the trip was happening" is the nostalgia slide, and a prophecy that aged badly
cannot be told without knowing when it was made. Withholding the date did not
stop a model writing those; it made it guess, and a confidently wrong date is
worse than none. The payload already carried the span label, the busiest day and
a per-year breakdown, and the message text is far more identifying than the day
it was sent on. What is still withheld is the name.

**The notes box is the one field the reader types names *at* the model.**
Everywhere else names arrive through `anonymizeMessages`; here somebody writes
"תמיר never replies because he works nights" directly into a prompt. So the
brief goes through `briefDigest()`, which runs the same `scrub()` as any message
body — the tokens in the notes then match the tokens in the excerpts, which is
both the private answer and the useful one, since Reg's reply restores cleanly.
`scripts/ai-dry-run.ts` builds a deliberately hostile brief naming every
participant in the export and fails the same gate as everything else. Notes are
also fenced in the prompt and framed as untrusted: it is a box marked "anything
Reg should know", and people type instructions into those.

**The paid report is deliberately outside all of this.** `/api/premium` sends
real display names, as senders and inside message bodies, and sends roughly ten
times the material the free tier does. That is not an oversight in the scrubber;
it is the fix for a paid deck that read like a horoscope. A model shown only
`Person E` cannot repeat the joke a group makes about somebody's name, cannot
tell that two nicknames are one person, and writes copy that would fit any group
chat. `scripts/ai-dry-run.ts` asserts the *presence* of names on that payload for
the same reason it asserts their absence everywhere else — a premium payload that
comes back anonymised means the pseudonymiser has crept back in, and that failure
is silent. Privacy §3(b) and the unlock screen both state it before anyone pays.

Anonymisation, for the three free AI routes, replaces senders with `Person A`,
then sweeps message bodies for
those same display names, phone numbers and emails — because people address each
other by name constantly, and redacting only the sender column would leak every
name anyway. Hebrew glues prepositions onto names (`לנדב`, `ונדב`), so those are
handled too. Names are mapped back **in the browser**; the server never holds the
mapping. `/api/ai-preview` additionally rejects any payload whose senders are not
already tokens, so the guarantee does not depend on client code being correct.

**Unsaved contacts cannot be named from the file.** An export writes whatever
the exporting phone's address book knew, so anyone not saved appears as
`+972 58-666-8048` everywhere. The `~push name` WhatsApp shows in the app is
*not* in the export — it is profile data fetched live from WhatsApp's servers.
Checked against a real export: the only system notices naming an unsaved member
read `+972 58-666-8048 left`. There is nothing to recover and no inference to
make, so the app asks, once, before the deck opens.

A name given there is applied to the parsed messages rather than at render time.
That matters for more than tidiness: the pseudonymiser builds its scrub list
from the participant names, so a name the user supplies is also redacted from
message bodies — including Hebrew's glued prefixes. Verified end to end:
`נדב מה קורה` became `Person C מה קורה`, and `אמרתי לנדב` became
`אמרתי לPerson C`. Filling that box in makes the result more private, not less.

**What redaction cannot reach:** only WhatsApp *display names* are derivable from
an export. Groups address each other by invented nicknames that appear nowhere in
the participant list, and no regex recovers those. The landing copy must not
claim otherwise — and the notes box is where the reader can hand them over
deliberately, which is most of what it is for.

This is the normal case, not an edge case. In the real export used to build this,
the participant list reads `בבלי`, `פקולה`, `גבוה`, `Turtle` — while inside the
messages the same people are called רועי, דניאל, נדב and פאבו. Every one of those
reaches the model. The consent slide says so in as many words.

**Redaction over-fires too, and that is the right trade.** A display name that is
also an ordinary word — `שחר` (dawn), `דוד` (uncle) — gets replaced wherever it
appears standing alone, so `הוד השרון` came back as `הוד הPerson O`. Corrupting a
place name is the acceptable failure; leaking a person is not.

**A Zalgo message wins "longest message".** Stacked combining marks inflate
`.length` without adding visible text, so several hundred characters of noise won
that title for one person and were bought as prompt tokens. Runs of marks are
collapsed before quoting.

**A disabled button is not a guard.** `disabled={sending}` applies on the next
render, so three taps inside one tick all pass the check and all reach the API.
Verified against a stubbed route: three billed requests. Both paid paths hold the
guard in a ref instead, which closes synchronously.

## Not built yet

**The legacy single-shot path is still in the tree and no longer wired up.**
`/api/premium`, `lib/premiumPayload.ts`, `lib/premiumPrompt.ts`,
`lib/usePremium.ts` and `cards/PremiumSlides.tsx` still work and are still
gated, tested and dry-run-able; the deck now runs the staged pipeline instead.
They are kept because `scripts/premium-restore.ts` and the fixture path depend
on them, and deleting a working paid route in the same change that adds two new
ones is one rollback away from having neither.



Stripe itself (the seam is built — `/api/checkout` mints without charging) ·
video / TikTok export · AI photo memories (photos are collected and rendered
locally; no model ever sees one) · photos on the premium character cards and the
share card · voice notes · share links · HD download · premium share cards ·
translated Hebrew UI copy (layout is RTL-safe, the strings are still English) ·
a display name that is a phone number is shown verbatim on its character card ·
photos are not carried across a restart, by design — nothing is stored.
