'use client';

import { useCallback, useRef, useState } from 'react';
import {
  DiscoverySchema,
  WrittenDeckSchema,
  analyzeCommitments,
  analyzeInteractions,
  analyzePhrases,
  anonymizeMessages,
  createVerificationContext,
  findStalledPlans,
  isDuplicate,
  planDeck,
  restoreDeep,
  verifyDictionary,
  verifyFinding,
  verifySlideCopy,
  type AnonymizedMessage,
  type Discovery,
  type Finding,
  type Slide,
  type SlideBrief,
  type SuppressionNote,
  type VerificationIssue,
  type WrittenDeck,
} from '@wrapped/core';
import type { Brief } from './brief';
import { buildDetectivePayload } from './detectivePayload';
import type { Analysis } from './useAnalyzer';

/**
 * The pipeline, driven from the browser.
 *
 * Verification sits between the two model calls, and it sits *here* rather than
 * on the server because this is the only place with the reader's real messages.
 * The server was sent an anonymised excerpt; it has no way to tell a quote that
 * was said from one that was invented. The browser does, so it is the browser
 * that throws findings away.
 *
 *   detective  →  verify  →  plan  →  write  →  verify copy  →  restore names
 *   (server)      (here)     (here)   (server)   (here)          (here)
 *
 * The names are restored last, exactly as in the free preview: paying does not
 * change who holds the mapping, and neither does adding stages.
 */

export type ReportState =
  | { phase: 'idle' }
  | { phase: 'unlocking' }
  | { phase: 'investigating' }
  | { phase: 'verifying' }
  | { phase: 'writing' }
  | { phase: 'ready'; deck: ReportDeck }
  | { phase: 'error'; message: string };

export interface ReportDeck {
  slides: Slide[];
  dictionary: WrittenDeck['dictionary'];
  /**
   * Everything that was considered and cut, and why.
   *
   * Kept on the deck rather than logged and forgotten because "why is there no
   * night owl slide" is the first question anyone asks of a report that dropped
   * one, and the answer is always more interesting than the slide would have
   * been. Never rendered to a normal reader.
   */
  audit: {
    suppressed: SuppressionNote[];
    rejectedFindings: { id: string; claim: string; issues: VerificationIssue[] }[];
    rejectedSlides: { id: string; issues: VerificationIssue[] }[];
    findingsProposed: number;
    findingsVerified: number;
  };
}

async function post(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(parsed.error ?? 'Something went wrong.');
  }
  return response.json();
}

/** Quotes offered to the writer for one slide, drawn from its own evidence. */
const QUOTES_PER_SLIDE = 4;

export function useReport(analysis: Analysis, brief?: Brief) {
  const [state, setState] = useState<ReportState>({ phase: 'idle' });
  // A ref, not the phase: setState lands on the next render, so three taps in
  // one tick all pass a state-based check and all reach the paid route.
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const { parsed, stats } = analysis;
      const { payload, pseudonymizer } = buildDetectivePayload(analysis, brief);

      setState({ phase: 'unlocking' });
      const checkout = (await post('/api/checkout', payload.fingerprint)) as { token: string };
      const token = checkout.token;

      /* --- stage 4: investigate ------------------------------------- */
      setState({ phase: 'investigating' });
      const discovery = DiscoverySchema.parse(
        await post('/api/detective', { ...payload, token }),
      ) as Discovery;

      /* --- stage 5: verify against the real messages ----------------- */
      setState({ phase: 'verifying' });
      const ctx = createVerificationContext(parsed, pseudonymizer);

      const verified: { finding: Finding; strength: number }[] = [];
      const rejectedFindings: ReportDeck['audit']['rejectedFindings'] = [];

      for (const finding of discovery.findings) {
        const verdict = verifyFinding(finding, ctx);
        if (verdict.action === 'reject') {
          rejectedFindings.push({
            id: finding.id,
            claim: finding.claim,
            issues: verdict.issues,
          });
          continue;
        }
        verified.push({ finding: verdict.value, strength: verdict.strength });
      }

      /* --- stage 6: plan --------------------------------------------- */
      const language = stats.language;
      const plan = planDeck({
        stats,
        interactions: analyzeInteractions(parsed),
        commitments: analyzeCommitments(parsed, language),
        phrases: analyzePhrases(parsed, language),
        stalledPlans: findStalledPlans(parsed, language),
        findings: verified,
        tokenOf: (name) => pseudonymizer.tokenFor(name),
      });

      // Quotes are chosen here, from verified evidence, so the writer is never
      // in a position to supply one. Anything it returns that is not in this set
      // fails `verifySlideCopy` on the way back.
      const byId = new Map(parsed.messages.map((m) => [m.id, m]));
      const evidence: Record<string, AnonymizedMessage[]> = {};
      for (const slideBrief of plan.briefs) {
        const messages = slideBrief.evidenceMessageIds
          .map((id) => byId.get(id))
          .filter((m): m is NonNullable<typeof m> => m !== undefined && m.kind === 'text')
          .slice(0, QUOTES_PER_SLIDE);
        if (messages.length > 0) {
          evidence[slideBrief.id] = anonymizeMessages(messages, pseudonymizer);
        }
      }

      /* --- stage 7: write --------------------------------------------- */
      setState({ phase: 'writing' });
      const written = WrittenDeckSchema.parse(
        await post('/api/write', {
          token,
          language,
          participantCount: payload.participantCount,
          ...(payload.brief ? { brief: payload.brief } : {}),
          fingerprint: payload.fingerprint,
          digest: { totalMessages: stats.totalMessages, spanLabel: stats.span.label },
          voice: discovery.voice,
          groupSummary: discovery.groupIdentity.summary,
          briefs: plan.briefs satisfies SlideBrief[],
          evidence,
        }),
      ) as WrittenDeck;

      /* --- stage 8: check the copy ------------------------------------- */
      const slides: Slide[] = [];
      const rejectedSlides: ReportDeck['audit']['rejectedSlides'] = [];

      for (const slide of written.slides) {
        // The stats a slide may cite are the planner's, not the writer's — a
        // writer that returned its own `stats` array could otherwise legitimise
        // any number by listing it.
        const planned = plan.briefs.find((b) => b.id === slide.id);
        const checked = verifySlideCopy(
          { ...slide, stats: planned?.stats ?? [], evidenceMessageIds: planned?.evidenceMessageIds ?? [] },
          ctx,
        );

        if (checked.action === 'reject') {
          rejectedSlides.push({ id: slide.id, issues: checked.issues });
          continue;
        }
        // A near-duplicate of something already accepted is dropped rather than
        // shown: two ways of saying one joke reads as the report running out.
        if (slides.some((kept) => isDuplicate(kept, checked.value))) {
          rejectedSlides.push({
            id: slide.id,
            issues: [{ code: 'duplicate', message: 'Says the same thing as an earlier slide.' }],
          });
          continue;
        }
        slides.push(checked.value);
      }

      // The dictionary is the easiest thing here to forget to check: it arrives
      // beside the slides, looks like decoration, and is model-written prose
      // asserting what a phrase means. An invented entry is worse than an
      // invented slide, because a definition reads as fact rather than as a joke.
      const dictionary = verifyDictionary(written.dictionary, ctx);
      for (const entry of dictionary.rejected) {
        rejectedSlides.push({ id: `dictionary:${entry.phrase}`, issues: entry.issues });
      }

      const deck: ReportDeck = {
        // Names go back on here, in the browser. The server never held the map.
        slides: restoreDeep(slides, pseudonymizer),
        dictionary: restoreDeep(dictionary.kept, pseudonymizer),
        audit: {
          suppressed: plan.suppressed,
          rejectedFindings,
          rejectedSlides,
          findingsProposed: discovery.findings.length,
          findingsVerified: verified.length,
        },
      };

      setState({ phase: 'ready', deck });
    } catch (error) {
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Could not build your report.',
      });
    } finally {
      inFlight.current = false;
    }
  }, [analysis, brief]);

  return { state, run };
}
