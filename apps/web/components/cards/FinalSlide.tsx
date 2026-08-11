'use client';

import { useState } from 'react';
import { useCopy } from '@/lib/copy';
import { num, spanLabel } from '@/lib/localFormat';
import type { Analysis } from '@/lib/useAnalyzer';
import { GROUP_SLOT_BACKDROP } from './photos';
import { SharePack } from './SharePack';
import { DeckButton, Eyebrow, Headline, Punchline, Slide, type Backdrop } from './Shell';

/**
 * Closes on the same lime the deck opened on. Read from the photo table so the
 * onboarding's preview tile of this slide cannot be drawn on a different one.
 */
export const FINAL_BACKDROP: Backdrop = GROUP_SLOT_BACKDROP.verdict;

export function FinalSlide({
  analysis,
  onRestart,
}: {
  analysis: Analysis;
  onRestart: () => void;
}) {
  const { stats } = analysis;
  const copy = useCopy();
  const [sharing, setSharing] = useState(false);

  return (
    <Slide backdrop={FINAL_BACKDROP} photo="verdict">
      <Eyebrow>{copy.t('final.eyebrow')}</Eyebrow>
      <Headline>{copy.t('final.headline')}</Headline>
      <Punchline>
        {copy.t('final.punchline', {
          messages: num(copy, stats.totalMessages),
          span: spanLabel(copy, stats),
        })}
      </Punchline>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <DeckButton onClick={() => setSharing(true)}>{copy.t('share.open')}</DeckButton>
        <DeckButton onClick={onRestart} variant="ghost">
          {copy.t('final.restart')}
        </DeckButton>
      </div>

      <p
        className="mt-7 text-[11px] leading-relaxed opacity-60"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        {copy.t('final.privacy')}
      </p>

      {/* The pack takes the whole slide rather than floating over it: picking
          cards is the task at that point, not a dialog interrupting one. */}
      {sharing && <SharePack stats={stats} onClose={() => setSharing(false)} />}
    </Slide>
  );
}
