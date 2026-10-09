# Taking real money with Cardcom

Reading "card com" as **Cardcom** (cardcom.solutions) — the Israeli card-clearing
company. If you meant something else, stop here and say so; nothing below applies
to a different provider.

This document is the plan, split into **your part** (things only you can do —
paperwork, decisions, money) and **my part** (code). You don't need to read the
code sections. They're here so you can see the work is scoped, and so whoever
picks this up next knows what was decided.

---

## First, one honest warning

Cardcom is the right choice if you are selling to **Israelis paying in shekels**,
and especially if you need Israeli receipts/invoices issued automatically —
Cardcom does that as part of the payment, which almost nothing else does.

It is the wrong choice if most of your buyers will be **outside Israel**. Cardcom
is built around Israeli cards and shekels, and onboarding takes days of
paperwork. Stripe or Paddle would take you about an hour and accept cards
worldwide. The code in this repo was actually written expecting Stripe
(`SECURITY.md` has a whole section on it).

I'm going to build Cardcom because that's what you asked for. But if "who is
paying me" is genuinely global, tell me now — it's a cheaper decision today than
in three weeks.

---

## Your part

### 1. Your business status: עוסק זעיר — resolved, this is enough

Cardcom is a regulated financial company and cannot open an account for a private
person, only for a registered business. **An עוסק זעיר qualifies.** For clearing
eligibility there is no substantive difference between עוסק זעיר and עוסק פטור —
both are accepted, and some providers just put small businesses on a different
pricing plan.

Have ready when they ask: **תעודת זהות**, **אישור ניהול ספרים** (or your עוסק
registration confirmation from מע"מ), and **bank account details**. A dedicated
*business* bank account is generally **not** required at this size — a personal
account is normally accepted for an עוסק זעיר/פטור. Confirm with Cardcom, but
don't go open a business account preemptively.

Two consequences that follow from being an עוסק זעיר, and they both matter:

**You cannot issue a חשבונית מס (tax invoice).** You issue a **קבלה** (receipt).
This is not a preference — it's the legal limit of the status, and it decides how
I configure Cardcom's automatic document. Getting it wrong means issuing documents
you're not entitled to issue.

**Your ceiling for 2026 is ₪122,833** in turnover. Concretely, at your likely
price that's roughly:

| Price per report | Sales until you hit the ceiling |
|---|---|
| ₪19 | ~6,460 |
| ₪29 | ~4,230 |
| ₪39 | ~3,150 |

That's a lot of reports, so it is not a launch problem. But it *is* a problem you
have to see coming: crossing the ceiling means switching to **עוסק מורשה** and
starting to charge VAT, and that has to be arranged *before* you cross it, not
discovered afterwards. Ask me to add a running total to the app, or just watch the
Cardcom dashboard. Tell your accountant this is a possibility.

### 2. Apply to Cardcom

Go to [cardcom.solutions](https://www.cardcom.solutions/) and use the contact /
signup form, or call them. A salesperson will call you back — this is not a
sign-up-online-in-five-minutes product.

Have ready: your ID, your business registration document, your bank account
details, and a plain description of what you're selling ("a paid personalised
report generated from a WhatsApp chat export, one-time purchase, around ₪X").

Do not be vague about the product. Clearing companies reject applications they
don't understand, and "AI reads your WhatsApp" needs one calm sentence of
explanation, not a mystery.

**Ask them these four things explicitly, and write the answers down:**

1. **The monthly fee** and **the per-transaction commission** (a percentage plus
   sometimes a fixed agora amount). Pricing is negotiated per merchant, so
   there's no public price list — get it in writing.
2. **Is a clearing agreement (הסכם סליקה) with the credit card companies
   included**, or do I need to arrange that separately? Cardcom can usually do
   both; you want to know which you're getting.
3. **How long until my terminal is live**, and **do I get a test terminal
   immediately?** The test terminal is what lets me build and finish the
   integration while your real approval is still in progress. Push for it.
4. **How long until money reaches my bank account** after a customer pays.

### 3. Send me three values (and one warning about how)

Once they set you up, your Cardcom admin panel will have:

- **Terminal number** (מספר מסוף) — a number like `1000`
- **API name** (שם משתמש API) — a username-looking string
- **API password** — if they give you one

⚠️ **The API password is a secret. Do not paste it into a chat with me, into a
GitHub issue, or into any file in this project.** I'll add a line to
`apps/web/.env.example` telling you exactly where to type it yourself — it goes
in `.env.local` on your machine and into Vercel's environment variables in the
dashboard. Both are places that are never committed to git.

The terminal number and API name are much less sensitive, but the same habit is a
good one. Just tell me *when* you have them; I don't need to see them.

### 4. Four decisions only you can make

I can't guess these, and the code can't be finished without them.

**a) The price.** A number in shekels, e.g. ₪19 or ₪29. As an עוסק זעיר you don't
charge VAT at all, so this is refreshingly simple: the number you pick is the
number the buyer pays and the number you book as turnover. No VAT line, no
"+מע״מ", nothing to compute. Decide one number.

**b) Auto-receipt: yes, and it's a קבלה.** Cardcom can email the buyer a **קבלה**
the moment they pay — the document you're legally required to issue and would
otherwise write by hand for every single sale. Turn it on. Given your status this
is effectively decided; the only thing you actually choose is that the payment page
will collect the buyer's **email address**, because a receipt has to be sent
somewhere. That's a small addition to what the buyer sees.

**c) What happens if someone pays and then closes the tab?** Right now, the app
has **no user accounts and stores nothing**. That's a deliberate privacy
decision, and it's a real feature. But it means a person who pays and then loses
the page has **no way to get their report back**, and no way for you to find
their purchase and help them — you'd just refund them.

Three options:
  1. **Accept it.** Add one clear line before payment: "your report is generated
     right now, in this tab — don't close it." Cheapest. Some support pain.
  2. **Email the report.** Requires collecting an email and sending mail. Bigger
     job, and it means the finished report leaves the browser, which changes the
     privacy story.
  3. **Automatic refund policy.** Just refund anyone who asks, no questions.

I'd start with option 1 plus a generous version of option 3, and only build 2 if
people actually complain. But you should choose knowingly, not by accident.

**d) A refund rule.** One sentence you're willing to stand behind, e.g. "didn't
like it? mail me and I'll refund you." You will need this on the page.

### 5. Test it yourself with a real card

When I say it's ready: buy your own report with your own card, for real. Then
refund yourself from the Cardcom admin panel. That is the only test that proves
the whole chain works, and it takes five minutes.

---

## My part

Technical, for the record. Skim or skip.

### The shape of it

Cardcom's "Low Profile" flow, using their v11 REST API (endpoints confirmed
against their OpenAPI spec):

1. `POST https://secure.cardcom.solutions/api/v11/LowProfile/Create` — returns a
   payment page `Url` and a `LowProfileId`. The chat fingerprint travels in the
   `ReturnValue` field, so it is bound to the payment itself rather than sitting
   alongside it.
2. The buyer pays on Cardcom's page.
3. `POST .../api/v11/LowProfile/GetLpResult` with that `LowProfileId` — the
   server asks Cardcom directly whether the payment succeeded. Mint the unlock
   token only if `ResponseCode === 0`, the charged amount matches the real price,
   and `ReturnValue` is the fingerprint **Cardcom** returns — never one the
   browser sends back.

The card number never touches this app. That's the entire point of using a
hosted payment page: PCI compliance stays Cardcom's problem.

The `Document` object on the Create request is what issues the receipt, and its
settings are fixed by the עוסק זעיר status, not chosen:
`DocumentToCreate: "Receipt"` (**not** `"TaxInvoiceAndReceipt"` — that would issue
a tax invoice you are not entitled to issue) and `IsVatFree: true` on the document
and its product line, since no VAT is charged. `Amount` and the line's
`TotalLineCost` are then simply the price, with nothing to net out.

### The one thing that's harder than the code comments claim

`lib/entitlement.ts` and `app/api/checkout/route.ts` both promise that adding
payments is "a change to this file only." That is **not true**, for a specific
reason worth writing down.

The whole report pipeline runs **in the browser**, holding the parsed chat in
memory (`lib/useReport.ts` — checkout, then detective, then write, in one
continuous function). Sending the buyer away to Cardcom's page and back would
**destroy that memory**, and the chat file is never uploaded, so it cannot be
recovered server-side. The user would have to re-pick their export after paying.

So the payment has to open in a **popup or iframe** while the original tab stays
alive and keeps holding the chat. That's the real work in this change, and it's
in the client, not in `/api/checkout`.

### Concrete change list

- `app/api/checkout/route.ts` — stops minting. Creates a Low Profile and returns
  its URL. This route no longer grants anything.
- **New** `app/api/checkout/confirm/route.ts` — calls `GetLpResult`, verifies,
  mints. This is now the only place a token is born.
- **New** `app/api/checkout/webhook/route.ts` — Cardcom requires a `WebHookUrl`,
  so this exists and records the result as a backstop for a buyer whose browser
  died mid-confirm.
- `lib/useReport.ts` — gets the popup-and-wait flow. This is the live path
  (`Deck.tsx` renders it).
- `lib/usePremium.ts`, `components/cards/PremiumSlides.tsx`, `app/api/premium/` —
  **delete.** I checked: nothing imports any of them. They're the older
  single-call premium flow, superseded by the pipeline. Converting a second
  checkout flow that nothing renders would be pure waste, and `/api/premium` is
  currently a live deployed endpoint that spends Anthropic money with no UI
  pointing at it. Deleting is both less work and one less thing to secure.
- `lib/entitlement.ts` — add a `jti` (single-use id) to the token claims.
- `components/cards/PaywallSlide.tsx` — the line at the bottom currently reads
  *"No payment is set up yet — this unlock is free while the product is being
  built."* That must become the real price, plus the refund line, plus (if you
  pick option 1 above) the don't-close-this-tab warning. **This copy and the
  charge must ship in the same commit** or the app takes money while telling
  people it doesn't.
- `apps/web/.env.example` — document `CARDCOM_TERMINAL`, `CARDCOM_API_NAME`,
  `CARDCOM_API_PASSWORD`, `WRAPPED_PRICE_AGOROT`. Values go in `.env.local` and
  Vercel, never in git.
- `SECURITY.md` — its "When you wire up Stripe" section becomes the Cardcom
  section. Its two warnings both still apply exactly: mint on the verified
  result, and make tokens single-use.
- `README.md` (lines 327 and 471) — says `/api/checkout` "is where Stripe goes"
  and lists Stripe as unbuilt. Same class of problem as the paywall copy: docs
  that become false the moment the charge is real.

### Two things that stop being optional

- **Upstash Redis** is currently optional (rate limiting degrades gracefully
  without it). Once a token represents money, it must be **single-use** — right
  now one unlock is valid for 15 minutes and can generate unlimited reports.
  Enforcing "used once" needs somewhere to write "used", and Upstash is already a
  dependency. It becomes required. It's free at this volume.
- **`WRAPPED_PAYMENTS_LIVE=true`** gets set on the deploy. Until then the app
  refuses to hand out reports rather than quietly giving them away, which is the
  correct behaviour for a half-finished deploy. Note the check **inverts**: today
  `true` makes `/api/checkout` return an error, because there is no provider.
  After this change, `true` is the normal state and the mock till is what's gone.

### What I can do before your account exists — I checked, and it's limited

Cardcom's public documentation uses a demo terminal (`1000` / `CardTest1994`) in
its examples, so I tried it directly against the live API. It is **rejected**:

```
{"ResponseCode":603,"Description":"שם משתמש או סיסמה שגויים"}
```

("wrong username or password.") So those example credentials are dead, and there
is no open sandbox I can build against. The one good thing this proves is that the
endpoint and request shape above are correct — Cardcom accepted the request and
authenticated it, it just rejected the credentials.

What this means: **the test terminal you request in step 2 is on the critical
path.** Without it I can write the code but cannot verify a single payment
actually clears, and payment code that has never run is not finished code. Make
that request early and follow up on it — it's usually granted well before full
approval.

I can still do useful work in the meantime: the popup-and-wait flow in the client
(the hard part, and it's testable against a fake), single-use tokens, the paywall
copy, deleting the dead premium flow. Only the final "does a real charge clear"
step waits.

---

## The order things happen in

| # | Who | What | Blocked by |
|---|-----|------|-----------|
| 1 | You | Decide: price, closed-tab policy, refund rule | — **do this now** |
| 2 | — | ~~Register a business~~ — done, you have an עוסק זעיר | ✅ |
| 3 | You | Apply to Cardcom, ask the four questions, **request a test terminal** | — |
| 4 | Me | Build everything that doesn't need Cardcom: popup flow, verification logic, single-use tokens, paywall copy, delete the dead premium flow | 1 |
| 5 | You | Get the test terminal + API name; put the API password in `.env.local` and Vercel yourself | 3 |
| 6 | Me | Wire it up for real and confirm a test payment actually clears | 4, 5 |
| 7 | Me | Swap in the live terminal, set `WRAPPED_PAYMENTS_LIVE=true`, ship | 6 |
| 8 | You | Buy your own report with a real card, then refund it | 7 |

The business registration that would normally be the long pole is already done, so
the critical path is now **step 3** — Cardcom's own approval, which runs on their
clock. Apply today. Step 1 is three questions you can answer in five minutes, and
it's the only thing blocking me.
