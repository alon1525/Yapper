import type { ChatStats, PersonStats } from '../stats/types';
import type { CommitmentReport } from '../patterns/commitments';
import type { InteractionReport } from '../patterns/interactions';

/**
 * The score bars on a person's dossier.
 *
 * These exist because the design asks for `Restraint 0/100` next to a name, and
 * a model asked for that number will happily supply one. Every other figure in
 * this product is computed in TypeScript and handed to the writer precisely so
 * that cannot happen, and a score bar is not exempt just because it is funny.
 *
 * So the split is: **the value is computed here, the label is written by the
 * model.** An axis arrives as a measurement with a plain-English `meaning`, and
 * the writer's only job is to rename it into this group's own joke — "writes far
 * longer messages than anyone here" becomes "Explanation addiction", and the 97
 * underneath it is still the same 97 that came out of `characters / messages`.
 * The writer echoes the `key` back and `verifySlideCopy` checks the value has
 * not moved, which is what stops labels being swapped between axes until every
 * bar is flattering and none of them is true.
 *
 * Everything is scaled *within this group*. There is no absolute scale on which
 * anybody sends "a lot" of messages; there is only sending more than the other
 * four people, which is the comparison the reader is making anyway.
 */

export interface ScoreAxis {
  /** Stable id. The writer returns it so the value can be checked. */
  key: string;
  /** 0..100, scaled against the highest scorer in this group. */
  value: number;
  /** What a high score means, in plain language, for the writer to rename. */
  meaning: string;
}

/**
 * Below this the axis says nothing.
 *
 * The same reasoning as `hasClearWinner` in the planner: if everybody's night
 * share is 1%, a "night owl" bar is not a fact about anyone, it is rounding
 * noise drawn at 100px wide. Measured as spread relative to the mean, so it does
 * not care what units the underlying metric was in.
 */
const MIN_DISPERSION = 0.25;

/**
 * Fewest people for a percentile to mean anything.
 *
 * With two, every axis is 100 and 0 by construction — a bar chart of who is
 * taller. Three is the first number where the middle exists.
 */
const MIN_PEOPLE = 3;

function dispersion(values: number[]): number {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length < 2) return 0;
  const mean = usable.reduce((a, b) => a + b, 0) / usable.length;
  if (mean === 0) return 0;
  const variance = usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length;
  return Math.sqrt(variance) / mean;
}

/** One candidate axis, before it has been checked for being worth drawing. */
interface Candidate {
  key: string;
  meaning: string;
  /** The raw measurement per person, keyed by real name. */
  values: Map<string, number>;
  /**
   * How high the group's own leader must get before this axis says anything.
   *
   * Dispersion alone is not enough, and the way it fails is instructive. In a
   * chat where the five night shares are 1.4%, 1.2%, 1.0%, 0.9% and 0.0%, the
   * spread relative to the mean clears any sensible threshold — so the axis
   * survives, and the person on 1.4% gets a bar reading 100 next to a label
   * about being awake at four in the morning. They are not awake at four in the
   * morning. They are 0.2 points ahead of somebody who also is not.
   *
   * The floor is the same idea as `hasClearWinner` in the planner: a ranking is
   * only worth drawing once there is something to rank. Values match the
   * planner's own thresholds where it has one, so a night-owl bar cannot appear
   * on a dossier in a deck whose night-owl slide was suppressed.
   */
  floor: number;
}

/**
 * Scales a measurement to 0..100 against the group's own maximum.
 *
 * Deliberately not a rank. Ranking four people gives 100 / 67 / 33 / 0 whatever
 * the underlying numbers were, which draws the same four bars for a group where
 * one person sent ten times as much as the others and for a group where they are
 * all within twenty messages of each other. The ratio keeps that difference
 * visible, which is the only reason the bar is on the slide.
 */
function scaled(raw: number, max: number): number {
  if (!Number.isFinite(raw) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((raw / max) * 100)));
}

export interface ScoreInput {
  stats: ChatStats;
  interactions: InteractionReport;
  commitments: CommitmentReport;
  /** The people who are getting a card, in the planner's own order. */
  people: readonly PersonStats[];
}

/**
 * Every axis worth drawing, per person.
 *
 * Returns a map keyed by the person's real name — the planner tokenises on the
 * way into the brief, exactly as it does with everything else here, so this
 * module never has to know what a `Person A` is.
 */
export function computeScoreAxes(input: ScoreInput): Map<string, ScoreAxis[]> {
  const { stats, interactions, commitments, people } = input;
  const out = new Map<string, ScoreAxis[]>();
  for (const person of people) out.set(person.name, []);

  if (people.length < MIN_PEOPLE) return out;

  const commitmentOf = new Map(commitments.people.map((c) => [c.sender, c]));
  const killerOf = new Map(interactions.killers.map((k) => [k.sender, k]));

  /* The longest unbroken run of messages each person ever sent. */
  const monologueOf = new Map<string, number>();
  for (const run of interactions.monologues) {
    monologueOf.set(run.sender, Math.max(monologueOf.get(run.sender) ?? 0, run.length));
  }

  const per = (p: PersonStats, n: number) => (p.messages > 0 ? n / p.messages : 0);

  const candidates: Candidate[] = [
    {
      key: 'volume',
      meaning: 'sends a far larger share of this chat than anyone else',
      values: new Map(people.map((p) => [p.name, p.share])),
      // Somebody always holds a share; the dispersion check does the work here.
      floor: 0,
    },
    {
      key: 'message_length',
      meaning: 'writes much longer messages than anyone else here',
      values: new Map(people.map((p) => [p.name, p.characters / Math.max(1, p.messages)])),
      /* Characters. Under about a tweet nobody is writing essays. */
      floor: 90,
    },
    {
      key: 'laughter',
      meaning: 'laughs in a far higher share of their messages than anyone else',
      values: new Map(people.map((p) => [p.name, per(p, p.laughs)])),
      /* Laughs in at least one message in twenty. */
      floor: 0.05,
    },
    {
      key: 'night',
      meaning: 'is awake and posting after midnight when nobody else is',
      values: new Map(people.map((p) => [p.name, p.nightShare])),
      /* The planner's own night-owl threshold, so the two cannot disagree. */
      floor: 0.12,
    },
    {
      key: 'media',
      meaning: 'is responsible for most of the photographs and videos in here',
      values: new Map(people.map((p) => [p.name, p.attachments])),
      floor: 25,
    },
    {
      key: 'absence',
      meaning: 'disappears for far longer stretches than anyone else',
      values: new Map(people.map((p) => [p.name, p.longestSilenceDays])),
      /* Under three weeks is a holiday, not a disappearance. */
      floor: 21,
    },
    {
      key: 'consistency',
      meaning: 'turns up on a larger share of the days than anyone else',
      values: new Map(people.map((p) => [p.name, p.consistency])),
      floor: 0.1,
    },
    {
      key: 'starting',
      meaning: 'is usually the one who breaks the silence and starts things off',
      values: new Map(people.map((p) => [p.name, p.conversationsStarted])),
      floor: 10,
    },
    {
      key: 'deleting',
      meaning: 'deletes what they said more often than anyone else — second thoughts',
      values: new Map(people.map((p) => [p.name, p.deleted])),
      /* The planner will not run a deleted-messages slide under this either. */
      floor: 5,
    },
    {
      key: 'monologue',
      meaning: 'sends the longest unbroken runs of messages without waiting for a reply',
      values: new Map(people.map((p) => [p.name, monologueOf.get(p.name) ?? 0])),
      /* Same as the planner's monologue slide: under eight it is a conversation. */
      floor: 8,
    },
    {
      key: 'last_word',
      meaning: 'ends conversations far more often than their share of the talking explains',
      values: new Map(people.map((p) => [p.name, killerOf.get(p.name)?.index ?? 0])),
      /* An index of 1 is "ends as many as they speak" — the null result. */
      floor: 1.4,
    },
    {
      key: 'announcing_arrival',
      meaning: 'announces that they are on their way more than anyone else',
      values: new Map(
        people.map((p) => [p.name, commitmentOf.get(p.name)?.counts.arriving ?? 0]),
      ),
      floor: 10,
    },
    {
      key: 'putting_it_off',
      meaning: 'says "later", "not now" and "tomorrow" more than anyone else',
      values: new Map(
        people.map((p) => [p.name, commitmentOf.get(p.name)?.counts.deferral ?? 0]),
      ),
      floor: 10,
    },
  ];

  for (const candidate of candidates) {
    const raw = people.map((p) => candidate.values.get(p.name) ?? 0);
    const max = Math.max(...raw);

    // Nothing to measure, nothing large enough to be worth measuring, or
    // everybody measures the same. Each of those draws a bar that looks like an
    // observation and is not one.
    if (max <= 0) continue;
    if (max < candidate.floor) continue;
    if (dispersion(raw) < MIN_DISPERSION) continue;

    for (const person of people) {
      out.get(person.name)?.push({
        key: candidate.key,
        value: scaled(candidate.values.get(person.name) ?? 0, max),
        meaning: candidate.meaning,
      });
    }
  }

  /*
    Ordered by how far each score sits from what everyone else scored on that
    axis — not by the score itself.

    Sorting by raw value looks right and produces a bad deck. Half of these axes
    move with how much somebody talks, so the loudest member tops volume, media,
    starting *and* deferrals, and their card comes back as four bars pinned at
    100 and one outlier. It is accurate and it says nothing: five measurements of
    the same fact, which the leaderboard slide already made.

    Distance from the group's median answers the question the card is actually
    for — what is unusual about this person — and it promotes a 6 as readily as
    a 100. Being the only one who never turns up is as distinctive as being the
    one who always does, and on a dossier it is funnier.
  */
  const medians = new Map<string, number>();
  for (const candidate of candidates) {
    const values = [...out.values()]
      .flatMap((axes) => axes.filter((a) => a.key === candidate.key))
      .map((a) => a.value)
      .sort((a, b) => a - b);
    if (values.length === 0) continue;
    const mid = Math.floor(values.length / 2);
    medians.set(
      candidate.key,
      values.length % 2 === 0 ? ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2 : (values[mid] ?? 0),
    );
  }

  /*
    Normalised by each axis's own spread, or a wide axis beats a narrow one on
    arithmetic alone: being 60 points off the median of something that ranges
    across the full scale is ordinary, and being 30 off the median of something
    that only ranges 50 is not.
  */
  const spreads = new Map<string, number>();
  for (const candidate of candidates) {
    const values = [...out.values()]
      .flatMap((axes) => axes.filter((a) => a.key === candidate.key))
      .map((a) => a.value);
    if (values.length > 0) spreads.set(candidate.key, Math.max(...values) - Math.min(...values));
  }

  const unusualness = (a: ScoreAxis) =>
    Math.abs(a.value - (medians.get(a.key) ?? 50)) / Math.max(1, spreads.get(a.key) ?? 100);

  for (const axes of out.values()) {
    axes.sort((x, y) => unusualness(y) - unusualness(x) || y.value - x.value);
  }

  // A group's worth of `stats.totalMessages` is not enough on its own: the
  // planner already refuses per-person comparison below this, and a dossier is
  // the most per-person thing in the deck.
  if (stats.totalMessages < 30) return new Map(people.map((p) => [p.name, []]));

  return out;
}
