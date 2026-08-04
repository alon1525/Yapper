'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatStats, MomentWindow, ParseResult } from '@wrapped/core';
import type { AnalyzeResponse } from '@/workers/analyze.worker';

export interface Analysis {
  parsed: ParseResult;
  stats: ChatStats;
  moments: MomentWindow[];
  fileName: string;
}

export type AnalyzerState =
  | { phase: 'idle' }
  | { phase: 'working'; stage: string; fraction: number }
  /** Parsed, but some members are only known by phone number. */
  | { phase: 'naming'; unsaved: string[] }
  | { phase: 'done'; analysis: Analysis }
  | { phase: 'error'; message: string };

/**
 * Drives the analysis worker. Runs parse + stats + moment detection off the main
 * thread so an 18k-message export does not freeze the page mid-upload.
 */
export function useAnalyzer() {
  const workerRef = useRef<Worker | null>(null);
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

    setState({ phase: 'working', stage: 'Opening your export', fraction: 0 });

    worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        setState({ phase: 'working', stage: msg.stage, fraction: msg.fraction });
      } else if (msg.type === 'needs-names') {
        // The worker keeps the parsed chat in memory while we ask, so answering
        // resumes rather than re-parses.
        setState({ phase: 'naming', unsaved: msg.unsaved });
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
    setState({ phase: 'working', stage: 'Counting every single emoji', fraction: 0.6 });
    workerRef.current?.postMessage({ type: 'finalize', aliases });
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ phase: 'idle' });
  }, []);

  return { state, analyze, finalize, reset };
}
