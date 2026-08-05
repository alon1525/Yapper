'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatStats,
  MergeSuggestion,
  MomentWindow,
  ParseResult,
  RosterEntry,
} from '@wrapped/core';
import type { AnalyzeResponse } from '@/workers/analyze.worker';

export interface Analysis {
  parsed: ParseResult;
  stats: ChatStats;
  moments: MomentWindow[];
  fileName: string;
}

export type AnalyzerState =
  | { phase: 'idle' }
  /** `messages` is the real running count, which the scan step shows. */
  | { phase: 'working'; stage: string; fraction: number; messages: number }
  /** Parsed. Who is who is the one question only the reader can answer. */
  | { phase: 'roster'; people: RosterEntry[]; merges: MergeSuggestion[] }
  | { phase: 'done'; analysis: Analysis }
  | { phase: 'error'; message: string };

/**
 * Drives the analysis worker. Runs parse + stats + moment detection off the main
 * thread so an 18k-message export does not freeze the page mid-upload.
 */
export function useAnalyzer() {
  const workerRef = useRef<Worker | null>(null);
  /* The last count the worker reported. Held outside state so that finalizing —
     which re-enters the "working" phase after the roster step — can carry the
     figure forward. A counter that has climbed to 173,319 and then resets to
     zero reads as the file having been dropped. */
  const countRef = useRef(0);
  const [state, setState] = useState<AnalyzerState>({ phase: 'idle' });

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const analyze = useCallback((text: string, fileName: string) => {
    workerRef.current?.terminate();

    const worker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    countRef.current = 0;
    setState({ phase: 'working', stage: 'Opening your export', fraction: 0, messages: 0 });

    worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        countRef.current = Math.max(countRef.current, msg.messages);
        setState({
          phase: 'working',
          stage: msg.stage,
          fraction: msg.fraction,
          messages: countRef.current,
        });
      } else if (msg.type === 'roster') {
        countRef.current = msg.messages;
        // The worker keeps the parsed chat in memory while we ask, so answering
        // resumes rather than re-parses.
        setState({ phase: 'roster', people: msg.people, merges: msg.merges });
      } else if (msg.type === 'done') {
        setState({
          phase: 'done',
          analysis: { parsed: msg.parsed, stats: msg.stats, moments: msg.moments, fileName },
        });
        worker.terminate();
        workerRef.current = null;
      } else {
        setState({ phase: 'error', message: msg.message });
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = () => {
      setState({
        phase: 'error',
        message: 'Something went wrong reading that file. Try exporting the chat again.',
      });
    };

    worker.postMessage({ type: 'analyze', text, fileName });
  }, []);

  const finalize = useCallback((aliases: Record<string, string>) => {
    setState({
      phase: 'working',
      stage: 'Counting every single emoji',
      fraction: 0.6,
      messages: countRef.current,
    });
    workerRef.current?.postMessage({ type: 'finalize', aliases });
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    countRef.current = 0;
    setState({ phase: 'idle' });
  }, []);

  return { state, analyze, finalize, reset };
}
