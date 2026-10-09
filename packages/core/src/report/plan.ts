import type { ChatStats, DayKey, PersonStats } from '../stats/types';
import type { Message } from '../types';
import { dayKey } from '../stats/stats';
import { isSubstantive } from '../stats/samples';
import type { InteractionReport } from '../patterns/interactions';
import type { CommitmentReport, StalledPlan } from '../patterns/commitments';
import type { PhraseReport } from '../patterns/phrases';
import type { Finding, Sensitivity, SlideFormat, SlideType, Stat } from './schema';
import { computeScoreAxes, type ScoreAxis } from './scores';

/**
 * Slide planning: deciding what this particular group's report is made of.
 *
 * The important half of this file is the half that says **no**. A statistic is
 * only worth a slide when it distinguishes somebody — "the night owl" in a group
 * where everyone posts at the same hour is not an observation, it is a rounding
 * error with a name on it, and a deck padded with those is exactly the generic
 * dashboard this product is trying not to be.
 *
 * The other half is the half that hands the writer something to write *from*.
 * A statistic slide used to reach the writer as an angle, a token and two
 * figures — and came back as the two figures in costume: "Charge: sent 352
 * messages in a row. Evidence: 13 minutes." The same category of slide, in the
 * same shape, on every chat. So every event the planner can locate in the
 * transcript now carries the transcript: the run itself, the last lines before
 * the silence, the hour the loud day peaked, what people said after the
 * deletion. The writer is told the angle is a label and the material is the
 * slide. Formats rotate per chat and never repeat inside a deck.
 *
 * Nothing here writes copy. The output is a *brief* — the facts, the evidence
 * and the intended shape — which the writing stage turns into words and is not
 * permitted to add numbers to.
 */

/** What the writer is handed for one slide. */
export interface SlideBrief {
  id: string;
  type: SlideType;
  /** The planner's suggestion. The writer may pick a better one. */
  format: SlideFormat;
  /** What this slide is about, in plain language. Never rendered. */
  angle: string;
  /** Deterministic figures. The writer interprets these and invents none. */
  stats: Stat[];
  /**
   * Measured 0..100 axes the writer may rename but not re-value. Only a
   * `profile` brief carries any; see `scores.ts` for why the split exists.
   */
  scoreAxes: ScoreAxis[];
  people: string[];
  /** Messages that back it up — quotes are chosen from these. */
  evidenceMessageIds: number[];
  /** Findings this brief came from, for tracing. Empty for pure statistics. */
  findingIds: string[];
  sensitivity: Sensitivity;
  /** 0..1. Drives ordering and the cut when there are too many. */
  strength: number;
  /** Roughly how much copy this slide wants, in characters. */
  targetLength: number;
  /**
   * How many of the evidence messages the writer should actually be shown.
   *
   * Four lines are enough to prove a claim and nowhere near enough to retell a
   * scene. A slide about the loudest day in the chat's history, or a run of
   * forty messages into silence, is written from the lines themselves — so it
   * asks for more. A profile asks for eight; a slide with only figures asks for
   * none.
   */
  quoteBudget: number;
}

export interface PlanInput {
  stats: ChatStats;
  interactions: InteractionReport;
  commitments: CommitmentReport;
  phrases: PhraseReport;
  stalledPlans: StalledPlan[];
  /** Verified findings with their post-verification strength. */
  findings: { finding: Finding; strength: number }[];
  /** Map from a real participant name to the token the report uses. */
  tokenOf: (name: string) => string;
  /**
   * The chat itself, so an event the statistics only count can be located and
   * its lines handed to the writer. Optional: without it the planner still
   * briefs every slide, from figures alone, which is what it used to do.
   */
  messages?: readonly Message[];
}

export interface PlanOptions {
  /** Ceiling on statistic slides. Defaults to 7. */
  maxStatSlides?: number;
  /** Ceiling on discovered slides. Defaults to 8. */
  maxCustomSlides?: number;
  /** Ceiling on persona cards. Defaults to 12. */
  maxPersonaSlides?: number;
  /** Below this strength a slide is not worth a swipe. Defaults to 0.3. */
  floor?: number;
}

/* ------------------------------------------------------------------ *
 * Weak-statistic suppression
 * ------------------------------------------------------------------ */

/**
 * Whether a per-person ranking actually has a winner.
 *
 * The test is separation, not magnitude: the leader has to be far enough clear
 * of the runner-up that naming them says something. A leaderboard where the top
 * two are within a few percent of each other produces a slide that the
 * runner-up will, correctly, dispute.
 */
function hasClearWinner(values: number[], minLead = 1.3): boolean {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
  if (sorted.length < 2) return false;
  const [first, second] = sorted as [number, number];
  if (first <= 0) return false;
  return second <= 0 ? true : first / second >= minLead;
}

/** Spread of a distribution relative to its own mean. */
function dispersion(values: number[]): number {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length < 2) return 0;
  const mean = usable.reduce((a, b) => a + b, 0) / usable.length;
  if (mean === 0) return 0;
  const variance = usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Every reason a statistic slide gets dropped, in one place so the debug view
 * can show which ones were considered and why they lost.
 */
export interface SuppressionNote {
  slide: string;
  reason: string;
}

/* ------------------------------------------------------------------ *
 * Locating events in the transcript
 * ------------------------------------------------------------------ */

/**
 * The chat, indexed the ways the stat slides need it.
 *
 * Built once per plan and only when the caller handed over the messages. Every
 * finder below returns message ids, never text: the ids are anonymised and
 * verified downstream exactly like a detective's citation, so the planner
 * cannot put a line on a slide that the verifier would not accept.
 */
class Transcript {
  readonly text: Message[];
  private readonly textIds = new Set<number>();
  private readonly byDay = new Map<DayKey, Message[]>();
  private readonly bySender = new Map<string, Message[]>();
  private readonly attachmentsByDay = new Map<DayKey, number>();
  private readonly all: readonly Message[];

  constructor(messages: readonly Message[]) {
    this.all = messages;
    // A text message with nothing in it is a line the export wrote and the
    // phone did not: it reads as "Person E:" and proves nothing. Not material.
    this.text = messages.filter((m) => m.kind === 'text' && m.body.trim().length > 0);
    for (const m of messages) {
      if (m.kind !== 'attachment') continue;
      const day = dayKey(m);
      this.attachmentsByDay.set(day, (this.attachmentsByDay.get(day) ?? 0) + 1);
    }
    for (const m of this.text) {
      this.textIds.add(m.id);
      const day = dayKey(m);
      const inDay = this.byDay.get(day);
      if (inDay) inDay.push(m);
      else this.byDay.set(day, [m]);
      if (m.sender) {
        const theirs = this.bySender.get(m.sender);
        if (theirs) theirs.push(m);
        else this.bySender.set(m.sender, [m]);
      }
    }
  }

  textOf(sender: string): Message[] {
    return this.bySender.get(sender) ?? [];
  }

  /** Whether this id is a line with words in it, as opposed to a sticker. */
  isText(id: number): boolean {
    return this.textIds.has(id);
  }

  /** Photos, videos and stickers in `[from, to]`. */
  attachmentsBetween(from: number, to: number): number {
    let n = 0;
    for (let id = from; id <= to; id++) if (this.all[id]?.kind === 'attachment') n++;
    return n;
  }

  /** Photos, videos and stickers sent on `day`. */
  attachmentsOn(day: DayKey): number {
    return this.attachmentsByDay.get(day) ?? 0;
  }

  onDay(day: DayKey): Message[] {
    return this.byDay.get(day) ?? [];
  }

  /** Text messages whose id falls in `[from, to]`, in order. */
  between(from: number, to: number): Message[] {
    return this.text.filter((m) => m.id >= from && m.id <= to);
  }

  /** Every message of any kind by `sender`, for finding the deletions. */
  everythingBy(sender: string): Message[] {
    return this.all.filter((m) => m.sender === sender);
  }

  /** The nearest text message before `id` by somebody other than `notBy`. */
  before(id: number, notBy: string | null, reach = 6): Message | undefined {
    for (let d = 1; d <= reach; d++) {
      const m = this.all[id - d];
      if (m && m.kind === 'text' && m.sender !== notBy) return m;
    }
    return undefined;
  }

  /** Up to `count` text replies after `id` by somebody other than `notBy`. */
  after(id: number, notBy: string | null, count: number, reach = 8): Message[] {
    const out: Message[] = [];
    for (let d = 1; d <= reach && out.length < count; d++) {
      const m = this.all[id + d];
      if (m && m.kind === 'text' && m.sender !== notBy) out.push(m);
    }
    return out;
  }
}

/** `count` items spread evenly across `items`, always keeping the first and last. */
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  if (count <= 1) return items.slice(0, 1);
  const out: T[] = [];
  const step = (items.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) out.push(items[Math.round(i * step)]!);
  return out;
}

const ids = (messages: readonly Message[]) => messages.map((m) => m.id);

/**
 * A person's last lines before their longest silence and first lines after it.
 *
 * The silence is, by construction, the gap between two consecutive messages of
 * theirs; `from` is the day of the earlier one. So the boundary is the latest
 * message of theirs on or before that day, and the return is whatever follows.
 */
function aroundPersonalSilence(t: Transcript, person: PersonStats, each = 3): number[] {
  if (!person.longestSilenceFrom) return [];
  const theirs = t.textOf(person.name);
  let boundary = -1;
  for (let i = 0; i < theirs.length; i++) {
    if (dayKey(theirs[i]!) <= person.longestSilenceFrom) boundary = i;
    else break;
  }
  if (boundary < 0) return [];
  return ids([
    ...theirs.slice(Math.max(0, boundary - each + 1), boundary + 1),
    ...theirs.slice(boundary + 1, boundary + 1 + each),
  ]);
}

/** The last lines anyone sent before a group-wide silence, and the first after. */
function aroundGroupSilence(t: Transcript, from: DayKey, to: DayKey, each = 3): number[] {
  const before = t.text.filter((m) => dayKey(m) <= from).slice(-each);
  const after = t.text.filter((m) => dayKey(m) >= to).slice(0, each);
  return ids([...before, ...after]);
}

/** How the loudest day started, and the hour it peaked. */
function loudDay(t: Transcript, day: DayKey, budget: number): number[] {
  const inDay = t.onDay(day);
  if (inDay.length === 0) return [];
  const opening = inDay.slice(0, 3);

  const perHour = new Map<number, Message[]>();
  for (const m of inDay) {
    const inHour = perHour.get(m.localHour);
    if (inHour) inHour.push(m);
    else perHour.set(m.localHour, [m]);
  }
  let peak: Message[] = [];
  for (const inHour of perHour.values()) if (inHour.length > peak.length) peak = inHour;

  const chosen = new Map<number, Message>();
  for (const m of opening) chosen.set(m.id, m);
  for (const m of spread(peak, Math.max(0, budget - chosen.size))) chosen.set(m.id, m);
  return [...chosen.values()].sort((a, b) => a.id - b.id).map((m) => m.id);
}

/** What one person actually sends between midnight and five. */
function nightLines(t: Transcript, person: PersonStats, count: number): number[] {
  const late = t.textOf(person.name).filter((m) => m.localHour < 5 && isSubstantive(m));
  return ids(spread(late, count));
}

/** For each conversation this person ended: what was said, and the line that ended it. */
function killings(
  t: Transcript,
  sender: string,
  examples: readonly { messageId: number }[],
  count: number,
): number[] {
  const out = new Set<number>();
  // Only the lines with words in them: a sticker that ended a conversation is
  // real, but it cannot be quoted, and it would reach the writer as "Person F:".
  const quotable = examples.filter((e) => t.isText(e.messageId));
  for (const example of spread(quotable, count)) {
    const prior = t.before(example.messageId, sender);
    if (prior) out.add(prior.id);
    out.add(example.messageId);
  }
  return [...out].sort((a, b) => a - b);
}

/** What everyone else said right after each of this person's deletions. */
function afterDeletions(t: Transcript, sender: string, count: number): number[] {
  const deleted = t.everythingBy(sender).filter((m) => m.kind === 'deleted');
  const out = new Set<number>();
  for (const m of spread(deleted, count)) {
    for (const reply of t.after(m.id, sender, 2)) out.add(reply.id);
  }
  return [...out].sort((a, b) => a - b);
}

/** A question from somebody else, and this person's answer seconds later. */
function quickReplies(t: Transcript, sender: string, count: number, withinMs = 60_000): number[] {
  const pairs: [Message, Message][] = [];
  const all = t.text;
  for (let i = 1; i < all.length; i++) {
    const reply = all[i]!;
    const prior = all[i - 1]!;
    if (reply.sender !== sender || prior.sender === sender || !prior.sender) continue;
    if (reply.ts.getTime() - prior.ts.getTime() > withinMs) continue;
    if (!isSubstantive(prior) || !isSubstantive(reply)) continue;
    pairs.push([prior, reply]);
  }
  // Questions first: a fast answer to a question is a scene, a fast "ok" to a
  // statement is a reflex.
  pairs.sort((a, b) => Number(b[0].body.includes('?')) - Number(a[0].body.includes('?')));
  return spread(pairs, count).flatMap(([q, a]) => [q.id, a.id]);
}

/** A run of consecutive messages, trimmed to its start and its end. */
function run(t: Transcript, from: number, to: number, budget: number): number[] {
  const slice = t.between(from, to);
  if (slice.length <= budget) return ids(slice);
  return ids([...slice.slice(0, budget - 2), ...slice.slice(-2)]);
}

/** Everything said between the first "on my way" and the last, claims kept. */
function arrivalThread(t: Transcript, claims: readonly number[], budget: number): number[] {
  if (claims.length === 0) return [];
  const first = Math.min(...claims);
  const last = Math.max(...claims);
  const keep = new Set(claims.slice(0, Math.min(claims.length, budget - 4)));
  const others = t.between(first, last).filter((m) => !keep.has(m.id));
  for (const m of spread(others, Math.max(0, budget - keep.size))) keep.add(m.id);
  return [...keep].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/**
 * The shapes each slide can wear, best fit first.
 *
 * One fixed shape per slide is how every deck got three court cases in a row:
 * the conversation killer, the monologue and the deletions were all tried
 * before the same judge, and the reader's third "The case against" was the
 * moment the report started to look like a template. So every slide lists the
 * shapes that suit its material, `dress` picks one that nothing else in the
 * deck is wearing, and the starting point rotates per chat so two groups do not
 * get the same costume on the same slide.
 */
const STAT_SHAPES: Record<string, SlideFormat[]> = {
  'stat-opening': ['plain'],
  'stat-ghost': ['eulogy', 'breaking_news', 'documentary', 'plain'],
  'stat-night-owl': ['documentary', 'scientific_report', 'plain'],
  'stat-reply-speed': ['scientific_report', 'breaking_news', 'plain'],
  'stat-killer': ['court_case', 'eulogy', 'plain'],
  'stat-monologue': ['court_case', 'documentary', 'receipt', 'timeline'],
  'stat-ping-pong': ['documentary', 'plain', 'scientific_report'],
  'stat-media': ['receipt', 'patch_notes'],
  'stat-deleted': ['court_case', 'breaking_news', 'eulogy'],
  'stat-chaos-day': ['breaking_news', 'timeline', 'receipt'],
  'stat-silence': ['eulogy', 'breaking_news', 'plain'],
  'stat-signatures': ['dictionary_entry'],
  'stat-arrivals': ['documentary', 'timeline', 'court_case'],
};

/** Which shapes suit which kind of finding, best fit first. */
const SHAPES_FOR_KIND: Record<string, SlideFormat[]> = {
  group_identity: ['plain', 'scientific_report'],
  recurring_topic: ['plain', 'scientific_report', 'receipt'],
  member_persona: ['plain'],
  inside_joke: ['dictionary_entry'],
  contradiction: ['court_case', 'breaking_news', 'plain'],
  failed_plan: ['timeline', 'eulogy', 'patch_notes'],
  legendary_moment: ['breaking_news', 'documentary', 'plain'],
  nostalgic_moment: ['timeline', 'documentary'],
  prediction_aged_badly: ['documentary', 'breaking_news', 'plain'],
  relationship_dynamic: ['company_structure', 'documentary', 'plain'],
  custom_slide: ['plain'],
};

/** Shapes that may appear more than once: they carry no costume to wear out. */
const REPEATABLE: ReadonlySet<SlideFormat> = new Set<SlideFormat>([
  'plain',
  'profile',
  'dictionary_entry',
]);

/**
 * Picks a shape per brief that nothing earlier in `order` is wearing.
 *
 * Discovered slides are dressed first and keep their best fit whenever it is
 * free: they are the unique material and the costume should follow them. The
 * statistic slides take what is left, starting from a point in their own list
 * chosen by `seed`, so the same category of slide does not wear the same
 * costume on every chat.
 */
function dress(
  order: readonly SlideBrief[],
  shapesOf: (brief: SlideBrief) => readonly SlideFormat[],
  rotate: (brief: SlideBrief) => boolean,
  seed: number,
): void {
  const worn = new Set<SlideFormat>();
  for (const brief of order) {
    const options = shapesOf(brief);
    if (options.length === 0) continue;
    const start = rotate(brief) && options.length > 1 ? seed % options.length : 0;
    let chosen: SlideFormat | undefined;
    for (let i = 0; i < options.length; i++) {
      const candidate = options[(start + i) % options.length]!;
      if (REPEATABLE.has(candidate) || !worn.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    brief.format = chosen ?? options[start]!;
    worn.add(brief.format);
  }
}

/* ------------------------------------------------------------------ *
 * The guaranteed slides
 * ------------------------------------------------------------------ */

interface Candidate {
  brief: SlideBrief;
  /** Null when the slide earned its place; a reason when it did not. */
  suppressed: string | null;
}

/**
 * Below this many messages, comparing members to each other is noise wearing a
 * superlative. In a four-message chat somebody is mathematically the biggest
 * talker, the ghost and the night owl, and all three slides are true and
 * worthless. The opener is the only honest thing such a chat can support.
 */
const MIN_MESSAGES_FOR_COMPARISON = 30;

/**
 * The statistic slides.
 *
 * Deliberately not the free deck again. The leaderboard, the hour histogram,
 * the fastest replier and the totals are all cards the reader swiped through
 * before paying; a paid deck that opens by repeating them in a different font
 * is the first impression the user complained about. What survives here is
 * every statistic that points at an *event* the transcript can show — a run, a
 * silence, a day, a deletion — plus the opener, which is now about what the
 * group is for rather than how big it is.
 */
function statSlides(input: PlanInput, t: Transcript | null): Candidate[] {
  const { stats, interactions, commitments, phrases, tokenOf } = input;
  const people = stats.people;
  const out: Candidate[] = [];

  /** Set when the chat is too small for any per-person claim to mean anything. */
  const thin =
    stats.totalMessages < MIN_MESSAGES_FOR_COMPARISON
      ? `only ${stats.totalMessages} messages in the whole chat`
      : null;

  const token = (name: string | null | undefined) => (name ? tokenOf(name) : '');
  const add = (
    brief: Omit<
      SlideBrief,
      'findingIds' | 'sensitivity' | 'targetLength' | 'scoreAxes' | 'format' | 'quoteBudget'
    > &
      Partial<Pick<SlideBrief, 'sensitivity' | 'targetLength' | 'quoteBudget'>>,
    suppressed: string | null,
  ) => {
    out.push({
      brief: {
        findingIds: [],
        sensitivity: 'low',
        targetLength: 200,
        scoreAxes: [],
        // Placeholder: `dress` assigns the real one once the deck is known.
        format: STAT_SHAPES[brief.id]?.[0] ?? 'plain',
        quoteBudget: 6,
        ...brief,
      },
      suppressed,
    });
  };

  /* --- the opener -------------------------------------------------- */
  add(
    {
      id: 'stat-opening',
      type: 'opening',
      angle:
        'The first slide after they paid, and it has to prove the whole chat was read. ' +
        'Say what this group is actually for in practice — take it from THIS GROUP above, ' +
        'the way the investigation read it — in a line the members would recognise as theirs. ' +
        'The totals are the punchline, not the content: hang them off the observation. ' +
        'Not a dashboard, not a summary, no "this group is more than".',
      stats: [
        { label: 'Messages', value: stats.totalMessages },
        { label: 'Days spoken on', value: stats.span.activeDays },
        { label: 'Span', value: stats.span.label },
        { label: 'Messages per day', value: Math.round(stats.perDay) },
      ],
      people: [],
      evidenceMessageIds: [],
      strength: 1,
      quoteBudget: 0,
      targetLength: 180,
    },
    null,
  );

  /* --- the ghost ---------------------------------------------------- */
  const ghost = people.find((p) => p.name === stats.awards.ghost);
  const ghostDays = ghost ? Math.round(ghost.longestSilenceDays) : 0;
  add(
    {
      id: 'stat-ghost',
      type: 'stat',
      angle: ghost
        ? `${token(ghost.name)} said nothing for ${ghostDays} days — from ${ghost.longestSilenceFrom} to ${ghost.longestSilenceTo}` +
          (ghost.stillGone
            ? ', and has not been heard from since.'
            : '. The material is their last lines before the silence and their first lines when they came back. What did they leave on, what did they return with, and did anyone notice?')
        : 'Nobody has gone quiet for long.',
      stats: ghost
        ? [
            { label: 'Longest silence, days', value: ghostDays },
            { label: 'From', value: ghost.longestSilenceFrom ?? '' },
            { label: 'To', value: ghost.longestSilenceTo ?? '' },
          ]
        : [],
      people: ghost ? [token(ghost.name)] : [],
      evidenceMessageIds: ghost && t ? aroundPersonalSilence(t, ghost) : [],
      strength: 0.85,
      quoteBudget: 6,
    },
    thin ??
      (!ghost
        ? 'nobody was quiet for long enough'
        : // A month is a holiday. Below that, calling somebody a ghost is a
          // slide about a normal person having a normal life.
          ghost.longestSilenceDays < 30
          ? `longest disappearance was only ${ghostDays} days`
          : null),
  );

  /* --- night owl ---------------------------------------------------- */
  const owl = people.find((p) => p.name === stats.awards.nightOwl);
  const nightShares = people.filter((p) => p.messages >= 30).map((p) => p.nightShare);
  add(
    {
      id: 'stat-night-owl',
      type: 'stat',
      angle: owl
        ? `${token(owl.name)} is the one still typing between midnight and five, when the rest of the chat is asleep. The material is what they actually send at that hour — read it for what kind of message gets written at 3am, and to whom.`
        : 'Nobody is really up at night.',
      stats: owl
        ? [
            { label: 'Share after midnight', value: `${Math.round(owl.nightShare * 100)}%` },
            { label: 'Night messages', value: owl.nightMessages },
          ]
        : [],
      people: owl ? [token(owl.name)] : [],
      evidenceMessageIds: owl && t ? nightLines(t, owl, 6) : [],
      strength: 0.7,
      quoteBudget: 6,
    },
    thin ??
      (!owl
        ? 'no night owl'
        : owl.nightShare < 0.12
          ? 'nobody is really up at night'
          : hasClearWinner(nightShares, 1.6)
            ? null
            : 'the whole group keeps the same hours'),
  );

  /* --- reply speed -------------------------------------------------- */
  const replyTimes = people
    .filter((p) => p.responseSamples >= 20 && p.medianResponseMs !== null)
    .map((p) => p.medianResponseMs!);
  const fastest = people.find((p) => p.name === stats.awards.fastestReplier);
  add(
    {
      id: 'stat-reply-speed',
      type: 'stat',
      angle: fastest
        ? `${token(fastest.name)} answers before anyone has finished reading. The material pairs something somebody asked with ${token(fastest.name)}'s reply seconds later.`
        : 'Nobody replies unusually fast.',
      stats: fastest
        ? [
            {
              label: 'Median reply',
              value: `${Math.round((fastest.medianResponseMs ?? 0) / 1000)}s`,
            },
          ]
        : [],
      people: fastest ? [token(fastest.name)] : [],
      evidenceMessageIds: fastest && t ? quickReplies(t, fastest.name, 3) : [],
      strength: 0.55,
      quoteBudget: 6,
    },
    // The documented trap: most Android exports are written to the minute, so
    // every same-minute reply is a gap of exactly zero. "Replies in 0s" claims a
    // precision the file never had.
    stats.timestampPrecisionMs > 1000
      ? 'this export records time only to the minute'
      : replyTimes.length < 2
        ? 'not enough replies to compare'
        : dispersion(replyTimes) < 0.35
          ? 'everyone replies at about the same speed'
          : null,
  );

  /* --- conversation killer ------------------------------------------ */
  const killer = interactions.killers[0];
  add(
    {
      id: 'stat-killer',
      type: 'stat',
      angle: killer
        ? `${token(killer.sender)}'s message is reliably the one after which nobody speaks: ${killer.kills} conversations ended on them, ${killer.index.toFixed(1)}x more than their share of the talking would predict. The material pairs what was being said with the line that ended it. What kind of line kills a conversation here?`
        : 'Nobody ends conversations unusually often.',
      stats: killer
        ? [
            { label: 'Conversations ended', value: killer.kills },
            { label: 'Above their share', value: `${killer.index.toFixed(1)}x` },
          ]
        : [],
      people: killer ? [token(killer.sender)] : [],
      evidenceMessageIds: killer
        ? t
          ? killings(t, killer.sender, killer.examples, 4)
          : killer.examples.map((e) => e.messageId)
        : [],
      strength: 0.75,
      quoteBudget: 8,
    },
    thin ??
      (!killer
        ? 'no conversation killer'
        : // Whoever talks most ends most conversations by accident. Only a real
          // over-representation is a person rather than an artefact.
          killer.index < 1.4
          ? 'ends conversations no more often than they speak'
          : null),
  );

  /* --- the monologue ------------------------------------------------ */
  const monologue = interactions.monologues[0];
  // A run of 352 "messages" in 13 minutes is a photo dump, and a slide that
  // calls it a lecture has misread it. Count the attachments so the writer
  // knows which kind of run it is looking at.
  const dumped = monologue && t ? t.attachmentsBetween(monologue.startId, monologue.endId) : 0;
  add(
    {
      id: 'stat-monologue',
      type: 'stat',
      angle: monologue
        ? `On ${monologue.day}, ${token(monologue.sender)} sent ${monologue.length} messages in a row with nobody else present — ${monologue.durationMinutes} minutes talking to an empty room` +
          (monologue.silenceAfterMinutes !== null
            ? `, and ${monologue.silenceAfterMinutes} more before anyone replied.`
            : '.') +
          (dumped > 0
            ? ` ${dumped} of the ${monologue.length} were photos or videos, not words.`
            : '') +
          ' The material is the run itself, start and end. What was it, and why did nobody answer?'
        : 'Nobody monologues here.',
      stats: monologue
        ? [
            { label: 'Messages in a row', value: monologue.length },
            { label: 'Minutes talking to nobody', value: monologue.durationMinutes },
            { label: 'Date', value: monologue.day },
            ...(monologue.silenceAfterMinutes !== null
              ? [{ label: 'Minutes before a reply', value: monologue.silenceAfterMinutes }]
              : []),
            ...(dumped > 0 ? [{ label: 'Of which photos or videos', value: dumped }] : []),
          ]
        : [],
      people: monologue ? [token(monologue.sender)] : [],
      evidenceMessageIds: monologue
        ? t
          ? run(t, monologue.startId, monologue.endId, 12)
          : [monologue.startId, monologue.endId]
        : [],
      strength: 0.8,
      targetLength: 240,
      quoteBudget: 12,
    },
    thin ??
      (!monologue
        ? 'nobody monologues here'
        : monologue.length < 8
          ? `longest run was only ${monologue.length} messages`
          : null),
  );

  /* --- ping-pong pair ------------------------------------------------ */
  const pair = interactions.pingPong;
  add(
    {
      id: 'stat-ping-pong',
      type: 'stat',
      angle: pair
        ? `${token(pair.a)} and ${token(pair.b)} answer each other far more than they answer anyone else — a private conversation held in public, in front of everyone. The material is their longest unbroken back-and-forth. What are the two of them actually like together?`
        : 'No pair talks mainly to each other.',
      stats: pair
        ? [
            { label: 'Exchanges', value: pair.exchanges },
            { label: 'Longest unbroken volley', value: pair.longestVolley },
          ]
        : [],
      people: pair ? [token(pair.a), token(pair.b)] : [],
      evidenceMessageIds:
        pair && pair.longestVolleyStart >= 0
          ? t
            ? run(t, pair.longestVolleyStart, pair.longestVolleyEnd, 14)
            : [pair.longestVolleyStart, pair.longestVolleyEnd]
          : [],
      strength: 0.8,
      quoteBudget: 14,
    },
    thin ?? (!pair ? 'no pair talks mainly to each other' : null),
  );

  /* --- media -------------------------------------------------------- */
  const mediaPerson = people.find((p) => p.name === stats.awards.mediaSpammer);
  add(
    {
      id: 'stat-media',
      type: 'stat',
      angle: mediaPerson
        ? `${token(mediaPerson.name)} is responsible for most of the photographs and videos in here — the share of the chat everyone else has to scroll past.`
        : 'Nobody dominates the media.',
      stats: mediaPerson
        ? [
            { label: 'Attachments sent', value: mediaPerson.attachments },
            {
              label: 'Share of all media',
              value: `${Math.round(
                (mediaPerson.attachments / Math.max(1, stats.totalAttachments)) * 100,
              )}%`,
            },
          ]
        : [],
      people: mediaPerson ? [token(mediaPerson.name)] : [],
      evidenceMessageIds: [],
      strength: 0.5,
      quoteBudget: 0,
    },
    thin ??
      (!mediaPerson || stats.totalAttachments < 40
        ? 'not enough media to accuse anyone'
        : hasClearWinner(
              people.map((p) => p.attachments),
              1.5,
            )
          ? null
          : 'everyone sends about the same amount of media'),
  );

  /* --- deleted ------------------------------------------------------- */
  const deleter = [...people].sort((a, b) => b.deleted - a.deleted)[0];
  add(
    {
      id: 'stat-deleted',
      type: 'stat',
      angle: deleter
        ? `${token(deleter.name)} deleted ${deleter.deleted} messages, more than anyone here. The deleted lines are gone; the material is what the others said right after each one — the shape of the hole where the message was.`
        : 'Barely anything was deleted.',
      stats: deleter
        ? [
            { label: 'Messages deleted', value: deleter.deleted },
            { label: 'Deleted in the group', value: stats.totalDeleted },
          ]
        : [],
      people: deleter ? [token(deleter.name)] : [],
      evidenceMessageIds: deleter && t ? afterDeletions(t, deleter.name, 4) : [],
      strength: 0.7,
      quoteBudget: 8,
    },
    thin ?? (!deleter || deleter.deleted < 5 ? 'barely anything was deleted' : null),
  );

  /* --- the loudest day ----------------------------------------------- */
  const explosion = stats.explosions[0];
  // Same reading as the monologue: a day that is mostly photographs is a day
  // somebody came back from a trip, not a day the group argued.
  const dumpedThatDay = explosion && t ? t.attachmentsOn(explosion.day) : 0;
  const mostlyPhotos = explosion ? dumpedThatDay > explosion.count / 3 : false;
  add(
    {
      id: 'stat-chaos-day',
      type: 'stat',
      angle: explosion
        ? `${explosion.day} was the loudest day in this chat's history: ${explosion.count} messages, ${explosion.zScore.toFixed(1)}σ above a normal day.` +
          (mostlyPhotos
            ? ` ${dumpedThatDay} of them were photos or videos, so this is a day somebody flooded the chat with pictures and what everyone said around them.`
            : '') +
          ' The material is how the day started and the hour it peaked. Name what actually happened and who did it — never that it was "busy" or "chaotic".'
        : 'No day stands out.',
      stats: explosion
        ? [
            { label: 'Date', value: explosion.day },
            { label: 'Messages', value: explosion.count },
            { label: 'Times the normal volume', value: `${explosion.zScore.toFixed(1)}σ` },
            ...(mostlyPhotos ? [{ label: 'Of which photos or videos', value: dumpedThatDay }] : []),
          ]
        : [],
      people: explosion?.topSenders.slice(0, 3).map((s) => token(s.value)) ?? [],
      evidenceMessageIds: explosion && t ? loudDay(t, explosion.day, 14) : [],
      strength: 0.85,
      targetLength: 240,
      quoteBudget: 14,
    },
    thin ??
      (!explosion ? 'no day stands out' : explosion.zScore < 2.5 ? 'no day really stands out' : null),
  );

  /* --- the group silence ---------------------------------------------- */
  const silence = stats.silences[0];
  add(
    {
      id: 'stat-silence',
      type: 'stat',
      angle: silence
        ? `The whole group said nothing for ${Math.round(silence.days)} days, from ${silence.from} to ${silence.to}. The material is the last thing anyone said before it and the message that finally broke it` +
          (silence.brokenBy?.sender ? ` (${token(silence.brokenBy.sender)})` : '') +
          '. What was the last word, and what was worth coming back for?'
        : 'The group never went quiet.',
      stats: silence
        ? [
            { label: 'Days of nothing', value: Math.round(silence.days) },
            { label: 'From', value: silence.from },
            { label: 'To', value: silence.to },
          ]
        : [],
      people: silence?.brokenBy?.sender ? [token(silence.brokenBy.sender)] : [],
      evidenceMessageIds: silence && t ? aroundGroupSilence(t, silence.from, silence.to) : [],
      strength: 0.7,
      quoteBudget: 6,
    },
    thin ??
      (!silence ? 'never went quiet' : silence.days < 21 ? 'never went quiet for long' : null),
  );

  /* --- signature words ------------------------------------------------ */
  const signatures = phrases.signatures.slice(0, 6);
  add(
    {
      id: 'stat-signatures',
      type: 'stat',
      angle:
        "Each person's own phrase — the words they use far more than anyone else here, measured. One dictionary entry per person, the phrase defined straight-faced as this chat would define it. The material is the phrases in use.",
      stats: signatures.map((s) => ({ label: token(s.owner), value: s.phrase })),
      people: signatures.map((s) => token(s.owner)),
      evidenceMessageIds: signatures.flatMap((s) => s.examples.map((e) => e.messageId)),
      strength: 0.85,
      targetLength: 260,
      quoteBudget: 10,
    },
    thin ?? (signatures.length < 3 ? 'nobody has a phrase of their own' : null),
  );

  /* --- five minutes away ---------------------------------------------- */
  const arrival = commitments.repeatedArrivals[0];
  add(
    {
      id: 'stat-arrivals',
      type: 'stat',
      angle: arrival
        ? `On ${arrival.day}, ${token(arrival.sender)} announced they were arriving ${arrival.claims} separate times across ${arrival.spanMinutes} minutes. The material is the whole thread in order — the announcements and what everyone else said between them.`
        : 'Nobody claims to be five minutes away.',
      stats: arrival
        ? [
            { label: 'Arrival announcements', value: arrival.claims },
            { label: 'Minutes between the first and last', value: arrival.spanMinutes },
            { label: 'Date', value: arrival.day },
          ]
        : [],
      people: arrival ? [token(arrival.sender)] : [],
      evidenceMessageIds: arrival
        ? t
          ? arrivalThread(t, arrival.messageIds, 14)
          : arrival.messageIds
        : [],
      strength: 0.9,
      targetLength: 240,
      quoteBudget: 14,
    },
    thin ?? (!arrival ? 'nobody claims to be five minutes away' : null),
  );

  return out;
}

/* ------------------------------------------------------------------ *
 * Persona cards
 * ------------------------------------------------------------------ */

/**
 * Fewest messages that can support a card somebody would recognise as
 * themselves. Below it there is no signature phrase, no reliable timing and no
 * habit — only a name and a guess.
 */
const MIN_PERSONA_MESSAGES = 20;

/**
 * Who gets a card.
 *
 * Not everybody. A card for somebody with eleven messages is four sentences of
 * invention wearing a person's name — and the specification is explicit that an
 * inactive member should not be made to look as important as an active one
 * unless their absence is itself the joke, which is a *different* slide.
 */
function personaSlides(input: PlanInput, limit: number): Candidate[] {
  const { stats, phrases, commitments, interactions, tokenOf } = input;

  /*
    An absolute floor, not a share.

    Share alone lets a two-message member of a four-message chat through at 50%,
    and the card that comes back is four sentences of invention with somebody's
    name on it. There is no amount of a small chat that adds up to a falsifiable
    claim about a person — only messages do.
  */
  const eligible = stats.people.filter((p) => p.messages >= MIN_PERSONA_MESSAGES);

  const signatureOf = new Map(phrases.signatures.map((s) => [s.owner, s]));
  const commitmentOf = new Map(commitments.people.map((c) => [c.sender, c]));

  const shown = eligible.slice(0, limit);
  /*
    Scaled across the people who actually get a card, not across everybody in
    the export. A twelve-person chat where six clear the message floor should
    draw its bars against those six — including the absent seventh would put the
    top of every axis somewhere no card can reach, and every bar on every card
    would read low for no reason the reader can see.
  */
  const axesOf = computeScoreAxes({ stats, interactions, commitments, people: shown });

  return shown.map((person: PersonStats) => {
    const signature = signatureOf.get(person.name);
    const commitment = commitmentOf.get(person.name);

    /*
      Order matters here in a way it does not on other slides: a dossier prints
      its first three as the fact strip under the name, and the rest are prose
      material. So the three that identify a person at a glance go first —
      how much they said, how they say it, and how often they show up — and
      share of the chat, which the free deck already made its whole point,
      comes after them.
    */
    const stat: Stat[] = [
      { label: 'Messages', value: person.messages },
      { label: 'Average message length', value: Math.round(person.characters / Math.max(1, person.messages)) },
      { label: 'Active days', value: person.activeDays },
      { label: 'Share of the chat', value: `${Math.max(1, Math.round(person.share * 100))}%` },
    ];
    if (person.nightShare > 0.1) {
      stat.push({ label: 'Share after midnight', value: `${Math.round(person.nightShare * 100)}%` });
    }
    if (person.longestSilenceDays > 21) {
      stat.push({ label: 'Longest disappearance, days', value: Math.round(person.longestSilenceDays) });
    }
    if (signature) stat.push({ label: 'Their phrase', value: signature.phrase });
    if (commitment && commitment.counts.arriving > 3) {
      stat.push({ label: 'Times announced as arriving', value: commitment.counts.arriving });
    }

    const evidence = [
      ...(signature?.examples.map((e) => e.messageId) ?? []),
      ...(commitment?.examples.map((e) => e.messageId) ?? []),
    ];

    return {
      brief: {
        id: `persona-${tokenOf(person.name).replace(/\s+/g, '-').toLowerCase()}`,
        type: 'persona' as SlideType,
        format: 'profile' as SlideFormat,
        angle: `What ${tokenOf(person.name)} is actually like in this chat, argued from their own habits and their own words.`,
        stats: stat,
        scoreAxes: axesOf.get(person.name) ?? [],
        people: [tokenOf(person.name)],
        evidenceMessageIds: evidence,
        findingIds: [],
        sensitivity: 'low' as Sensitivity,
        // A card is worth more when there is something specific to hang it on.
        strength: Math.min(
          1,
          0.5 + (signature ? 0.2 : 0) + (commitment ? 0.1 : 0) + Math.min(0.2, person.share * 2),
        ),
        /*
          Three or four beats about this one person, under `BODY_BUDGET.profile`
          with room to spare — ask for more than the budget and the verifier
          flags `too-long` on every card for a rule the writer was told to
          break. The official title is no longer counted here: it has its own
          field, `closer`.
        */
        targetLength: 420,
        quoteBudget: 8,
      },
      suppressed: null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Discovered slides
 * ------------------------------------------------------------------ */

const TYPE_FOR_KIND: Record<string, SlideType> = {
  legendary_moment: 'legendary_moment',
  nostalgic_moment: 'nostalgia',
  inside_joke: 'inside_jokes',
  member_persona: 'persona',
};

/** Findings that are a scene rather than a pattern, and want the whole scene shown. */
const SCENE_KINDS: ReadonlySet<string> = new Set([
  'legendary_moment',
  'nostalgic_moment',
  'prediction_aged_badly',
  'failed_plan',
]);

function customSlides(input: PlanInput, floor: number): Candidate[] {
  return input.findings.map(({ finding, strength }) => ({
    brief: {
      id: `custom-${finding.id}`,
      type: TYPE_FOR_KIND[finding.kind] ?? ('custom_discovery' as SlideType),
      format: SHAPES_FOR_KIND[finding.kind]?.[0] ?? ('plain' as SlideFormat),
      angle: finding.detail ? `${finding.claim} — ${finding.detail}` : finding.claim,
      stats: [],
      scoreAxes: [],
      people: finding.people,
      evidenceMessageIds: finding.evidenceMessageIds,
      findingIds: [finding.id],
      sensitivity: finding.sensitivity,
      strength,
      targetLength: 220,
      quoteBudget: SCENE_KINDS.has(finding.kind) ? 14 : 6,
    },
    suppressed:
      strength < floor
        ? `evidence too thin to carry a slide (${strength.toFixed(2)})`
        : null,
  }));
}

/* ------------------------------------------------------------------ *
 * Folding findings into dossiers
 * ------------------------------------------------------------------ */

/** The write route caps a brief's angle; stay under it however many findings land. */
const MAX_ANGLE_CHARS = 1200;

const SENSITIVITY_RANK: Record<Sensitivity, number> = { low: 0, medium: 1, high: 2 };

function maxSensitivity(a: Sensitivity, b: Sensitivity): Sensitivity {
  return SENSITIVITY_RANK[b] > SENSITIVITY_RANK[a] ? b : a;
}

/**
 * Hands every verified finding about exactly one person to that person's
 * dossier.
 *
 * The dossier used to be written from statistics alone — a message count, an
 * average length, a signature phrase if one was measured — while the
 * detective's findings about the same person became separate slides. So the
 * one card with somebody's name on it was the one slide the investigation
 * never reached, and it read like it: true of them, and true of anyone with
 * similar numbers.
 *
 * A `member_persona` finding *is* dossier material and goes nowhere else: the
 * standalone slide is dropped, with a reason, rather than telling the same joke
 * twice. Every other kind — a contradiction, a prediction that aged badly, a
 * legendary moment — keeps its own slide, and the dossier is told it exists so
 * the writer can allude to it rather than retell it. Only the folded findings
 * lend the dossier their evidence; lending the others' would put the same
 * quote on two slides.
 */
function foldFindingsIntoDossiers(
  personas: Candidate[],
  customs: Candidate[],
  findings: PlanInput['findings'],
): void {
  const dossierOf = new Map<string, Candidate>();
  for (const persona of personas) {
    const subject = persona.brief.people[0];
    if (subject && !persona.suppressed) dossierOf.set(subject, persona);
  }
  if (dossierOf.size === 0) return;

  const findingOf = new Map(findings.map((f) => [`custom-${f.finding.id}`, f.finding]));

  for (const custom of customs) {
    if (custom.suppressed) continue;
    const finding = findingOf.get(custom.brief.id);
    if (!finding || finding.people.length !== 1) continue;
    const subject = finding.people[0]!;
    const dossier = dossierOf.get(subject);
    if (!dossier) continue;

    const owned = finding.kind === 'member_persona';
    const note = owned
      ? `
The investigation found, with evidence: ${finding.claim}${finding.detail ? ` — ${finding.detail}` : ''}`
      : `
Also on the record, told on its own slide (${custom.brief.id}) — allude to it, do not retell it, and do not borrow its figures: ${finding.claim}`;
    if (dossier.brief.angle.length + note.length > MAX_ANGLE_CHARS) continue;

    dossier.brief.angle += note;
    dossier.brief.findingIds = [...dossier.brief.findingIds, finding.id];
    dossier.brief.sensitivity = maxSensitivity(dossier.brief.sensitivity, finding.sensitivity);

    if (!owned) continue;

    // The detective's quotes lead: they were chosen for being quotable, and the
    // writer can only quote what reaches it as evidence.
    const ids = new Set([
      ...finding.quotes.map((q) => q.messageId),
      ...finding.evidenceMessageIds,
      ...dossier.brief.evidenceMessageIds,
    ]);
    dossier.brief.evidenceMessageIds = [...ids].slice(0, 40);
    dossier.brief.strength = Math.min(1, dossier.brief.strength + 0.1);
    custom.suppressed = `folded into the dossier of ${subject}`;
  }
}

/* ------------------------------------------------------------------ *
 * The plan
 * ------------------------------------------------------------------ */

export interface DeckPlan {
  briefs: SlideBrief[];
  /** What was considered and dropped, and why. Debug surface, never shown. */
  suppressed: SuppressionNote[];
}

/** `a` and `b` alternately, then whatever is left of the longer one. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
}

export function planDeck(input: PlanInput, options: PlanOptions = {}): DeckPlan {
  const {
    maxStatSlides = 7,
    maxCustomSlides = 8,
    maxPersonaSlides = 12,
    floor = 0.3,
  } = options;

  const transcript = input.messages ? new Transcript(input.messages) : null;

  const suppressed: SuppressionNote[] = [];
  const keep = (candidates: Candidate[], limit: number): SlideBrief[] => {
    const surviving: SlideBrief[] = [];
    for (const c of candidates) {
      if (c.suppressed) {
        suppressed.push({ slide: c.brief.id, reason: c.suppressed });
        continue;
      }
      surviving.push(c.brief);
    }
    surviving.sort((a, b) => b.strength - a.strength);

    // Anything past the cap is dropped explicitly rather than silently, so a
    // reader of the debug view can tell "we found nothing" from "we found
    // plenty and this is the top ten".
    for (const dropped of surviving.slice(limit)) {
      suppressed.push({ slide: dropped.id, reason: `past the cap of ${limit}` });
    }
    return surviving.slice(0, limit);
  };

  // Folded before the caps are applied, so a persona finding reaches its
  // dossier even when the discovered pool is over the limit — the dossier is
  // never past the cap, and it is where that finding was always going.
  const personaCandidates = personaSlides(input, maxPersonaSlides);
  const customCandidates = customSlides(input, floor);
  foldFindingsIntoDossiers(personaCandidates, customCandidates, input.findings);

  const stats = keep(statSlides(input, transcript), maxStatSlides);
  const personas = keep(personaCandidates, maxPersonaSlides);
  const customs = keep(customCandidates, maxCustomSlides);

  const opener = stats.filter((s) => s.type === 'opening');
  const events = stats.filter((s) => s.type !== 'opening');

  /*
    Costumes, deck-wide. Discovered slides first so they keep their best fit;
    the statistic slides take what is left, from a starting point that differs
    per chat. Seeded on the chat's size rather than on anything random, so a
    saved report and a regenerated one wear the same clothes.
  */
  const findingOf = new Map(input.findings.map((f) => [`custom-${f.finding.id}`, f.finding]));
  dress(
    [...customs, ...events],
    (brief) =>
      brief.id.startsWith('custom-')
        ? SHAPES_FOR_KIND[findingOf.get(brief.id)?.kind ?? ''] ?? ['plain']
        : STAT_SHAPES[brief.id] ?? ['plain'],
    (brief) => !brief.id.startsWith('custom-'),
    input.stats.totalMessages,
  );

  /*
    Order is the deck's pacing, not a ranking. The opener first. Then the
    discovered slides and the event slides alternate, strongest first on each
    side, so the reader never gets a run of one kind of material — and the first
    thing after the opener is something the investigation found, because that is
    what nobody else's report could contain. Personas come last because each
    person's own card is what they screenshot, and the end of the deck is where
    they stop to do it.
  */
  const briefs = [...opener, ...interleave(customs, events), ...personas];

  return { briefs, suppressed };
}
