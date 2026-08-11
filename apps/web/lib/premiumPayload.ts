import {
  anonymizeMessages,
  computeVoiceProfiles,
  createPseudonymizer,
  getWindowMessages,
  type AnonymizedMessage,
  type Pseudonymizer,
} from '@wrapped/core';
import { briefDigest, type Brief, type BriefDigest } from './brief';
import type { Analysis } from './useAnalyzer';

/**
 * The premium payload: everything the full report is written from.
 *
 * Larger than the preview in every dimension — more moments, deeper excerpts,
 * and a per-person profile for every member — because the free tier's job is to
 * prove the idea works and this one's job is to be worth paying for.
 *
 * The privacy rules do not relax with the price. Every string here goes through
 * `scrub()`, including the two fields that are easy to forget because they are
 * derived rather than quoted: a person's distinctive vocabulary and their
 * longest message. Distinctive words are the likeliest leak in the whole
 * product — a nickname used by exactly one person is precisely what a
 * "words this person uses more than anyone else" metric is built to surface.
 */

export interface PersonDigest {
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
  longestMessage: string | null;
}

export interface PremiumPayload {
  language: string;
  participantCount: number;
  /** The onboarding's answers, notes already scrubbed. Never any photo. */
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

/**
 * Zalgo text — a base letter buried under dozens of combining marks — wins any
 * comparison made on `.length`, so it turns up as somebody's "longest message"
 * while being four visible characters. Collapsing runs of marks keeps the
 * quote readable and stops several hundred characters of noise from being
 * bought as prompt tokens. Two marks are kept because Hebrew niqqud and
 * ordinary accents are real text.
 */
function collapseCombining(text: string): string {
  return text.replace(/(\p{M}{2})\p{M}+/gu, '$1');
}

/*
  Capped again on the server: `app/api/premium/route.ts` bounds these arrays at
  14 moments and 40 messages and rejects over 250,000 characters of excerpt.
  This is the most expensive call in the product, so the route does not take the
  client's word for the size of it. Raise either number there as well, or every
  real request starts failing as "Malformed request."
*/
const MOMENTS = 12;
const MESSAGES_PER_MOMENT = 30;
const DISTINCTIVE_PER_PERSON = 6;
const LONGEST_MESSAGE_CHARS = 400;

export function buildPremiumPayload(
  analysis: Analysis,
  brief?: Brief,
): {
  payload: PremiumPayload;
  pseudonymizer: Pseudonymizer;
} {
  const { parsed, stats, moments } = analysis;
  const p = createPseudonymizer(parsed.participants);
  const voices = computeVoiceProfiles(parsed, stats.language, DISTINCTIVE_PER_PERSON);
  const voiceOf = new Map(voices.map((v) => [v.name, v]));

  const people: PersonDigest[] = stats.people.map((person) => {
    const voice = voiceOf.get(person.name);
    return {
      sender: p.tokenFor(person.name),
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
      // Derived from message bodies, so it carries whatever people call each
      // other. Scrubbed like any quoted line.
      distinctiveWords: (voice?.distinctive ?? []).map((w) => p.scrub(w.value)),
      meanLength: Math.round(voice?.meanLength ?? 0),
      questionShare: voice?.questionShare ?? 0,
      oneWordShare: voice?.oneWordShare ?? 0,
      longestMessage: person.longestMessage
        ? p.scrub(collapseCombining(person.longestMessage.body).slice(0, LONGEST_MESSAGE_CHARS))
        : null,
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

  const digestedBrief = briefDigest(brief, (text) => p.scrub(text));

  const payload: PremiumPayload = {
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
    moments: moments.slice(0, MOMENTS).map((w) => ({
      id: w.id,
      reasons: w.reasons,
      participants: w.participants.length,
      messages: anonymizeMessages(getWindowMessages(parsed, w, MESSAGES_PER_MOMENT), p),
    })),
  };

  return { payload, pseudonymizer: p };
}
