/// <reference lib="webworker" />

import {
  applyAliases,
  computeStats,
  findCandidateMoments,
  parseChat,
  unsavedParticipants,
  type ChatStats,
  type MomentWindow,
  type ParseResult,
} from '@wrapped/core';

/**
 * The entire free tier runs in here. Nothing in this file makes a network
 * request, and that is the point — the landing page's privacy claim is only
 * true because parsing and statistics never leave the worker.
 *
 * Two phases, because of a question that can only be asked after parsing: an
 * export names unsaved contacts by phone number, and nobody wants to read a
 * story about `+972 58-666-8048`. The parse result is held here between the
 * phases so that answering costs nothing — re-parsing a 173k-message export to
 * apply two renames would be several seconds of work to change two strings.
 */

export interface AnalyzeRequest {
  type: 'analyze';
  text: string;
  fileName?: string;
  dateOrder?: 'DMY' | 'MDY';
}

export interface FinalizeRequest {
  type: 'finalize';
  /** Display name → what the user calls them. Empty values are ignored. */
  aliases: Record<string, string>;
}

export type WorkerRequest = AnalyzeRequest | FinalizeRequest;

export type AnalyzeResponse =
  | { type: 'progress'; stage: string; fraction: number }
  | { type: 'needs-names'; unsaved: string[] }
  | { type: 'done'; parsed: ParseResult; stats: ChatStats; moments: MomentWindow[] }
  | { type: 'error'; message: string };

const post = (msg: AnalyzeResponse) => (self as unknown as Worker).postMessage(msg);

let held: { parsed: ParseResult; fileName?: string } | null = null;

function finish(parsed: ParseResult, fileName?: string) {
  post({ type: 'progress', stage: 'Counting every single emoji', fraction: 0.6 });
  const stats = computeStats(parsed, fileName ? { fileName } : {});

  post({ type: 'progress', stage: 'Looking for the moments you forgot', fraction: 0.85 });
  const moments = findCandidateMoments(parsed);

  post({ type: 'progress', stage: 'Writing your story', fraction: 1 });
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

    post({ type: 'progress', stage: 'Reading your messages', fraction: 0.02 });

    const parsed = parseChat(text, {
      ...(dateOrder ? { dateOrder } : {}),
      // Parsing owns the first 55% of the bar. It is genuinely the slow part on
      // a large export, so the progress the user sees is real rather than a
      // timer pretending to be work.
      onProgress: (f) =>
        post({
          type: 'progress',
          stage: f < 0.5 ? 'Reading your messages' : 'Sorting out who said what',
          fraction: 0.02 + f * 0.53,
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

    const unsaved = unsavedParticipants(parsed);
    if (unsaved.length > 0) {
      held = { parsed, ...(fileName ? { fileName } : {}) };
      post({ type: 'needs-names', unsaved });
      return;
    }

    finish(parsed, fileName);
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
