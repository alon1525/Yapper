'use client';

import { useCallback, useRef, useState } from 'react';
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
    const parsed = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    // Only ever set when the deployment runs with WRAPPED_DEBUG_ERRORS — see the
    // identical handling in useReport, which this must not drift from.
    const message = parsed.error ?? 'Something went wrong.';
    throw new Error(parsed.detail ? `${message} (${parsed.detail})` : message);
  }
  // Set by the server when no key is configured and the report was built
  // deterministically. The deck labels it rather than passing it off as written.
  return { data: await response.json(), demo: response.headers.get('X-Wrapped-Demo') === '1' };
}

/**
 * Puts the roster's spelling back on every character card.
 *
 * The paid report is written from real names, so nothing needs restoring — but
 * a name is now something the model retypes rather than a token it copies, and
 * a display name is frequently `ליאת🕎` or `בןבןבןבן דוד`. A model that quietly
 * drops the emoji or tidies the spelling produces a card headed with a name
 * that is not quite anybody's.
 *
 * The schema asks for one card per participant in the order given, so when the
 * count matches, position is the reliable identity and the model's spelling is
 * not. An exact match is left alone; anything else is snapped back to the
 * roster. When the counts disagree the model has departed from the contract and
 * its own labels are all there is to go on.
 */
function alignNames(report: PremiumReport, roster: string[]): PremiumReport {
  if (report.characters.length !== roster.length) return report;

  return {
    ...report,
    characters: report.characters.map((character, i) =>
      roster.includes(character.sender) ? character : { ...character, sender: roster[i]! },
    ),
  };
}

export function usePremium(analysis: Analysis, brief?: Brief) {
  const [state, setState] = useState<PremiumState>({ phase: 'locked' });
  const inFlight = useRef(false);

  const unlock = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const payload = buildPremiumPayload(analysis, brief);

      setState({ phase: 'unlocking' });
      const { data: checkout } = await post('/api/checkout', payload.fingerprint);
      const { token } = checkout as { token: string };

      setState({ phase: 'generating' });
      const { data: raw, demo } = await post('/api/premium', { ...payload, token });

      // Nothing to restore: unlike every free path, this report came back with
      // the group's own names already on it, because that is what was sent.
      setState({
        phase: 'ready',
        report: alignNames(
          raw as PremiumReport,
          payload.people.map((p) => p.sender),
        ),
        demo,
      });
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
