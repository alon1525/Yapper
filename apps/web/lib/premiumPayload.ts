import {
  computeVoiceProfiles,
  findCandidateMoments,
  getWindowMessages,
  identifyMessages,
  pickVoiceSamples,
  type AnonymizedMessage,
  type MomentWindow,
} from '@wrapped/core';
import { briefDigest, type Brief, type BriefDigest } from './brief';
import type { Analysis } from './useAnalyzer';

/**
 * The premium payload: everything the full report is written from.
 *
 * This is the one request in the product that carries real names, and it is the
 * only one. Every free path — the preview, the detective, the writer — still
 * goes through the pseudonymiser, and `/privacy` says which is which. The paid
 * report is different because the reader unlocks it deliberately, for their own
 * group, and because the alternative was measurably worse: a model that has
 * only ever seen `Person E` cannot repeat the joke the group makes about
 * somebody's name, cannot tell that two nicknames are one person, and writes
 * the hedged, could-be-anyone prose that made the paid deck read like a
 * horoscope with statistics in it.
 *
 * The second half of that fix is volume. The old payload sent twelve bursts of
 * thirty messages — 360 lines out of a 25,812-message export, and on real data
 * 42% of those lines were `<image>` placeholders and bare `חחחח`, because the
 * burst scorer rewards exactly the density signature a sticker produces. What
 * reached the model was a few hundred reactions and a bullet list of
 * percentages, followed by an instruction never to state a statistic. There was
 * nothing else in the prompt to write from.
 *
 * So: a readable-text floor on the bursts, a real spread of every person's own
 * messages, and every year of the chat guaranteed a window. Roughly ten times
 * the material, still a small fraction of the export.
 */

export interface PersonDigest {
  /** Their real display name, as the reader's roster step left it. */
  sender: string;
  share: number;
  messages: number;
  nightShare: number;
  medianResponseMinutes: number | null;
  longestSilenceDays: number;
  stillGone: boolean;
  consistency: number;
  laughsPerMessage: number;
  topEmoji: string[];
  distinctiveWords: string[];
  meanLength: number;
  questionShare: number;
  oneWordShare: number;
  /**
   * Their own messages — the character card's actual raw material.
   *
   * This replaced a single `longestMessage`, which sounded like the most
   * characteristic thing a person ever sent and in practice was not. On the
   * export this was built against, three of the four longest messages were a
   * forwarded chain letter, a trip packing list and a logistics spreadsheet.
   * Two of them were not even written by the person they were attributed to.
   */
  samples: AnonymizedMessage[];
}

export interface PremiumPayload {
  language: string;
  participantCount: number;
  /** The onboarding's answers. Never any photo. */
  brief?: BriefDigest;
  /** Must match the fingerprint the entitlement was minted for. */
  fingerprint: {
    totalMessages: number;
    spanLabel: string;
    participantCount: number;
  };
  digest: {
    totalMessages: number;
    spanLabel: string;
    perDay: number;
    activeDays: number;
    topEmoji: { value: string; count: number }[];
    busiestDay: { day: string; count: number } | null;
    longestStreakDays: number;
    longestSilenceDays: number;
  };
  people: PersonDigest[];
  eras: { year: number; messages: number; busiestMonth: string | null }[];
  moments: {
    id: string;
    reasons: string[];
    participants: number;
    messages: AnonymizedMessage[];
  }[];
}

/*
  Capped again on the server: `app/api/premium/route.ts` bounds these arrays and
  rejects an oversized total. Raise anything here and raise it there too, or
  every real request starts failing as "Malformed request."
*/
const MOMENTS = 120;
const MESSAGES_PER_MOMENT = 50;
const SAMPLES_PER_PERSON = 30;
const DISTINCTIVE_PER_PERSON = 8;

/**
 * Characters of excerpt this payload will spend, and the reason it counts them
 * itself instead of leaving it to the server.
 *
 * The counts above are message counts, and a message is not a fixed size. On
 * the export this was tuned against people write about twenty characters at a
 * time, and 120 bursts come to seventy thousand characters. A group of
 * essayists writing three hundred characters a message produces fifteen times
 * that from the identical settings.
 *
 * The server's ceiling is a backstop against a hostile client, and it answers
 * with a 413. Reaching one after paying is the worst failure this product can
 * produce, so the honest client never gets close: it spends a budget it can
 * measure and sends less material rather than more requests. These two numbers
 * sit well under `MAX_EXCERPT_CHARS` in `app/api/premium/route.ts` — raise them
 * and check that they still do.
 */
const MOMENT_CHAR_BUDGET = 400_000;
const SAMPLE_CHAR_BUDGET = 80_000;

/**
 * Longest single message body sent from a burst.
 *
 * WhatsApp permits 65,536 characters in one message, and the request schema
 * rejects anything over 4,000 — so one forwarded essay in one selected window
 * turns an entitled, already-charged request into "Malformed request." Nothing
 * upstream truncates: `identifyMessages` copies the body verbatim, the way
 * `anonymizeMessages` always has, and the per-person spread avoids the problem
 * only because it filters on length before selecting.
 *
 * On the export this was measured against the longest body in 3,168 selected
 * messages was 2,170 characters, so this changes nothing there. It exists for
 * the export where it isn't, which is the one nobody will be watching.
 *
 * Two thousand rather than the schema's four: past a couple of thousand
 * characters a message is a document somebody pasted, the first paragraph is
 * enough to tell what it was, and the rest is bought at the paid model's input
 * rate.
 */
const MESSAGE_CHAR_CAP = 2_000;

/** Message text as it goes out: whole, or clearly cut. */
function capped(messages: AnonymizedMessage[]): AnonymizedMessage[] {
  return messages.map((m) =>
    m.text.length <= MESSAGE_CHAR_CAP
      ? m
      : // Marked rather than silently shortened. A model that quotes this can
        // only produce a quote the browser's verifier would reject, and an
        // ellipsis is the difference between it copying the visible part and it
        // completing a sentence nobody finished.
        { ...m, text: `${m.text.slice(0, MESSAGE_CHAR_CAP)}…[cut]` },
  );
}

/**
 * How much of a burst has to be readable text before it is a candidate.
 *
 * Half. Below that the window is people reacting to something rather than
 * saying it, and a model shown a wall of `<image>` will faithfully write that
 * the group sends a lot of pictures — which is true, and is the least
 * interesting sentence available about any group chat.
 */
const READABLE_FLOOR = 0.5;

/**
 * The bursts worth sending, with every year of the chat represented.
 *
 * Pure score ranking is what produced a report where the eras section had
 * nothing to say: the loudest year takes most of the slots and the quiet years
 * take none, so the model is asked to narrate 2022 having read nothing from
 * 2022. Each year gets its best window first, then the remaining slots go to
 * the highest-scoring windows left over.
 *
 * Chronological on the way out. The prompt asks for the arc of the years, and
 * an arc is much easier to see in a transcript that runs forwards than in one
 * sorted by how funny each part was.
 */
function selectMoments(
  candidates: MomentWindow[],
  limit: number,
  cost: (window: MomentWindow) => number,
): MomentWindow[] {
  // Priority order: each year's best window first so no year goes unrepresented,
  // then everything else by score. The budget is spent down this list, which is
  // what keeps a trim from quietly deleting the quiet years — they were paid for
  // before the loudest month's twentieth-best burst was.
  const bestOfYear = new Map<string, MomentWindow>();
  for (const window of candidates) {
    const year = window.day.slice(0, 4);
    const best = bestOfYear.get(year);
    if (!best || window.score > best.score) bestOfYear.set(year, window);
  }

  const priority = [...bestOfYear.values()].sort((a, b) => b.score - a.score);
  const covered = new Set(priority.map((w) => w.id));
  for (const window of candidates) {
    if (!covered.has(window.id)) priority.push(window);
  }

  const chosen: MomentWindow[] = [];
  let spent = 0;
  for (const window of priority) {
    if (chosen.length >= limit) break;
    const price = cost(window);
    // Never let the budget reject everything: a single window larger than the
    // whole allowance would otherwise produce a report written from nothing.
    if (spent > 0 && spent + price > MOMENT_CHAR_BUDGET) continue;
    chosen.push(window);
    spent += price;
  }

  // Chronological on the way out. The prompt asks for the arc of the years, and
  // an arc is much easier to see in a transcript that runs forwards than in one
  // sorted by how funny each part was.
  return chosen.sort((a, b) => a.startId - b.startId);
}

export function buildPremiumPayload(analysis: Analysis, brief?: Brief): PremiumPayload {
  const { parsed, stats } = analysis;

  const voices = computeVoiceProfiles(parsed, stats.language, DISTINCTIVE_PER_PERSON);
  const voiceOf = new Map(voices.map((v) => [v.name, v]));

  /*
    Everyone gets the same number of lines, and the number falls for everybody
    at once when the group is large or writes long. Trimming per-person as the
    budget runs out would spend it all on whoever the roster happens to list
    first and leave the last few people with a card written from nothing —
    which is the exact shortage this whole change exists to fix, reintroduced
    at the bottom of the cast list where it is hardest to notice.
  */
  let samples = pickVoiceSamples(parsed, { perPerson: SAMPLES_PER_PERSON });
  const sampled = [...samples.values()].flat();
  const sampleChars = sampled.reduce((n, m) => n + m.body.length, 0);
  if (sampleChars > SAMPLE_CHAR_BUDGET && sampled.length > 0) {
    const meanLine = Math.max(1, sampleChars / sampled.length);
    const roster = Math.max(1, samples.size);
    samples = pickVoiceSamples(parsed, {
      perPerson: Math.max(6, Math.floor(SAMPLE_CHAR_BUDGET / roster / meanLine)),
    });
  }

  const people: PersonDigest[] = stats.people.map((person) => {
    const voice = voiceOf.get(person.name);
    return {
      sender: person.name,
      share: person.share,
      messages: person.messages,
      nightShare: person.nightShare,
      medianResponseMinutes:
        person.medianResponseMs === null
          ? null
          : Math.round(person.medianResponseMs / 60000),
      longestSilenceDays: Math.round(person.longestSilenceDays),
      stillGone: person.stillGone,
      consistency: person.consistency,
      laughsPerMessage: person.messages > 0 ? person.laughs / person.messages : 0,
      topEmoji: person.topEmoji.slice(0, 3).map((e) => e.value),
      distinctiveWords: (voice?.distinctive ?? []).map((w) => w.value),
      meanLength: Math.round(voice?.meanLength ?? 0),
      questionShare: voice?.questionShare ?? 0,
      oneWordShare: voice?.oneWordShare ?? 0,
      samples: identifyMessages(samples.get(person.name) ?? []),
    };
  });

  // Years rather than months: a nine-year chat has an arc, and the arc is the
  // part a group has genuinely forgotten.
  const byYear = new Map<number, number>();
  const monthByYear = new Map<number, { key: string; count: number }>();
  for (const month of stats.monthly) {
    byYear.set(month.year, (byYear.get(month.year) ?? 0) + month.count);
    const best = monthByYear.get(month.year);
    if (!best || month.count > best.count) monthByYear.set(month.year, { key: month.key, count: month.count });
  }

  const fingerprint = {
    totalMessages: stats.totalMessages,
    spanLabel: stats.span.label,
    participantCount: parsed.participants.length,
  };

  /*
    Not scrubbed, and that is the point rather than an oversight. The notes box
    is where a reader writes "תמיר never replies because he works nights", and
    on every other route that name is replaced so it matches the tokens in the
    excerpts. Here the excerpts carry real names, so scrubbing the notes would
    be the one thing that made the prompt incoherent: a briefing about Person C
    attached to a transcript in which nobody is called Person C.
  */
  const digestedBrief = briefDigest(brief, (text) => text);

  // Re-scored here rather than reusing `analysis.moments`. The worker's set is
  // shared with the free deck and is deliberately unfiltered; the paid report
  // wants a readable-text floor, and applying it upstream would reshape decks
  // that nobody asked to change. Over-fetching before selection so that the
  // year-coverage pass has quiet years to choose from at all.
  const candidates = findCandidateMoments(parsed, {
    limit: MOMENTS * 4,
    minReadableShare: READABLE_FLOOR,
  });

  return {
    language: stats.language,
    participantCount: parsed.participants.length,
    ...(digestedBrief ? { brief: digestedBrief } : {}),
    fingerprint,
    digest: {
      totalMessages: stats.totalMessages,
      spanLabel: stats.span.label,
      perDay: Math.round(stats.perDay),
      activeDays: stats.span.activeDays,
      topEmoji: stats.topEmoji.slice(0, 8),
      busiestDay: stats.busiestDay
        ? { day: stats.busiestDay.day, count: stats.busiestDay.count }
        : null,
      longestStreakDays: stats.longestStreak?.days ?? 0,
      longestSilenceDays: Math.round(stats.silences[0]?.days ?? 0),
    },
    people,
    eras: [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, messages]) => ({
        year,
        messages,
        busiestMonth: monthByYear.get(year)?.key ?? null,
      })),
    moments: selectMoments(candidates, MOMENTS, (w) =>
      getWindowMessages(parsed, w, MESSAGES_PER_MOMENT).reduce((n, m) => n + m.body.length, 0),
    ).map((w) => ({
      id: w.id,
      reasons: w.reasons,
      participants: w.participants.length,
      messages: capped(identifyMessages(getWindowMessages(parsed, w, MESSAGES_PER_MOMENT))),
    })),
  };
}
