import {
  analyzeCommitments,
  analyzeInteractions,
  analyzePhrases,
  anonymizeMessages,
  conversationMessages,
  createPseudonymizer,
  findStalledPlans,
  scoreRecall,
  segmentConversations,
  type AnonymizedMessage,
  type Pseudonymizer,
} from '@wrapped/core';
import { briefDigest, type Brief, type BriefDigest } from './brief';
import type { Analysis } from './useAnalyzer';

/**
 * The dossier the detective reads.
 *
 * This is the payload for stage 4, and it is deliberately *not* a bigger version
 * of the premium payload. The premium prompt hands a model some statistics and
 * some transcript and asks for a finished report; this hands it the results of
 * eight deterministic passes — repeated phrases with first-use attribution,
 * interaction pairs, stalled plans, commitment counts — and asks a much narrower
 * question: what is going on in this group, and which messages prove it.
 *
 * Every string here is scrubbed. That matters more than it did before: the
 * README already names distinctive words as the likeliest leak in the product,
 * and an n-gram is strictly worse than a unigram because a two- or three-word
 * phrase carries a nickname far more often than a single word does. Session
 * keywords, phrase text, plan topics and commitment excerpts all go through
 * `scrub()` on the way in, and `scripts/ai-dry-run.ts` walks every one of them.
 */

export interface DetectivePayload {
  language: string;
  participantCount: number;
  brief?: BriefDigest;
  fingerprint: { totalMessages: number; spanLabel: string; participantCount: number };
  digest: {
    totalMessages: number;
    spanLabel: string;
    activeDays: number;
    perDay: number;
    firstDay: string;
    lastDay: string;
  };
  people: {
    sender: string;
    messages: number;
    share: number;
    firstDay: string;
    lastDay: string;
    nightShare: number;
    longestSilenceDays: number;
    stillGone: boolean;
    /** Their own phrase, if they have one. Scrubbed. */
    signature: string | null;
    arrivalClaims: number;
  }[];
  /** Repeated language, with who said it first. */
  phrases: {
    phrase: string;
    count: number;
    speakers: number;
    firstSpeaker: string;
    firstDay: string;
    exampleMessageIds: number[];
  }[];
  /** A phrase that escaped from one person to the group. */
  contagions: {
    phrase: string;
    patientZero: string;
    adopters: { sender: string; day: string; messageId: number }[];
    incubationDays: number;
    exampleMessageIds: number[];
  }[];
  interactions: {
    pingPong: { a: string; b: string; exchanges: number; longestVolley: number } | null;
    killers: { sender: string; kills: number; index: number; exampleMessageIds: number[] }[];
    monologues: { sender: string; length: number; day: string; startId: number; endId: number }[];
    mentions: { by: string; target: string; count: number }[];
  };
  commitments: {
    repeatedArrivals: { sender: string; day: string; claims: number; messageIds: number[] }[];
    questions: { kind: string; count: number; topAsker: string | null }[];
  };
  stalledPlans: {
    category: string;
    topics: string[];
    months: string[];
    mentions: number;
    participants: string[];
    exampleMessageIds: number[];
  }[];
  /** The conversations most worth reading, with their transcripts. */
  conversations: {
    id: string;
    day: string;
    messageCount: number;
    participants: string[];
    keywords: string[];
    summary: string;
    scores: { comedy: number; conflict: number; laughter: number; recall: number };
    messages: AnonymizedMessage[];
  }[];
}

/**
 * How many conversations carry a transcript.
 *
 * This is the single biggest lever on the cost of the whole pipeline, which is
 * why it is a named constant and configurable from the caller rather than a
 * slice buried in an expression. Everything else in the payload is a summary
 * measured in bytes; this is measured in thousands of tokens.
 */
const CONVERSATIONS = 18;
const MESSAGES_PER_CONVERSATION = 28;
const PHRASES = 20;

export interface DetectiveOptions {
  conversations?: number;
  messagesPerConversation?: number;
}

export function buildDetectivePayload(
  analysis: Analysis,
  brief?: Brief,
  options: DetectiveOptions = {},
): { payload: DetectivePayload; pseudonymizer: Pseudonymizer } {
  const { conversations = CONVERSATIONS, messagesPerConversation = MESSAGES_PER_CONVERSATION } =
    options;
  const { parsed, stats } = analysis;

  const p = createPseudonymizer(parsed.participants);
  const language = stats.language;
  const token = (name: string) => p.tokenFor(name);
  const clean = (text: string) => p.scrub(text);

  const phrases = analyzePhrases(parsed, language, { limit: PHRASES });
  const interactions = analyzeInteractions(parsed);
  const commitments = analyzeCommitments(parsed, language);
  const stalled = findStalledPlans(parsed, language);

  /*
    Sessions are scored and then ranked by what a comedian would want to read
    first: laughter and recall above raw size. The alternative — handing over the
    biggest windows — reliably surfaces the day everyone was coordinating a lift
    to the airport, which is the longest conversation in most chats and the least
    interesting one in all of them.
  */
  const sessions = scoreRecall(segmentConversations(parsed, language), parsed)
    .filter((c) => c.messageCount >= 5)
    .sort(
      (a, b) =>
        b.comedy * 0.5 + b.recall * 0.3 + b.conflict * 0.2 -
        (a.comedy * 0.5 + a.recall * 0.3 + a.conflict * 0.2),
    )
    .slice(0, conversations);

  const signatureOf = new Map(phrases.signatures.map((s) => [s.owner, s]));
  const commitmentOf = new Map(commitments.people.map((c) => [c.sender, c]));

  const payload: DetectivePayload = {
    language,
    participantCount: parsed.participants.length,
    ...(briefDigest(brief, clean) ? { brief: briefDigest(brief, clean)! } : {}),
    fingerprint: {
      totalMessages: stats.totalMessages,
      spanLabel: stats.span.label,
      participantCount: parsed.participants.length,
    },
    digest: {
      totalMessages: stats.totalMessages,
      spanLabel: stats.span.label,
      activeDays: stats.span.activeDays,
      perDay: Math.round(stats.perDay),
      firstDay: stats.span.first,
      lastDay: stats.span.last,
    },
    people: stats.people.map((person) => ({
      sender: token(person.name),
      messages: person.messages,
      share: person.share,
      firstDay: person.firstMessageDay,
      lastDay: person.lastMessageDay,
      nightShare: person.nightShare,
      longestSilenceDays: Math.round(person.longestSilenceDays),
      stillGone: person.stillGone,
      // Derived from message bodies, so it carries whatever people call each
      // other. Scrubbed exactly like a quoted line.
      signature: signatureOf.has(person.name)
        ? clean(signatureOf.get(person.name)!.phrase)
        : null,
      arrivalClaims: commitmentOf.get(person.name)?.counts.arriving ?? 0,
    })),
    phrases: phrases.repeated.map((r) => ({
      phrase: clean(r.phrase),
      count: r.count,
      speakers: r.speakers.length,
      firstSpeaker: token(r.firstUse.sender),
      firstDay: r.firstUse.day,
      exampleMessageIds: r.examples.map((e) => e.messageId),
    })),
    contagions: phrases.contagions.map((c) => ({
      phrase: clean(c.phrase),
      patientZero: token(c.patientZero),
      adopters: c.adopters.map((a) => ({
        sender: token(a.sender),
        day: a.day,
        messageId: a.messageId,
      })),
      incubationDays: c.incubationDays,
      exampleMessageIds: c.examples.map((e) => e.messageId),
    })),
    interactions: {
      pingPong: interactions.pingPong
        ? {
            a: token(interactions.pingPong.a),
            b: token(interactions.pingPong.b),
            exchanges: interactions.pingPong.exchanges,
            longestVolley: interactions.pingPong.longestVolley,
          }
        : null,
      killers: interactions.killers.slice(0, 5).map((k) => ({
        sender: token(k.sender),
        kills: k.kills,
        index: Number(k.index.toFixed(2)),
        exampleMessageIds: k.examples.map((e) => e.messageId),
      })),
      monologues: interactions.monologues.slice(0, 5).map((m) => ({
        sender: token(m.sender),
        length: m.length,
        day: m.day,
        startId: m.startId,
        endId: m.endId,
      })),
      mentions: interactions.mentionCounts
        .slice(0, 20)
        .map((m) => ({ by: token(m.by), target: token(m.target), count: m.count })),
    },
    commitments: {
      repeatedArrivals: commitments.repeatedArrivals.slice(0, 6).map((r) => ({
        sender: token(r.sender),
        day: r.day,
        claims: r.claims,
        messageIds: r.messageIds,
      })),
      questions: commitments.questions.map((q) => ({
        kind: q.kind,
        count: q.count,
        topAsker: q.topAsker ? token(q.topAsker) : null,
      })),
    },
    stalledPlans: stalled.map((s) => ({
      category: s.category,
      // Plan topics are matched words from message bodies — a place name, a
      // venue, sometimes a person's nickname. Scrubbed like everything else.
      topics: s.topics.map(clean),
      months: s.months,
      mentions: s.mentions,
      participants: s.participants.map(token),
      exampleMessageIds: s.exampleMessageIds,
    })),
    conversations: sessions.map((c) => ({
      id: c.id,
      day: c.startDay,
      messageCount: c.messageCount,
      participants: c.participants.map(token),
      keywords: c.keywords.map(clean),
      summary: clean(c.summary),
      scores: {
        comedy: Number(c.comedy.toFixed(2)),
        conflict: Number(c.conflict.toFixed(2)),
        laughter: Number(c.laughter.toFixed(2)),
        recall: Number(c.recall.toFixed(2)),
      },
      messages: anonymizeMessages(
        conversationMessages(parsed, c, messagesPerConversation),
        p,
      ),
    })),
  };

  return { payload, pseudonymizer: p };
}
