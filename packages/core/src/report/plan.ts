import type { ChatStats, PersonStats } from '../stats/types';
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
 * So every guaranteed slide declares the condition under which it earns its
 * place, and the planner drops the ones that do not. Ten slides that are true of
 * this group beat thirty that are true of any group.
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
}

export interface PlanOptions {
  /** Ceiling on statistic slides. Defaults to 10. */
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

function statSlides(input: PlanInput): Candidate[] {
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
    brief: Omit<SlideBrief, 'findingIds' | 'sensitivity' | 'targetLength' | 'scoreAxes'> &
      Partial<Pick<SlideBrief, 'sensitivity' | 'targetLength'>>,
    suppressed: string | null,
  ) => {
    out.push({
      brief: {
        findingIds: [],
        sensitivity: 'low',
        targetLength: 180,
        scoreAxes: [],
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
      format: 'plain',
      angle: 'How much of their lives this chat has quietly absorbed.',
      stats: [
        { label: 'Messages', value: stats.totalMessages },
        { label: 'Days spoken on', value: stats.span.activeDays },
        { label: 'Span', value: stats.span.label },
        { label: 'Messages per day', value: Math.round(stats.perDay) },
      ],
      people: [],
      evidenceMessageIds: [],
      strength: 1,
    },
    null,
  );

  /* --- leaderboard -------------------------------------------------- */
  const shares = people.map((p) => p.share);
  add(
    {
      id: 'stat-leaderboard',
      type: 'stat',
      format: 'leaderboard',
      angle: 'Who has been treating this group as their personal broadcast.',
      stats: people.slice(0, 6).map((p) => ({ label: token(p.name), value: p.messages })),
      people: people.slice(0, 6).map((p) => token(p.name)),
      evidenceMessageIds: [],
      strength: 0.9,
    },
    // In a two-person chat a leaderboard is a fact about arithmetic. It also
    // needs somebody actually ahead — three people on 33% each is a pie chart,
    // not a story.
    thin ??
      (people.length < 3
      ? 'fewer than three people'
      : hasClearWinner(shares, 1.25)
        ? null
        : 'everybody talks about the same amount'),
  );

  /* --- the ghost ---------------------------------------------------- */
  const ghost = people.find((p) => p.name === stats.awards.ghost);
  add(
    {
      id: 'stat-ghost',
      type: 'stat',
      format: 'plain',
      angle: 'The member who switched to a read-only subscription.',
      stats: ghost
        ? [
            { label: 'Longest silence, days', value: Math.round(ghost.longestSilenceDays) },
            { label: 'From', value: ghost.longestSilenceFrom ?? '' },
            { label: 'To', value: ghost.longestSilenceTo ?? '' },
          ]
        : [],
      people: ghost ? [token(ghost.name)] : [],
      evidenceMessageIds: [],
      strength: 0.85,
    },
    thin ??
      (!ghost
      ? 'nobody was quiet for long enough'
      : // A month is a holiday. Below that, calling somebody a ghost is a
        // slide about a normal person having a normal life.
        ghost.longestSilenceDays < 30
        ? `longest disappearance was only ${Math.round(ghost.longestSilenceDays)} days`
        : null),
  );

  /* --- night owl ---------------------------------------------------- */
  const owl = people.find((p) => p.name === stats.awards.nightOwl);
  const nightShares = people.filter((p) => p.messages >= 30).map((p) => p.nightShare);
  add(
    {
      id: 'stat-night-owl',
      type: 'stat',
      format: 'plain',
      angle: 'Who is awake when the group is not.',
      stats: owl
        ? [
            { label: 'Share after midnight', value: `${Math.round(owl.nightShare * 100)}%` },
            { label: 'Night messages', value: owl.nightMessages },
          ]
        : [],
      people: owl ? [token(owl.name)] : [],
      evidenceMessageIds: [],
      strength: 0.7,
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
      format: 'plain',
      angle: 'The gap between being asked something and answering it.',
      stats: fastest
        ? [
            {
              label: 'Median reply',
              value: `${Math.round((fastest.medianResponseMs ?? 0) / 1000)}s`,
            },
          ]
        : [],
      people: fastest ? [token(fastest.name)] : [],
      evidenceMessageIds: [],
      strength: 0.6,
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
      format: 'court_case',
      angle: 'The person whose message is reliably the last one.',
      stats: killer
        ? [
            { label: 'Conversations ended', value: killer.kills },
            { label: 'Above their share', value: `${killer.index.toFixed(1)}x` },
          ]
        : [],
      people: killer ? [token(killer.sender)] : [],
      evidenceMessageIds: killer?.examples.map((e) => e.messageId) ?? [],
      strength: 0.75,
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
  add(
    {
      id: 'stat-monologue',
      type: 'stat',
      format: 'court_case',
      angle: 'A wall of consecutive messages sent into total silence.',
      stats: monologue
        ? [
            { label: 'Messages in a row', value: monologue.length },
            { label: 'Minutes talking to nobody', value: monologue.durationMinutes },
            ...(monologue.silenceAfterMinutes !== null
              ? [{ label: 'Minutes before a reply', value: monologue.silenceAfterMinutes }]
              : []),
          ]
        : [],
      people: monologue ? [token(monologue.sender)] : [],
      evidenceMessageIds: monologue ? [monologue.startId, monologue.endId] : [],
      strength: 0.8,
      targetLength: 220,
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
      format: 'plain',
      angle: 'Two people conducting a private conversation in a group chat.',
      stats: pair
        ? [
            { label: 'Exchanges', value: pair.exchanges },
            { label: 'Longest unbroken volley', value: pair.longestVolley },
          ]
        : [],
      people: pair ? [token(pair.a), token(pair.b)] : [],
      evidenceMessageIds:
        pair && pair.longestVolleyStart >= 0 ? [pair.longestVolleyStart, pair.longestVolleyEnd] : [],
      strength: 0.8,
    },
    thin ?? (!pair ? 'no pair talks mainly to each other' : null),
  );

  /* --- media -------------------------------------------------------- */
  const mediaPerson = people.find((p) => p.name === stats.awards.mediaSpammer);
  add(
    {
      id: 'stat-media',
      type: 'stat',
      format: 'patch_notes',
      angle: 'Who is responsible for the photographs nobody asked for.',
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
      strength: 0.6,
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
      format: 'court_case',
      angle: 'Whatever it was, they thought better of it.',
      stats: deleter
        ? [
            { label: 'Messages deleted', value: deleter.deleted },
            { label: 'Deleted in the group', value: stats.totalDeleted },
          ]
        : [],
      people: deleter ? [token(deleter.name)] : [],
      evidenceMessageIds: [],
      strength: 0.7,
    },
    thin ?? (!deleter || deleter.deleted < 5 ? 'barely anything was deleted' : null),
  );

  /* --- the loudest day ----------------------------------------------- */
  const explosion = stats.explosions[0];
  add(
    {
      id: 'stat-chaos-day',
      type: 'stat',
      format: 'breaking_news',
      angle: 'The single day the group lost control of itself.',
      stats: explosion
        ? [
            { label: 'Date', value: explosion.day },
            { label: 'Messages', value: explosion.count },
            { label: 'Times the normal volume', value: `${explosion.zScore.toFixed(1)}σ` },
          ]
        : [],
      people: explosion?.topSenders.slice(0, 3).map((s) => token(s.value)) ?? [],
      evidenceMessageIds: [],
      strength: 0.85,
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
      format: 'plain',
      angle: 'The stretch where the group collectively forgot it existed.',
      stats: silence
        ? [
            { label: 'Days of nothing', value: Math.round(silence.days) },
            { label: 'From', value: silence.from },
            { label: 'To', value: silence.to },
          ]
        : [],
      people: silence?.brokenBy?.sender ? [token(silence.brokenBy.sender)] : [],
      evidenceMessageIds: [],
      strength: 0.7,
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
      format: 'dictionary_entry',
      angle: 'The phrase each person cannot stop saying.',
      stats: signatures.map((s) => ({ label: token(s.owner), value: s.phrase })),
      people: signatures.map((s) => token(s.owner)),
      evidenceMessageIds: signatures.flatMap((s) => s.examples.map((e) => e.messageId)),
      strength: 0.85,
      targetLength: 240,
    },
    thin ?? (signatures.length < 3 ? 'nobody has a phrase of their own' : null),
  );

  /* --- five minutes away ---------------------------------------------- */
  const arrival = commitments.repeatedArrivals[0];
  add(
    {
      id: 'stat-arrivals',
      type: 'stat',
      format: 'documentary',
      angle: 'One evening, one person, and several incompatible arrival times.',
      stats: arrival
        ? [
            { label: 'Arrival announcements', value: arrival.claims },
            { label: 'Minutes between the first and last', value: arrival.spanMinutes },
            { label: 'Date', value: arrival.day },
          ]
        : [],
      people: arrival ? [token(arrival.sender)] : [],
      evidenceMessageIds: arrival?.messageIds ?? [],
      strength: 0.9,
    },
    thin ?? (!arrival ? 'nobody claims to be five minutes away' : null),
  );

  /* --- activity over time ---------------------------------------------- */
  add(
    {
      id: 'stat-timeline',
      type: 'stat',
      format: 'timeline',
      angle: 'The shape of the group over the years — when it peaked and when it did not.',
      stats: stats.monthly
        .filter((_, i, all) => all.length <= 12 || i % Math.ceil(all.length / 12) === 0)
        .map((m) => ({ label: m.key, value: m.count })),
      people: [],
      evidenceMessageIds: [],
      strength: 0.65,
      targetLength: 160,
    },
    thin ?? (stats.monthly.length < 6 ? 'too short a history to have an arc' : null),
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
      share of the chat, which the leaderboard slide already made its whole
      point, comes after them.
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
      },
      suppressed: null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Discovered slides
 * ------------------------------------------------------------------ */

/** Which shape suits which kind of finding, absent a better idea. */
const FORMAT_FOR_KIND: Record<string, SlideFormat> = {
  group_identity: 'scientific_report',
  recurring_topic: 'scientific_report',
  member_persona: 'plain',
  inside_joke: 'dictionary_entry',
  contradiction: 'court_case',
  failed_plan: 'timeline',
  legendary_moment: 'breaking_news',
  nostalgic_moment: 'timeline',
  prediction_aged_badly: 'documentary',
  relationship_dynamic: 'company_structure',
  custom_slide: 'plain',
};

const TYPE_FOR_KIND: Record<string, SlideType> = {
  legendary_moment: 'legendary_moment',
  nostalgic_moment: 'nostalgia',
  inside_joke: 'inside_jokes',
  member_persona: 'persona',
};

function customSlides(input: PlanInput, floor: number): Candidate[] {
  return input.findings.map(({ finding, strength }) => ({
    brief: {
      id: `custom-${finding.id}`,
      type: TYPE_FOR_KIND[finding.kind] ?? ('custom_discovery' as SlideType),
      format: FORMAT_FOR_KIND[finding.kind] ?? ('plain' as SlideFormat),
      angle: finding.detail ? `${finding.claim} — ${finding.detail}` : finding.claim,
      stats: [],
      scoreAxes: [],
      people: finding.people,
      evidenceMessageIds: finding.evidenceMessageIds,
      findingIds: [finding.id],
      sensitivity: finding.sensitivity,
      strength,
      targetLength: 220,
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
Also on the record, told on its own slide (${custom.brief.id}) — allude to it, do not retell it: ${finding.claim}`;
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

export function planDeck(input: PlanInput, options: PlanOptions = {}): DeckPlan {
  const {
    maxStatSlides = 10,
    maxCustomSlides = 8,
    maxPersonaSlides = 12,
    floor = 0.3,
  } = options;

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

  const stats = keep(statSlides(input), maxStatSlides);
  const personas = keep(personaCandidates, maxPersonaSlides);
  const customs = keep(customCandidates, maxCustomSlides);

  /*
    Order is the deck's pacing, not a ranking. Statistics open because they are
    the trust-building part — verifiable, unarguable, and they establish that
    somebody really did read the whole thing. The discovered slides land in the
    middle where the reader is already convinced. Personas come last because
    each person's own card is what they screenshot, and the end of the deck is
    where they stop to do it.
  */
  const briefs = [
    ...stats.filter((s) => s.type === 'opening'),
    ...stats.filter((s) => s.type !== 'opening').slice(0, Math.ceil(stats.length / 2)),
    ...customs,
    ...stats.filter((s) => s.type !== 'opening').slice(Math.ceil(stats.length / 2)),
    ...personas,
  ];

  return { briefs, suppressed };
}
