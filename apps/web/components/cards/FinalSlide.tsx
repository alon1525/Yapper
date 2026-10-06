'use client';

import { useState } from 'react';
import type { ChatStats } from '@wrapped/core';
import { useCopy } from '@/lib/copy';
import { num, spanLabel } from '@/lib/localFormat';
import { GROUP_SLOT_BACKDROP } from './photos';
import { SharePack } from './SharePack';
import { DeckButton, Eyebrow, Headline, Punchline, Slide, type Backdrop } from './Shell';

/**
 * Closes on the same lime the deck opened on. Read from the photo table so the
 * onboarding's preview tile of this slide cannot be drawn on a different one.
 */
export const FINAL_BACKDROP: Backdrop = GROUP_SLOT_BACKDROP.verdict;

/**
 * Keeping the report on this device, from the deck's point of view.
 *
 * `stale` means a copy was saved before the paid report was written — the
 * reader kept the statistics, then unlocked — and the saved copy can be
 * brought up to date in place. `unavailable` is a browser with no storage to
 * offer, where the control is simply absent rather than present and broken.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'stale' | 'error' | 'unavailable';

export function FinalSlide({
  stats,
  onRestart,
  save,
}: {
  stats: ChatStats;
  onRestart: () => void;
  save: { status: SaveStatus; onSave: () => void };
}) {
  const copy = useCopy();
  const [sharing, setSharing] = useState(false);
  const saving = save.status === 'saving';

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

      {/*
        Opt-in, on the last slide, in words that say where it goes. This is
        the one thing in the product that outlives the tab, so it is never
        done on the reader's behalf — and the line underneath changes to say
        so once it has been.
      */}
      {save.status !== 'unavailable' && (
        <div className="mt-5">
          {save.status === 'saved' ? (
            <p dir="auto" className="text-[13px] leading-relaxed opacity-80">
              {copy.t('final.saved')}
            </p>
          ) : (
            <DeckButton onClick={save.onSave} variant="ghost" disabled={saving}>
              {saving
                ? copy.t('final.saving')
                : save.status === 'stale'
                  ? copy.t('final.saveAgain')
                  : copy.t('final.save')}
            </DeckButton>
          )}
          {save.status === 'error' && (
            <p
              role="alert"
              dir="auto"
              className="mt-3 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'var(--slide-panel)' }}
            >
              {copy.t('final.saveFailed')}
            </p>
          )}
        </div>
      )}

      <p
        dir="auto"
        className="mt-7 text-[11px] leading-relaxed opacity-60"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        {copy.t(save.status === 'saved' || save.status === 'stale' ? 'final.privacySaved' : 'final.privacy')}
      </p>

      {/* The pack takes the whole slide rather than floating over it: picking
          cards is the task at that point, not a dialog interrupting one. */}
      {sharing && <SharePack stats={stats} onClose={() => setSharing(false)} />}
    </Slide>
  );
}
