import { z } from 'zod';

/**
 * The report contract.
 *
 * One definition, validated on the server against what a model returned and
 * imported by the client that renders it. The alternative — a zod schema in the
 * route and a hand-written interface in the component — is how a slide goes
 * blank in production while every type checks.
 *
 * This is `packages/core` rather than `apps/web` because none of it touches the
 * DOM: zod is isomorphic, so the "an Expo app can import this as-is" property
 * survives. The rule the package actually keeps is zero *DOM* dependencies.
 *
 * Field names are camelCase to match the rest of the codebase. The product
 * specification writes them snake_case; that is a notation difference, not a
 * different schema, and a model constrained by `zodOutputFormat` emits whatever
 * the schema says.
 */

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

/**
 * A participant as the model knows them: `Person A`.
 *
 * Enforced in the schema rather than checked afterwards, because a model that
 * invents "Daniel" has invented a person, and a report naming somebody who is
 * not in the chat is the single worst thing this product can produce. It is
 * also the shape the API routes already reject at the door.
 */
export const PersonToken = z.string().regex(/^Person [A-Z]+$/, 'must be a Person token');

/** A citation. `messageId` is a `Message.id` — an index into the real array. */
export const QuoteSchema = z.object({
  messageId: z.number().int().min(0),
  speaker: PersonToken,
  /** Copied from the transcript. Verified against the real message body. */
  text: z.string().min(1).max(600),
  /** `YYYY-MM-DD`. Verified against the real message's calendar fields. */
  date: z.string().max(12),
});
export type Quote = z.infer<typeof QuoteSchema>;

/**
 * A number on a slide.
 *
 * Every one of these is computed in TypeScript and handed *to* the writer. The
 * writer is never asked for a figure, which is the only reliable way to stop a
 * model inventing one — `verifySlideCopy` enforces the other half by rejecting
 * any number in the prose that is not in this list.
 */
export const StatSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.union([z.number(), z.string().max(40)]),
});
export type Stat = z.infer<typeof StatSchema>;

/**
 * How mean a claim is allowed to be, which is not the same as how funny it is.
 *
 * `high` is not "reject" — a group that roasts hard has earned a hard roast —
 * it is "this needs the group's own register to carry it", and the planner uses
 * it together with the inferred voice. Anything genuinely off-limits (a
 * protected trait, a private fact, an inferred diagnosis) is rejected outright
 * by `verifyFinding` and never reaches a sensitivity score.
 */
export const Sensitivity = z.enum(['low', 'medium', 'high']);
export type Sensitivity = z.infer<typeof Sensitivity>;

/**
 * A score bar on a dossier.
 *
 * The one place in the deck where a model supplies something that *looks* like a
 * statistic — so it does not supply the number. `key` names a computed axis the
 * planner handed over, `value` must still be that axis's value, and `label` is
 * the only field the writer actually invents: the group's own joke name for a
 * measurement that was taken in TypeScript. See `scores.ts`.
 */
export const ScoreSchema = z.object({
  key: z.string().min(1).max(40),
  /** The group's name for this axis. The joke. */
  label: z.string().min(1).max(44),
  value: z.number().int().min(0).max(100),
});
export type Score = z.infer<typeof ScoreSchema>;

/**
 * A made-up rating. Not a measurement, and never presented as one.
 *
 * `ScoreSchema` above is the honest bar: the planner measured an axis, the
 * writer renames it, and the number cannot move. That rule exists because a
 * model inventing "8,493 messages" is a model lying about the chat.
 *
 * `Restraint: 0/100` is not that. Nobody reads it as a finding — it is a joke
 * whose whole form is a rating, and the funniest ones are funny *because* the
 * number is impossible: `Ability to escalate: ∞/100`, `Volume: 117/100`,
 * `Ability to communicate efficiently: -14/100`, `Collective braincell: 1.7`.
 * Treating those as fabricated statistics was a category error — it applied a
 * rule written to protect the reader from false claims to a line that makes no
 * claim at all, and the cost was the single densest source of comedy the deck
 * had.
 *
 * So the value is a string, because every good one is unrepresentable as an
 * integer from nought to a hundred. It is never checked against anything, and
 * it must never be rendered anywhere a reader could mistake it for a statistic
 * the product measured.
 */
export const JokeScoreSchema = z.object({
  /** What is being rated. This is where the joke lives. */
  label: z.string().min(1).max(44),
  /** Written exactly as it should read: `0/100`, `∞/100`, `-14/100`, `1.7`. */
  value: z.string().min(1).max(12),
});
export type JokeScore = z.infer<typeof JokeScoreSchema>;

/* ------------------------------------------------------------------ *
 * Stage 4 — the detective's structured findings
 * ------------------------------------------------------------------ */

/**
 * Every kind of thing the detective can claim.
 *
 * The split matters for verification, not for rendering: `broad` kinds describe
 * a standing pattern and need evidence spread across more than one day, while
 * moment kinds are *about* a single occasion and would be wrongly rejected by
 * that rule. `BROAD_KINDS` below is the list the verifier reads.
 */
export const FindingKind = z.enum([
  'group_identity',
  'recurring_topic',
  'member_persona',
  'inside_joke',
  'contradiction',
  'failed_plan',
  'legendary_moment',
  'nostalgic_moment',
  'prediction_aged_badly',
  'relationship_dynamic',
  'custom_slide',
]);
export type FindingKind = z.infer<typeof FindingKind>;

/**
 * Claims about how someone *generally* behaves. One conversation cannot
 * establish any of these — that is a mood, not a pattern — so the verifier
 * demands evidence from at least two separate days.
 */
export const BROAD_KINDS: ReadonlySet<FindingKind> = new Set<FindingKind>([
  'group_identity',
  'recurring_topic',
  'member_persona',
  'relationship_dynamic',
  'inside_joke',
]);

export const FindingSchema = z.object({
  /** Model-assigned, unique within one reply. Used to trace a slide back. */
  id: z.string().min(1).max(60),
  kind: FindingKind,
  /** The claim in one flat sentence. Not the joke — the joke comes later. */
  claim: z.string().min(1).max(300),
  /** What the pattern actually is, in plain language. */
  detail: z.string().max(600).default(''),
  /** Who it is about. Empty for claims about the group as a whole. */
  people: z.array(PersonToken).max(60).default([]),
  /**
   * The messages that prove it. This is the field the whole pipeline turns on:
   * a finding with no resolvable evidence is rejected, never softened.
   */
  evidenceMessageIds: z.array(z.number().int().min(0)).max(40).default([]),
  /** Lines worth putting on a slide, copied verbatim from the transcript. */
  quotes: z.array(QuoteSchema).max(6).default([]),
  confidence: z.number().min(0).max(1),
  comedy: z.number().min(0).max(1).default(0.5),
  /** How hard the group would nod. The spec's "recognition". */
  recognition: z.number().min(0).max(1).default(0.5),
  /** How specific to *this* group. A finding true of any chat scores 0. */
  uniqueness: z.number().min(0).max(1).default(0.5),
  sensitivity: Sensitivity.default('low'),
  /**
   * What the detective thinks this should look like. The planner may override.
   *
   * Defaulted rather than optional, and the difference is load-bearing: a
   * provider asked to *enforce* a schema requires every property to be
   * required, so one optional field anywhere in a stage's schema turns that
   * stage's structured output off. Empty says the same thing as absent to the
   * two places that read it, and costs nothing to carry.
   */
  suggestedTitle: z.string().max(120).default(''),
});
export type Finding = z.infer<typeof FindingSchema>;

export const GroupVoiceSchema = z.object({
  /** How the group actually talks, in one line, for the writer to match. */
  register: z.string().max(300),
  /** How hard they roast each other, 0 = gentle, 1 = merciless. */
  roastTolerance: z.number().min(0).max(1),
  /** True when the group's own humour runs dark. Never assumed. */
  darkHumour: z.boolean(),
});
export type GroupVoice = z.infer<typeof GroupVoiceSchema>;

/**
 * The whole of stage 4. Deliberately one flat findings array rather than the
 * specification's eleven parallel arrays: every downstream stage treats them
 * identically — verify, score, plan — and eleven arrays means eleven places to
 * forget one. `kind` carries the distinction that mattered.
 */
export const DiscoverySchema = z.object({
  groupIdentity: z.object({
    summary: z.string().max(400),
    confidence: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.number().int().min(0)).max(40).default([]),
  }),
  voice: GroupVoiceSchema,
  findings: z.array(FindingSchema).max(60),
});
export type Discovery = z.infer<typeof DiscoverySchema>;

/* ------------------------------------------------------------------ *
 * Stage 6/7 — the deck
 * ------------------------------------------------------------------ */

/**
 * The shapes a slide can take.
 *
 * Offered to the writer as a menu, not assigned to it: the format is chosen to
 * fit the finding. A court case needs a defendant and an accusation; patch
 * notes need several small independent facts. The planner suggests, the writer
 * confirms, and `plain` is always available for a finding that does not want a
 * costume.
 */
export const SlideFormat = z.enum([
  'plain',
  'profile',
  'court_case',
  'breaking_news',
  'scientific_report',
  'company_structure',
  'patch_notes',
  'documentary',
  'eulogy',
  'dictionary_entry',
  'leaderboard',
  'timeline',
  'receipt',
  /**
   * The final rankings: everyone in the chat, placed by the writer on an axis
   * it invents for this group, one line each, and a key takeaway as the
   * closer. The last slide of a deck, and the one the group argues about.
   */
  'rankings',
]);
export type SlideFormat = z.infer<typeof SlideFormat>;

export const SlideType = z.enum([
  'opening',
  'stat',
  'persona',
  'custom_discovery',
  'legendary_moment',
  'nostalgia',
  'inside_jokes',
  'finale',
]);
export type SlideType = z.infer<typeof SlideType>;

export const SlideSchema = z.object({
  id: z.string().min(1).max(80),
  type: SlideType,
  format: SlideFormat,
  title: z.string().min(1).max(120),
  subtitle: z.string().max(160).default(''),
  /**
   * The copy. Capped hard because a slide in this deck does not scroll — it is
   * tapped — so anything past the fold is simply not read. `verifySlideCopy`
   * enforces a tighter per-format budget on top of this ceiling.
   */
  body: z.string().max(700).default(''),
  quotes: z.array(QuoteSchema).max(4).default([]),
  people: z.array(PersonToken).max(60).default([]),
  stats: z.array(StatSchema).max(6).default([]),
  /** Renamed score axes. Only a `profile` slide has any. */
  scores: z.array(ScoreSchema).max(8).default([]),
  /**
   * Made-up ratings. Free in both label and value, checked against nothing,
   * and the densest comedy on a dossier. See `JokeScoreSchema`.
   */
  jokeScores: z.array(JokeScoreSchema).max(10).default([]),
  evidenceMessageIds: z.array(z.number().int().min(0)).max(40).default([]),
  /**
   * The last line on the card, set apart from the body.
   *
   * On a dossier it is the official title — "Most likely to …" — which used to
   * be the whole body when the body was one line. The body is now the roast,
   * three or four beats long, and the title it closes on needs its own slot or
   * it is just the fourth beat in the same type. Optional everywhere else.
   */
  closer: z.string().max(160).default(''),
  confidence: z.number().min(0).max(1).default(1),
  sensitivity: Sensitivity.default('low'),
  /** One line for a future illustrator. Never rendered as text. */
  visualDirection: z.string().max(200).default(''),
  /** What somebody types when they screenshot it back into the group. */
  shareCaption: z.string().max(140).default(''),
});
export type Slide = z.infer<typeof SlideSchema>;

/**
 * One entry in the inside-joke dictionary. Kept apart from `Slide` because it is
 * a list of small things rather than one big thing, and paginating it is the
 * renderer's business.
 */
export const DictionaryEntrySchema = z.object({
  phrase: z.string().min(1).max(80),
  /** Noun, verb, interjection — whatever the joke is best served by. */
  partOfSpeech: z.string().max(30).default(''),
  definition: z.string().min(1).max(400),
  origin: z.string().max(300).default(''),
  quotes: z.array(QuoteSchema).max(2).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  evidenceMessageIds: z.array(z.number().int().min(0)).max(20).default([]),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntrySchema>;

/** What the writer returns: finished copy for the slides it was briefed on. */
export const WrittenDeckSchema = z.object({
  slides: z.array(SlideSchema).max(60),
  dictionary: z.array(DictionaryEntrySchema).max(12).default([]),
});
export type WrittenDeck = z.infer<typeof WrittenDeckSchema>;

/* ------------------------------------------------------------------ *
 * Stage 5 — verification verdicts
 * ------------------------------------------------------------------ */

export type VerificationCode =
  /** An evidence id points at no message in this chat. */
  | 'evidence-missing'
  /** A quoted line does not appear in the message it cites. */
  | 'quote-not-found'
  /** The quote exists, but a different person said it. */
  | 'quote-wrong-speaker'
  /** The quote exists, but not on the date given. */
  | 'quote-wrong-date'
  /** A standing claim resting on a single day. */
  | 'single-occasion'
  /** Fewer supporting messages than the claim needs. */
  | 'thin-evidence'
  /** The claim or a quote carries a phone number, email or address. */
  | 'sensitive-data'
  /** The claim reads as an inference about a protected or private trait. */
  | 'off-limits'
  /** The named person is not in this chat. */
  | 'unknown-person'
  /** A figure in the copy is not one of the numbers supplied. */
  | 'invented-number'
  /** A score bar names an axis this slide was never handed. */
  | 'unknown-axis'
  /** A score bar kept the axis and changed the number. */
  | 'rescored-axis'
  /** Copy that would fit any group chat. */
  | 'generic-phrasing'
  /** Longer than the slide can show. */
  | 'too-long'
  /** Says the same thing as a slide already in the deck. */
  | 'duplicate';

export interface VerificationIssue {
  code: VerificationCode;
  /** Shown in the debug view, never to a reader. */
  message: string;
}

/**
 * What to do with a finding.
 *
 * `rewrite` is the interesting one: the claim survives but something attached to
 * it did not — usually a quote pinned to the wrong message when the right one is
 * two lines away. Throwing the finding out for that would lose a real
 * observation to a clerical error, so the verifier repairs what it can and says
 * what it changed.
 */
export type VerificationAction = 'include' | 'rewrite' | 'optional' | 'reject';

export interface Verdict<T> {
  action: VerificationAction;
  issues: VerificationIssue[];
  /** The finding or slide with whatever could be fixed, fixed. */
  value: T;
  /** 0..1. Combines the model's scores with what the evidence actually supports. */
  strength: number;
}
