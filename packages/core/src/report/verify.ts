import type { Message, ParseResult } from '../types';
import { dayKey } from '../stats/stats';
import {
  BROAD_KINDS,
  type DictionaryEntry,
  type Finding,
  type Quote,
  type Score,
  type Slide,
  type VerificationIssue,
  type Verdict,
} from './schema';
import type { ScoreAxis } from './scores';

/**
 * Evidence verification — the stage that decides whether a model's observation
 * is allowed to become a slide.
 *
 * This runs **in the browser**, against the reader's real parsed messages. That
 * is not an accident of where it was convenient to put it: the server only ever
 * held an anonymised excerpt, so the server cannot tell a quote that was said
 * from one that was invented. The browser can, because it still has every
 * message the excerpt was cut from.
 *
 * Everything here compares in *token space* — `Person A`, not the reader's
 * friend's name. Names are restored after verification, not before, so this
 * module never needs to know who anyone is.
 *
 * The bias throughout is towards rejecting. A funny observation that turns out
 * to be about something nobody said is not a small error in this product; it is
 * the thing that makes a reader stop believing any of it.
 */

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

/** The two methods this module needs from a `Pseudonymizer`. */
export interface TokenSource {
  tokenFor(name: string | null): string;
  scrub(text: string): string;
}

export interface VerificationContext {
  /** The real message behind an id, or undefined if the id is invented. */
  message(id: number): Message | undefined;
  /** Exactly the text the model was shown for this message. */
  visibleText(m: Message): string;
  tokenOf(sender: string | null): string;
  /** Every token that corresponds to a real participant. */
  knownTokens: ReadonlySet<string>;
}

export function createVerificationContext(
  parsed: ParseResult,
  tokens: TokenSource,
): VerificationContext {
  const byId = new Map<number, Message>();
  for (const m of parsed.messages) byId.set(m.id, m);

  return {
    message: (id) => byId.get(id),
    // Must mirror `anonymizeMessages` exactly. If these two drift, every quote
    // taken from a media or deleted message fails to verify and the failure
    // looks like the model hallucinating.
    visibleText: (m) =>
      m.kind === 'attachment'
        ? `<${m.attachmentType ?? 'media'}>`
        : m.kind === 'deleted'
          ? '<deleted>'
          : tokens.scrub(m.body),
    tokenOf: (sender) => tokens.tokenFor(sender),
    knownTokens: new Set(parsed.participants.map((n) => tokens.tokenFor(n))),
  };
}

/* ------------------------------------------------------------------ *
 * Text matching
 * ------------------------------------------------------------------ */

/**
 * Fold away everything that differs between a line as it sits in the file and
 * the same line as a model copies it back: smart quotes, collapsed runs of
 * whitespace, case, and the ellipsis a model adds when it trims.
 *
 * Deliberately *not* stripping punctuation wholesale. "we're going" and "were
 * going" are different sentences, and a matcher loose enough to equate them is
 * loose enough to match a quote that was never said.
 */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[‘’‛ʼ׳]/g, "'")
    .replace(/[“”‟״]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

/** Peel off the wrapping and trailing ellipsis a model adds around a quote. */
function unwrapQuote(text: string): string {
  let out = text.trim();
  out = out.replace(/^["'“”«]+/, '').replace(/["'“”»]+$/, '');
  out = out.replace(/(\.{3}|…)$/, '');
  return out.trim();
}

/** True when `quote` appears inside `body`, allowing for the above. */
function quoteAppearsIn(quote: string, body: string): boolean {
  const needle = normalizeForMatch(unwrapQuote(quote));
  if (needle.length === 0) return false;
  return normalizeForMatch(body).includes(needle);
}

/* ------------------------------------------------------------------ *
 * Safety nets
 * ------------------------------------------------------------------ */

/**
 * Identifiers that must never reach a slide.
 *
 * Message bodies were scrubbed before the model saw them, so a real phone
 * number appearing in model output means either the scrubber missed one or the
 * model made it up. Both are rejections: one is a leak and the other is a lie.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s.-]?){3,5}\d{2,4}/;
const LONG_DIGITS_RE = /\d[\d\s-]{9,}/;
/** A street address with a house number, in English or Hebrew. */
const ADDRESS_RE =
  /\b\d{1,4}\s+[\p{L}][\p{L}\s]{2,30}\s+(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?)\b|\b(רחוב|רח')\s+[\p{L}]/iu;

function containsSensitiveData(text: string): boolean {
  if (EMAIL_RE.test(text)) return true;
  if (ADDRESS_RE.test(text)) return true;
  if (LONG_DIGITS_RE.test(text)) return true;
  // A bare date like "12/01/2023" matches the phone shape, so require enough
  // digits to actually be a number somebody could ring.
  const phone = PHONE_RE.exec(text);
  return phone !== null && (phone[0].match(/\d/g) ?? []).length >= 9;
}

/**
 * Categories a report may not *conclude* something about somebody.
 *
 * The test is deliberately narrow: an attribution verb followed by a trait. The
 * group is allowed to talk about religion, politics and health all day — those
 * words appear in the excerpts constantly — and a filter that fired on the topic
 * would gut a slide about a group that argues about politics every Friday. What
 * is not allowed is the *report* deciding that a named person is depressed, or
 * gay, or observant, and printing it as a finding.
 *
 * This is a coarse net under a prompt that is asked not to do it at all. It
 * catches the confident English/Hebrew phrasing a model reaches for; it is not
 * a semantic classifier and does not pretend to be.
 */
const TRAIT_TERMS = [
  // Clinical. Never asserted about a person, in any phrasing.
  'depressed', 'depression', 'bipolar', 'autistic', 'autism', 'adhd', 'ocd',
  'anorexic', 'bulimic', 'anorexia', 'schizophrenic', 'psychotic', 'suicidal',
  'alcoholic', 'addict', 'recovering addict', 'eating disorder',
  'דיכאון', 'מדוכא', 'אוטיסט', 'אנורקטית', 'אלכוהוליסט', 'אובדני',
  // Sexuality.
  'gay', 'lesbian', 'bisexual', 'asexual', 'closeted', 'in the closet',
  'transgender', 'trans woman', 'trans man',
  'הומו', 'לסבית', 'טרנס', 'בארון',
  // Religion, ethnicity, politics.
  'religious', 'observant', 'atheist', 'muslim', 'jewish', 'christian',
  'orthodox', 'secular', 'zionist', 'leftist', 'right-wing', 'communist',
  'דתי', 'חילוני', 'חרדי', 'מוסלמי', 'נוצרי', 'שמאלני', 'ימני',
];

const ATTRIBUTION = String.raw`\b(?:is|was|are|seems|appears|must be|clearly|obviously|definitely|probably|basically|secretly)\b`;
const TRAIT_ALTERNATION = TRAIT_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

/** `... is clearly depressed`, `Person A is secretly religious`. */
const INFERRED_TRAIT_RE = new RegExp(
  `${ATTRIBUTION}(?:\\s+\\S+){0,3}\\s+(?:${TRAIT_ALTERNATION})\\b`,
  'iu',
);
/** Hebrew puts the adjective after the subject with no copula: `דניאל דתי`. */
const HEBREW_TRAIT_RE = new RegExp(
  `Person [A-Z]+\\s+(?:${TRAIT_ALTERNATION})\\b`,
  'iu',
);
/** A diagnosis framed as a joke is still a diagnosis on a slide. */
const DIAGNOSIS_RE =
  /\b(?:diagnos\w+|clinically|suffers from|struggles with)\b/iu;

function inferssensitiveTrait(text: string): boolean {
  return (
    INFERRED_TRAIT_RE.test(text) || HEBREW_TRAIT_RE.test(text) || DIAGNOSIS_RE.test(text)
  );
}

/* ------------------------------------------------------------------ *
 * Findings
 * ------------------------------------------------------------------ */

function issue(code: VerificationIssue['code'], message: string): VerificationIssue {
  return { code, message };
}

/**
 * Try to place a quote that does not match the message it cites.
 *
 * A model reading a forty-line transcript routinely attaches the right line to
 * the id one or two rows above it. That is a clerical slip, not an invention,
 * and throwing away a real observation because of it loses exactly the material
 * this product exists to find. So: look through the rest of the finding's
 * evidence first, then a small neighbourhood around the cited id.
 *
 * The neighbourhood is small on purpose. Widened to the whole chat, this stops
 * being repair and becomes "find me any message that contains these words",
 * which would launder a genuinely fabricated quote into a verified one.
 */
const REPAIR_RADIUS = 4;

function locateQuote(
  quote: Quote,
  evidence: readonly number[],
  ctx: VerificationContext,
): Message | null {
  const candidates: number[] = [...evidence];
  for (let d = -REPAIR_RADIUS; d <= REPAIR_RADIUS; d++) {
    candidates.push(quote.messageId + d);
  }

  for (const id of candidates) {
    const m = ctx.message(id);
    if (m && m.kind !== 'system' && quoteAppearsIn(quote.text, ctx.visibleText(m))) return m;
  }
  return null;
}

/**
 * How much a verified finding is worth, 0..1.
 *
 * The model's own scores are inputs, not the answer — a model asked to rate its
 * own joke rates it highly. They are multiplied by what the evidence actually
 * supports, so a confident claim resting on two messages scores below a modest
 * one resting on twenty.
 */
function strengthOf(finding: Finding, evidenceCount: number, days: number): number {
  const claimed =
    finding.confidence * 0.3 +
    finding.recognition * 0.3 +
    finding.uniqueness * 0.25 +
    finding.comedy * 0.15;

  // Saturating, not linear: the difference between two examples and six is
  // large, between twenty and forty is noise.
  const support = Math.min(1, Math.log2(1 + evidenceCount) / Math.log2(9));
  const spread = Math.min(1, days / 3);

  return claimed * (0.55 + 0.3 * support + 0.15 * spread);
}

export function verifyFinding(finding: Finding, ctx: VerificationContext): Verdict<Finding> {
  const issues: VerificationIssue[] = [];

  /* --- evidence must resolve to real, human messages --------------- */
  const resolved: Message[] = [];
  const unresolved: number[] = [];
  for (const id of finding.evidenceMessageIds) {
    const m = ctx.message(id);
    // System notices belong to no participant, so they can support no claim
    // about a person — and a model handed a window containing "X left the
    // group" will happily cite it as evidence of someone's personality.
    if (m && m.kind !== 'system') resolved.push(m);
    else unresolved.push(id);
  }

  if (unresolved.length > 0) {
    issues.push(
      issue(
        'evidence-missing',
        `${unresolved.length} cited message id(s) do not exist in this chat: ${unresolved
          .slice(0, 5)
          .map((i) => `m${i}`)
          .join(', ')}`,
      ),
    );
  }

  if (resolved.length === 0) {
    return {
      action: 'reject',
      issues: [...issues, issue('thin-evidence', 'Nothing cited resolves to a real message.')],
      value: finding,
      strength: 0,
    };
  }

  /* --- people must be people in this chat -------------------------- */
  const unknown = finding.people.filter((t) => !ctx.knownTokens.has(t));
  if (unknown.length > 0) {
    issues.push(
      issue('unknown-person', `Names someone not in this chat: ${unknown.join(', ')}`),
    );
  }
  const people = finding.people.filter((t) => ctx.knownTokens.has(t));

  /* --- quotes must have been said, by that person, on that day ----- */
  const quotes: Quote[] = [];
  let fabricated = 0;
  for (const quote of finding.quotes) {
    const cited = ctx.message(quote.messageId);
    const matchesCited =
      cited !== undefined &&
      cited.kind !== 'system' &&
      quoteAppearsIn(quote.text, ctx.visibleText(cited));

    const source = matchesCited ? cited : locateQuote(quote, finding.evidenceMessageIds, ctx);

    if (!source) {
      fabricated++;
      issues.push(
        issue('quote-not-found', `No message in this chat contains: "${quote.text.slice(0, 60)}"`),
      );
      continue;
    }

    const realSpeaker = ctx.tokenOf(source.sender);
    const realDate = dayKey(source);

    if (source.id !== quote.messageId) {
      issues.push(
        issue(
          'quote-not-found',
          `Quote was attributed to m${quote.messageId} but was actually said in m${source.id}.`,
        ),
      );
    }
    if (quote.speaker !== realSpeaker) {
      issues.push(
        issue(
          'quote-wrong-speaker',
          `Quote credited to ${quote.speaker}; ${realSpeaker} said it.`,
        ),
      );
    }
    if (quote.date !== realDate) {
      issues.push(
        issue('quote-wrong-date', `Quote dated ${quote.date}; it was sent on ${realDate}.`),
      );
    }

    // Repaired to the truth rather than dropped. The reader sees the real
    // speaker and the real date, which is the only version worth showing.
    quotes.push({ messageId: source.id, speaker: realSpeaker, date: realDate, text: quote.text });
  }

  // One misplaced quote is a slip. Every quote unfindable means the finding was
  // built out of nothing, and the claim attached to it is not worth keeping
  // either.
  if (finding.quotes.length > 0 && fabricated === finding.quotes.length) {
    return {
      action: 'reject',
      issues: [
        ...issues,
        issue('quote-not-found', 'Every quote on this finding is unverifiable.'),
      ],
      value: { ...finding, quotes, people },
      strength: 0,
    };
  }

  /* --- a standing claim needs more than one occasion --------------- */
  const days = new Set(resolved.map(dayKey));
  const broad = BROAD_KINDS.has(finding.kind);

  if (resolved.length < 2 && broad) {
    return {
      action: 'reject',
      issues: [
        ...issues,
        issue('thin-evidence', `A ${finding.kind} claim needs more than one supporting message.`),
      ],
      value: { ...finding, quotes, people },
      strength: 0,
    };
  }

  if (broad && days.size < 2) {
    return {
      action: 'reject',
      issues: [
        ...issues,
        issue(
          'single-occasion',
          `A ${finding.kind} claim rests entirely on ${[...days][0]}. That is a mood, not a pattern.`,
        ),
      ],
      value: { ...finding, quotes, people },
      strength: 0,
    };
  }

  /* --- safety ------------------------------------------------------ */
  const prose = [finding.claim, finding.detail, finding.suggestedTitle ?? '', ...quotes.map((q) => q.text)].join(
    '\n',
  );

  if (containsSensitiveData(prose)) {
    return {
      action: 'reject',
      issues: [...issues, issue('sensitive-data', 'Carries a phone number, email or address.')],
      value: { ...finding, quotes, people },
      strength: 0,
    };
  }

  // Only the report's own words, not the quotes: the group is allowed to have
  // said anything, and a slide that quotes them saying it is reporting, not
  // concluding. The rejection is for the report asserting it.
  if (inferssensitiveTrait([finding.claim, finding.detail, finding.suggestedTitle ?? ''].join('\n'))) {
    return {
      action: 'reject',
      issues: [
        ...issues,
        issue('off-limits', 'Reads as an inference about a protected or private trait.'),
      ],
      value: { ...finding, quotes, people },
      strength: 0,
    };
  }

  /* --- verdict ----------------------------------------------------- */
  const value: Finding = { ...finding, quotes, people, evidenceMessageIds: resolved.map((m) => m.id) };
  const strength = strengthOf(value, resolved.length, days.size);

  const repaired = issues.some(
    (i) =>
      i.code === 'quote-wrong-speaker' ||
      i.code === 'quote-wrong-date' ||
      i.code === 'quote-not-found',
  );

  return {
    action: repaired ? 'rewrite' : strength < 0.35 ? 'optional' : 'include',
    issues,
    value,
    strength,
  };
}

/* ------------------------------------------------------------------ *
 * Written copy
 * ------------------------------------------------------------------ */

/**
 * The greeting-card phrases.
 *
 * Every one of these is something a model reaches for when it has nothing
 * specific to say, which is precisely when it should be saying nothing. They are
 * matched on the finished copy rather than forbidden only in the prompt, because
 * "avoid generic phrasing" is an instruction a model agrees with and then
 * ignores on the eleventh slide.
 */
const BANNED_PHRASES: readonly RegExp[] = [
  /\bevery group (?:chat )?has (?:one|that one|a)\b/i,
  /\bthe glue that (?:holds|held)\b/i,
  /\balways there when you need\b/i,
  /\bthe life (?:and soul )?of the party\b/i,
  /\bbrings? (?:the )?positive energy\b/i,
  /\b(?:this|the) group is more than (?:a|just a) chat\b/i,
  /\ba year full of memories\b/i,
  /\byou laughed,? loved,? and grew\b/i,
  /\bmost likely to brighten\b/i,
  /\bhere'?s to (?:many )?more\b/i,
  /\bthrough thick and thin\b/i,
  /\bwhat a year it(?:'s| has) been\b/i,
  /\bat the end of the day,? (?:it'?s|this is) about\b/i,
  // Hebrew equivalents of the same greeting-card register.
  /\bבכל קבוצה יש\b/,
  /\bהדבק שמחזיק\b/,
  /\bשנה מלאה בזיכרונות\b/,
];

/**
 * Numbers below this are read as rhetoric ("the two of them", "a third time")
 * rather than as statistics, and are not checked against the supplied set.
 * Above it, a figure is a claim, and a claim needs a source.
 */
const RHETORICAL_CEILING = 10;

/** Body-length budget per format, in characters. A slide does not scroll. */
const BODY_BUDGET: Record<string, number> = {
  plain: 320,
  /*
    A dossier used to get 150 characters — one line under a fact strip and five
    measured bars, on the grounds that everything else on the card was already
    true and the writer's sentence should read like a verdict rather than a
    paragraph that ran out of room.

    That was the tightest budget in the deck, and it was spent on the one slide
    people actually care about: the one with their name on it. A person is not
    a fact strip. The thing worth reading about them is the second observation —
    that the man writing a five-paragraph itinerary and the man writing the
    five-paragraph insult are the same man — and that does not fit in a line.

    Still bounded, because the card is tapped rather than scrolled. This is the
    room for three or four short beats, not an essay.
  */
  profile: 600,
  court_case: 420,
  breaking_news: 300,
  scientific_report: 380,
  company_structure: 420,
  patch_notes: 460,
  documentary: 380,
  eulogy: 260,
  dictionary_entry: 420,
  leaderboard: 420,
  timeline: 460,
  receipt: 420,
};

function numbersIn(text: string): number[] {
  // Thousands separators are stripped so "8,493" reads as one number rather
  // than as an 8 and a 493.
  const out: number[] = [];
  for (const raw of text.match(/\d[\d,.]*/g) ?? []) {
    const n = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Checks finished slide copy: no invented figures, no greeting-card phrasing,
 * nothing longer than the slide can show, no identifiers.
 *
 * The numeric check is the important one. Statistics are computed in TypeScript
 * and handed to the writer; the writer's job is to interpret them, never to
 * produce one. Any figure in the prose that is not in `stats`, not in a verified
 * quote, and not small enough to be rhetoric, was made up.
 */
export function verifySlideCopy(
  slide: Slide,
  ctx: VerificationContext,
  /** The axes this slide was briefed with. Omitted for slides that have none. */
  axes: readonly ScoreAxis[] = [],
): Verdict<Slide> {
  const issues: VerificationIssue[] = [];

  const allowed = new Set<number>();
  for (const stat of slide.stats) {
    if (typeof stat.value === 'number') allowed.add(stat.value);
    else for (const n of numbersIn(stat.value)) allowed.add(n);
  }
  // Anything the group themselves said, and the dates it was said on, is
  // quotable without being a fabricated statistic.
  for (const quote of slide.quotes) {
    for (const n of numbersIn(quote.text)) allowed.add(n);
    for (const n of numbersIn(quote.date)) allowed.add(n);
  }

  /* --- score bars --------------------------------------------------- */

  /*
    The writer renames an axis; it does not re-value one. Checking membership in
    a set of permitted values would not be enough — with five axes on a card the
    model could keep every number and shuffle the labels between them, and each
    bar would still "match". So the check is per key: this label is attached to
    *this* measurement, at the value the measurement actually had.

    A score that fails is dropped rather than fatal. The rest of the dossier is
    still true, and a card with four honest bars beats no card at all.
  */
  const axisOf = new Map(axes.map((a) => [a.key, a]));
  for (const axis of axes) allowed.add(axis.value);

  const scores: Score[] = [];
  const seenKeys = new Set<string>();
  // Defaulted rather than assumed. Every slide that comes through the pipeline
  // has been parsed by `SlideSchema`, which fills this in — but this function is
  // also called on hand-built objects, and a new required field arriving as
  // undefined at one call site should not take the verifier down with it.
  for (const score of slide.scores ?? []) {
    const axis = axisOf.get(score.key);
    if (!axis) {
      issues.push(issue('unknown-axis', `"${score.label}" cites an axis this slide was never given.`));
      continue;
    }
    if (score.value !== axis.value) {
      issues.push(
        issue(
          'rescored-axis',
          `"${score.label}" reports ${score.value} for ${score.key}, which measured ${axis.value}.`,
        ),
      );
      continue;
    }
    // Two labels on one measurement is the same bar drawn twice.
    if (seenKeys.has(score.key)) continue;
    seenKeys.add(score.key);
    scores.push(score);
  }

  const prose = [slide.title, slide.subtitle, slide.body].join('\n');

  /*
    Everything the reader sees, which is not the same set as everything checked
    for invented figures. A verdict's *value* is a joke in the shape of a
    number — `∞/100`, `-14/100` — so running the statistics rule over it would
    reject the deck for the one thing it was asked to do. Its *label* is prose
    on a card like any other, so it is policed like any other: a protected trait
    or a phone number is no less exposed for being formatted as a rating.
  */
  const readable = [prose, ...(slide.jokeScores ?? []).map((v) => v.label)].join('\n');

  const invented = numbersIn(prose).filter((n) => n >= RHETORICAL_CEILING && !allowed.has(n));
  if (invented.length > 0) {
    issues.push(
      issue(
        'invented-number',
        `Figures with no source: ${[...new Set(invented)].slice(0, 5).join(', ')}`,
      ),
    );
  }

  for (const pattern of BANNED_PHRASES) {
    const hit = pattern.exec(readable);
    if (hit) {
      issues.push(issue('generic-phrasing', `Greeting-card phrasing: "${hit[0]}"`));
      break;
    }
  }

  const budget = BODY_BUDGET[slide.format] ?? 320;
  if (slide.body.length > budget) {
    issues.push(
      issue('too-long', `Body is ${slide.body.length} characters against a ${budget} budget.`),
    );
  }

  if (containsSensitiveData(readable)) {
    issues.push(issue('sensitive-data', 'Copy carries a phone number, email or address.'));
  }
  if (inferssensitiveTrait(readable)) {
    issues.push(issue('off-limits', 'Copy infers a protected or private trait.'));
  }

  // Quotes on a written slide are re-checked rather than trusted from the
  // planning stage: the writer is given verified quotes and can still retype one
  // slightly wrong, and a quote that no longer matches is no longer a quote.
  const quotes: Quote[] = [];
  for (const quote of slide.quotes) {
    const m = ctx.message(quote.messageId);
    if (m && m.kind !== 'system' && quoteAppearsIn(quote.text, ctx.visibleText(m))) {
      quotes.push({ ...quote, speaker: ctx.tokenOf(m.sender), date: dayKey(m) });
    } else {
      issues.push(
        issue('quote-not-found', `Rewritten quote no longer matches m${quote.messageId}.`),
      );
    }
  }

  const fatal = issues.some(
    (i) => i.code === 'sensitive-data' || i.code === 'off-limits' || i.code === 'invented-number',
  );
  const soft = issues.some((i) => i.code === 'generic-phrasing' || i.code === 'too-long');

  return {
    action: fatal ? 'reject' : soft ? 'rewrite' : 'include',
    issues,
    value: { ...slide, quotes, scores },
    strength: fatal ? 0 : slide.confidence,
  };
}

/**
 * Dictionary entries, checked like anything else.
 *
 * These are the easiest thing in the deck to forget: they arrive alongside the
 * slides, they look like decoration, and they are model-written prose carrying
 * model-supplied quotes. An invented origin story for a phrase the group never
 * said is exactly as damaging as an invented slide — more so, because a
 * definition reads as a statement of fact rather than as a joke.
 *
 * An entry survives only if the phrase itself is real. The definition is
 * allowed to be invention; that is what a joke dictionary is. The *phrase*
 * being real is what makes it their dictionary.
 */
export function verifyDictionary(
  entries: readonly DictionaryEntry[],
  ctx: VerificationContext,
): { kept: DictionaryEntry[]; rejected: { phrase: string; issues: VerificationIssue[] }[] } {
  const kept: DictionaryEntry[] = [];
  const rejected: { phrase: string; issues: VerificationIssue[] }[] = [];

  for (const entry of entries) {
    const issues: VerificationIssue[] = [];

    const evidence = entry.evidenceMessageIds
      .map((id) => ctx.message(id))
      .filter((m): m is Message => m !== undefined && m.kind !== 'system');

    // The phrase has to appear in at least one message that was actually sent.
    const attested = evidence.some((m) => quoteAppearsIn(entry.phrase, ctx.visibleText(m)));
    if (!attested) {
      rejected.push({
        phrase: entry.phrase,
        issues: [
          issue('quote-not-found', `Nobody in this chat ever said "${entry.phrase}".`),
        ],
      });
      continue;
    }

    if (containsSensitiveData(`${entry.phrase}\n${entry.definition}\n${entry.origin}`)) {
      rejected.push({
        phrase: entry.phrase,
        issues: [issue('sensitive-data', 'Carries a phone number, email or address.')],
      });
      continue;
    }
    if (inferssensitiveTrait(`${entry.definition}\n${entry.origin}`)) {
      rejected.push({
        phrase: entry.phrase,
        issues: [issue('off-limits', 'Infers a protected or private trait.')],
      });
      continue;
    }

    const quotes: Quote[] = [];
    for (const quote of entry.quotes) {
      const m = ctx.message(quote.messageId);
      if (m && m.kind !== 'system' && quoteAppearsIn(quote.text, ctx.visibleText(m))) {
        quotes.push({ ...quote, speaker: ctx.tokenOf(m.sender), date: dayKey(m) });
      } else {
        issues.push(
          issue('quote-not-found', `Dictionary quote does not match m${quote.messageId}.`),
        );
      }
    }

    kept.push({ ...entry, quotes, evidenceMessageIds: evidence.map((m) => m.id) });
  }

  return { kept, rejected };
}

/* ------------------------------------------------------------------ *
 * Duplication
 * ------------------------------------------------------------------ */

function contentTokens(text: string): Set<string> {
  return new Set(
    normalizeForMatch(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3),
  );
}

/**
 * How much two slides say the same thing, 0..1.
 *
 * Jaccard over content words of the title and body. Crude, but the failure it
 * catches is crude: two slides that both turn out to be about the same person
 * never replying, arrived at from different findings and phrased differently
 * enough that neither stage noticed.
 */
export function similarity(a: Slide, b: Slide): number {
  const ta = contentTokens(`${a.title} ${a.body}`);
  const tb = contentTokens(`${b.title} ${b.body}`);
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** Two slides about the same people saying the same thing. */
export function isDuplicate(a: Slide, b: Slide, threshold = 0.45): boolean {
  /*
    Dossiers about different people are never duplicates, and the text test is
    actively wrong on them.

    A dossier's whole body is one official title, and the writer is told that
    "most likely to" is the form of that line — so every card contributes `most`
    and `likely`. Duplication is measured before names are restored, so every
    card also contributes `person`. Two cards reading "Person A / Most likely to
    survive." and "Person B / Most likely to vanish." share three of four content
    words: Jaccard 0.60, comfortably over the threshold, and the second person
    silently loses their card with nothing on screen to explain it.

    There is nothing for this check to catch here anyway. The planner emits one
    profile per participant by construction, so two of them being about the same
    person is not a state that exists.
  */
  if (a.format === 'profile' && b.format === 'profile') {
    return a.people[0] !== undefined && a.people[0] === b.people[0];
  }

  if (similarity(a, b) >= threshold) return true;

  // A weaker text overlap still counts when both slides are about exactly the
  // same one person: "never replies" and "the certified ghost" share almost no
  // words and are the same slide twice.
  const samePerson =
    a.people.length === 1 && b.people.length === 1 && a.people[0] === b.people[0];
  return samePerson && a.type === b.type && similarity(a, b) >= threshold * 0.6;
}
