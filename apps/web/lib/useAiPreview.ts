'use client';

import { useCallback, useRef, useState } from 'react';
import { restoreDeep } from '@wrapped/core';
import { buildPreviewPayload } from './aiPayload';
import type { Brief } from './brief';
import type { Analysis } from './useAnalyzer';

/**
 * The free preview's state, lifted out of the slide that renders it.
 *
 * It cannot live inside `AiSlide`. Slides unmount when you swipe past them, so
 * state held there is destroyed the moment the reader moves on — and pressing
 * "Write my story", swiping forward, then swiping back would silently pay for
 * the same story a second time. Holding it in the deck also lets the paywall
 * know whether the preview was ever actually read, which decides what it can
 * honestly claim.
 */

export interface Preview {
  memories: { title: string; story: string; cast: string[] }[];
  narrative: string;
  award: { name: string; winner: string; reason: string };
}

export type PreviewState =
  | { phase: 'gate' }
  | { phase: 'sending' }
  | { phase: 'done'; preview: Preview }
  | { phase: 'error'; message: string };

export function useAiPreview(
  /** Null when the deck was opened from this device's storage: the chat is not here. */
  analysis: Analysis | null,
  brief?: Brief,
  /** A story saved with the report opens already written. */
  initial?: PreviewState,
) {
  const [state, setState] = useState<PreviewState>(initial ?? { phase: 'gate' });
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current || !analysis) return;
    inFlight.current = true;
    setState({ phase: 'sending' });

    const { payload, pseudonymizer } = buildPreviewPayload(analysis, brief);

    try {
      const response = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setState({ phase: 'error', message: body.error ?? 'Could not write your story right now.' });
        return;
      }

      // Names are mapped back here, in the browser. The server never held them.
      setState({
        phase: 'done',
        preview: restoreDeep((await response.json()) as Preview, pseudonymizer),
      });
    } catch {
      setState({
        phase: 'error',
        message: 'Could not reach the server. Your statistics are all still here.',
      });
    } finally {
      inFlight.current = false;
    }
  }, [analysis, brief]);

  return { state, run };
}
