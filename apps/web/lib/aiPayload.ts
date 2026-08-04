import {
  anonymizeMessages,
  createPseudonymizer,
  getWindowMessages,
  type AnonymizedMessage,
  type Pseudonymizer,
} from '@wrapped/core';
import type { Analysis } from './useAnalyzer';

/**
 * Builds the only payload that ever leaves the browser, and only after the user
 * has explicitly asked for it.
 *
 * Two rules shape everything here:
 *  1. Real names never go in. Senders become `Person A`, and message bodies are
 *     swept for those same names, phone numbers and emails.
 *  2. The whole chat never goes in. Only the highest-scoring conversation
 *     windows — a few hundred messages out of a hundred thousand — which is
 *     what keeps this affordable as well as private.
 */

export interface AiPreviewPayload {
  language: string;
  participantCount: number;
  digest: {
    totalMessages: number;
    spanLabel: string;
    perDay: number;
    topTalker: { sender: string; share: number } | null;
    nightOwl: { sender: string; nightShare: number } | null;
    ghost: { sender: string; days: number } | null;
    topEmoji: { value: string; count: number }[];
  };
  moments: {
    id: string;
    reasons: string[];
    participants: number;
    messages: AnonymizedMessage[];
  }[];
}

const MOMENTS_IN_PREVIEW = 5;
const MESSAGES_PER_MOMENT = 40;

export function buildPreviewPayload(analysis: Analysis): {
  payload: AiPreviewPayload;
  pseudonymizer: Pseudonymizer;
} {
  const { parsed, stats, moments } = analysis;
  const p = createPseudonymizer(parsed.participants);

  const find = (name: string | null) => stats.people.find((x) => x.name === name) ?? null;

  const talker = stats.people[0] ?? null;
  const owl = find(stats.awards.nightOwl);
  const ghost = find(stats.awards.ghost);

  const payload: AiPreviewPayload = {
    language: stats.language,
    participantCount: parsed.participants.length,
    digest: {
      totalMessages: stats.totalMessages,
      spanLabel: stats.span.label,
      perDay: Math.round(stats.perDay),
      topTalker: talker ? { sender: p.tokenFor(talker.name), share: talker.share } : null,
      nightOwl: owl ? { sender: p.tokenFor(owl.name), nightShare: owl.nightShare } : null,
      ghost: ghost ? { sender: p.tokenFor(ghost.name), days: ghost.longestSilenceDays } : null,
      topEmoji: stats.topEmoji.slice(0, 5),
    },
    moments: moments.slice(0, MOMENTS_IN_PREVIEW).map((w) => ({
      id: w.id,
      reasons: w.reasons,
      participants: w.participants.length,
      messages: anonymizeMessages(
        getWindowMessages(parsed, w, MESSAGES_PER_MOMENT),
        p,
      ),
    })),
  };

  return { payload, pseudonymizer: p };
}
