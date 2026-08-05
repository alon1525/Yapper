'use client';

import { useCallback, useRef, useState } from 'react';
import { restoreDeep } from '@wrapped/core';
import type { Brief } from './brief';
import { buildPremiumPayload } from './premiumPayload';
import type { PremiumReport } from './premiumPrompt';
import type { Analysis } from './useAnalyzer';

/**
 * Unlock, then generate. Two requests, one button.
 *
 * The guard is a ref rather than the `phase` state for the same reason the free
 * AI slide needed one: `setState` lands on the next render, so a double-tap in
 * a single tick passes any state-based check. This is the most expensive call
 * in the product, so it is also the one where a stray second tap matters most.
 */

export type PremiumState =
  | { phase: 'locked' }
  | { phase: 'unlocking' }
  | { phase: 'generating' }
  | { phase: 'ready'; report: PremiumReport; demo: boolean }
  | { phase: 'error'; message: string };

async function post(url: string, body: unknown): Promise<{ data: unknown; demo: boolean }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(parsed.error ?? 'Something went wrong.');
  }
  // Set by the server when no key is configured and the report was built
  // deterministically. The deck labels it rather than passing it off as written.
  return { data: await response.json(), demo: response.headers.get('X-Wrapped-Demo') === '1' };
}

export function usePremium(analysis: Analysis, brief?: Brief) {
  const [state, setState] = useState<PremiumState>({ phase: 'locked' });
  const inFlight = useRef(false);

  const unlock = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const { payload, pseudonymizer } = buildPremiumPayload(analysis, brief);

      setState({ phase: 'unlocking' });
      const { data: checkout } = await post('/api/checkout', payload.fingerprint);
      const { token } = checkout as { token: string };

      setState({ phase: 'generating' });
      const { data: raw, demo } = await post('/api/premium', { ...payload, token });

      // Names come back here, in the browser, exactly as they do for the free
      // preview. Paying does not change who holds the mapping.
      setState({ phase: 'ready', report: restoreDeep(raw as PremiumReport, pseudonymizer), demo });
    } catch (error) {
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Could not build your report.',
      });
    } finally {
      inFlight.current = false;
    }
  }, [analysis, brief]);

  return { state, unlock };
}
