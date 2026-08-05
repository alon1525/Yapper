/// <reference lib="webworker" />

import {
  applyAliases,
  computeStats,
  findCandidateMoments,
  parseChat,
  roster,
  suggestMerges,
  type ChatStats,
  type MergeSuggestion,
  type MomentWindow,
  type ParseResult,
  type RosterEntry,
} from '@wrapped/core';

/**
 * The entire free tier runs in here. Nothing in this file makes a network
 * request, and that is the point — the landing page's privacy claim is only
 * true because parsing and statistics never leave the worker.
 *
 * Two phases, because of a question that can only be asked after parsing: an
 * export names unsaved contacts by phone number, nobody wants to read a story
 * about `+972 58-666-8048`, and a contact renamed in 2019 is sitting on the
 * leaderboard twice with half their messages each. Neither is knowable before
 * the file is read or fixable after the statistics are computed, so parsing
 * stops and hands the roster back.
 *
 * The parse result is held here between the phases so that answering costs
 * nothing — re-parsing a 173k-message export to apply two renames would be
 * several seconds of work to change two strings.
 */

export interface AnalyzeRequest {
  type: 'analyze';
  text: string;
  fileName?: string;
  dateOrder?: 'DMY' | 'MDY';
}

export interface FinalizeRequest {
  type: 'finalize';
  /**
   * Display name → what the user calls them. Empty values are ignored, and two
   * keys may share a value — that is how a merge is expressed.
   */
  aliases: Record<string, string>;
}

export type WorkerRequest = AnalyzeRequest | FinalizeRequest;

export type AnalyzeResponse =
  /** `messages` is a real running count, not the fraction scaled up. */
  | { type: 'progress'; stage: string; fraction: number; messages: number }
  | { type: 'roster'; people: RosterEntry[]; merges: MergeSuggestion[]; messages: number }
  | { type: 'done'; parsed: ParseResult; stats: ChatStats; moments: MomentWindow[] }
  | { type: 'error'; message: string };

const post = (msg: AnalyzeResponse) => (self as unknown as Worker).postMessage(msg);

let held: { parsed: ParseResult; fileName?: string } | null = null;

function finish(parsed: ParseResult, fileName?: string) {
  const messages = parsed.messages.length;

  post({ type: 'progress', stage: 'Counting every single emoji', fraction: 0.6, messages });
  const stats = computeStats(parsed, fileName ? { fileName } : {});

  post({ type: 'progress', stage: 'Looking for the moments you forgot', fraction: 0.85, messages });
  const moments = findCandidateMoments(parsed);

  post({ type: 'progress', stage: 'Writing your story', fraction: 1, messages });
  post({ type: 'done', parsed, stats, moments });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === 'finalize') {
      if (!held) {
        post({ type: 'error', message: 'Nothing to analyse. Upload your export again.' });
        return;
      }
      finish(applyAliases(held.parsed, event.data.aliases), held.fileName);
      return;
    }

    const { text, fileName, dateOrder } = event.data;

    post({ type: 'progress', stage: 'Reading your messages', fraction: 0.02, messages: 0 });

    const parsed = parseChat(text, {
      ...(dateOrder ? { dateOrder } : {}),
      // Parsing owns the first 55% of the bar. It is genuinely the slow part on
      // a large export, so the progress the user sees is real rather than a
      // timer pretending to be work.
      onProgress: (f, messages) =>
        post({
          type: 'progress',
          stage: f < 0.5 ? 'Reading your messages' : 'Sorting out who said what',
          fraction: 0.02 + f * 0.53,
          messages,
        }),
    });

    if (parsed.messages.length === 0) {
      post({
        type: 'error',
        message:
          parsed.warnings[0]?.message ??
          'No messages found in this file. Export your chat as .txt and try again.',
      });
      return;
    }

    // Always stop here, even when every contact was saved and nothing looks
    // like a duplicate. The reader is the only one who can confirm that, and a
    // step that appears for some chats and not others is a step nobody trusts.
    held = { parsed, ...(fileName ? { fileName } : {}) };
    post({
      type: 'roster',
      people: roster(parsed),
      merges: suggestMerges(parsed),
      messages: parsed.messages.length,
    });
  } catch (error) {
    post({
      type: 'error',
      message:
        error instanceof Error
          ? `Could not read this export: ${error.message}`
          : 'Could not read this export.',
    });
  }
};
