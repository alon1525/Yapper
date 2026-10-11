# Pipeline audit — first real-export run

Run on a real 25,812-message Hebrew export (8 people, Oct 2020 – Jul 2026) through the
full eight stages. Deterministic stages are the product's own code; the two model stages
were run once as Opus and once as Sonnet on byte-identical prompts.

Repro for everything below:

```
npx vite-node scripts/demo-run.ts -- prompt <export.txt> <dir>
npx vite-node scripts/demo-run.ts -- verify <export.txt> <dir> <findings.json>
npx vite-node scripts/demo-run.ts -- check  <export.txt> <dir> <findings.json> <written.json>
npx vite-node scripts/demo-leak.ts -- <export.txt>
```

---

## 1. Real participant names leave the device — `plan.ts:481`

**Severity: high.** This is the one privacy guarantee the product makes.

`planDeck` builds the `stat-signatures` slide from `phrases.signatures`:

```ts
stats: signatures.map((s) => ({ label: token(s.owner), value: s.phrase })),
```

`token(s.owner)` scrubs the owner. `s.phrase` is **never scrubbed**. Because this group
@-mentions each other constantly, several people's most distinctive bigrams *are other
people's names*. On this export the outgoing payload contained:

```
briefs["stat-signatures"].stats[].value = "turtle שמלצר"
briefs["stat-signatures"].stats[].value = "אלון שמלצר"
briefs["stat-signatures"].stats[].value = "turtle אלון"
```

`useReport.ts:176` sends `plan.briefs` to `/api/write` unmodified, and
`gatePaidRequest` only token-checks `briefs[].people` and quote senders — never
`briefs[].stats[].value`. So the server-side guard passes and three real names reach
the model in the prompt.

`scripts/demo-leak.ts` demonstrates this in the guard's own terms.

**Fix:** thread the scrubber into `planDeck` and apply it to every stat value, and add
`briefs[].stats[].value` to the `senders` array in `apps/web/app/api/write/route.ts:103`
so the server refuses the request if the client ever regresses.

## 2. The scrubber misses name variants

Two classes, both live on this export:

- **Emoji-suffixed display names.** Person H's participant name is `ליאת🕎`. The scrub
  matches the full string, so a plain `ליאת` in a message body passes through. It reached
  the writer prompt in a verified quote.
- **Nicknames and truncations.** `שמלצר` is regularly shortened to `שמלץ` (4 times in this
  export). `שמלץ` reached the detective prompt.

`scripts/ai-dry-run.ts` reports "leaked names none" for both, because it only searches for
exact participant names.

**Fix:** scrub on a normalised form (strip emoji/marks, match on the longest name token),
and widen the dry-run's leak check to the same normalised form so it stops reporting clean.

## 3. ISO dates are read as phone numbers — `verify.ts:126`

```
PHONE_RE.test('2021-08-09')       // true
LONG_DIGITS_RE.test('2021-08-09') // true
```

Both regexes match a bare `YYYY-MM-DD`. The detective prompt presents every date in that
form, so a model that echoes one into `detail` gets its finding rejected outright with
`sensitive-data`.

**This is not hypothetical: Opus and Sonnet independently produced the same finding about
Person B's arrival announcements, and both lost it to this regex.** It was one of the
strongest findings in either set.

**Fix:** exclude ISO dates before the identifier test, or require a phone-like context
(leading `+`, or no `-` in `YYYY-MM-DD` positions).

## 4. The `\n` join fabricates phone numbers — `verify.ts:538`

```ts
const prose = [slide.title, slide.subtitle, slide.body].join('\n');
```

`PHONE_RE` and `LONG_DIGITS_RE` both treat `\n` as a separator (`[\s.-]`, `[\d\s-]`), so a
number at the end of the subtitle and a number at the start of the body are read as one
long digit run:

```
subtitle "Oct 2020 – Jul 2026" + body "25812 הודעות..."  ->  "2026\n25812"  ->  rejected
```

That killed **the opening slide of the deck** on this run. The shape it punishes —
subtitle ends in a year, body opens with a count — is the single most common shape in the
deck.

**Fix:** run the identifier tests per field rather than on the joined string.

## 5. Timeline slides forbid their own axis — `verify.ts:527`

`allowed` is built from `stat.value` only:

```ts
for (const stat of slide.stats) {
  if (typeof stat.value === 'number') allowed.add(stat.value);
  else for (const n of numbersIn(stat.value)) allowed.add(n);
}
```

The timeline slide's stats are `{ label: "2021-04", value: 869 }`. The years live in the
**label**, which is never parsed — but the writer prompt prints `2021-04: 869` under "the
only figures you may use on this slide", and the planner assigned the slide the `timeline`
format, whose whole job is dated beats. Any writer that uses the years is rejected for
`invented-number`; any writer that obeys cannot write a timeline.

**Fix:** add `numbersIn(stat.label)` to `allowed`.

## 6. The writer is never asked for the one field the dictionary verifier requires

`verifyDictionary` (`verify.ts:628`) hard-rejects any entry whose phrase is not attested:

```ts
const evidence = entry.evidenceMessageIds.map((id) => ctx.message(id)).filter(...);
const attested = evidence.some((m) => quoteAppearsIn(entry.phrase, ctx.visibleText(m)));
if (!attested) { rejected.push(...); continue; }
```

But `evidenceMessageIds` is `.default([])` on `DictionaryEntrySchema`, and **neither
`WRITER_SYSTEM` nor `writerPrompt` ever mentions it.** The prompt's closing instruction is:

> Then, if the group has phrases an outsider would not understand, add a few dictionary
> entries for them. Only for phrases you were actually shown.

A model that does exactly that — phrase, part of speech, definition — produces an entry
with an empty evidence array, which is then deleted with the message *"Nobody in this chat
ever said …"* about a phrase they demonstrably did say.

On this run all three of Sonnet's dictionary entries were rejected this way. Their quotes
were genuine — `רוצים אצלי על הגג` at m13213 is real, and the same quote passed in the
other deck. Only the uncited `evidenceMessageIds` killed them.

**Fix:** ask for the ids in `writerPrompt`'s closing instruction, or fall back to searching
the slide evidence for the phrase before rejecting.

---

## Quality issues (not bugs)

- **~42% of the detective's transcript is content-free.** 53 of 165 excerpt lines are
  `<unknown>` media placeholders and 16 are bare `חחחח`. The conversation scorer rewards
  laughter and density, which is exactly the signature of a sticker landing — the
  top-scored window `c18396` is 6 of 7 media placeholders. Consider requiring a minimum
  ratio of readable text before a window is eligible.
- **Top phrases are stopword bigrams in Hebrew.** `אני לא`, `את זה`, `לא יכול`, `אז אני`
  — 10 of the top 20. `phrases.ts:125` deliberately keeps stopwords for n-grams, which is
  right for English (`on my way`), but the floor check only drops a window where *every*
  token is under `minWordLength`. A rule that drops a window where every token is a
  stopword would remove all 10 and keep `5 דק`, `בא לי`, `על הגג`, `רוצים לשבת`.
- **Contagion framing overreaches on generic phrases.** "coined by Person B, alone for 661
  days" is a strong claim to attach to `5 דק`. Worth gating on the same stopword rule.
- **Hebrew gender agreement is unaddressed.** The writer only ever sees `Person E`, but
  Hebrew verbs and adjectives must agree. The model has to guess, and it will sometimes
  misgender a real person on a slide with their real name restored onto it. Either pass an
  inferred-from-morphology gender hint, or instruct the writer to use nominal
  constructions.
- **The cap of 8 custom slides dropped a good finding.** `custom-f-roof` (Person C used
  `על הגג` alone for 1,583 days before anyone else picked it up) was suppressed as "past
  the cap of 8" while several weaker stat slides survived. The cap is applied before
  strength is compared across the two pools.

## Working correctly

The planner's five suppressions were all right on this data: no leaderboard (everyone
talks the same amount), no night-owl, no reply-speed (this export is minute-resolution),
no ping-pong (no dominant pair), no media slide. The verifier also correctly repaired
quote speakers and dates, and rejected nothing that deserved to survive apart from the
cases above.
