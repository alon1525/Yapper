'use client';

import { useCallback, useMemo, useState } from 'react';
import { emptyBrief, releasePhotos, type Brief } from '@/lib/brief';
import { useAnalyzer } from '@/lib/useAnalyzer';
import { slidesFor } from './cards/slides';
import { Deck } from './Deck';
import { Landing } from './Landing';

/**
 * The whole flow lives in one client component and holds the parsed chat in
 * memory. That is deliberate: routing between pages would mean serialising the
 * conversation into storage somewhere, and "your chat never leaves your device"
 * is easier to keep true when there is nowhere for it to be left behind.
 *
 * The brief lives here for the same reason and one more: it is written in the
 * onboarding and read by the deck, and those two never exist at the same time.
 * A photo picked on the last question has to survive the screen it was picked
 * on being unmounted.
 */
export function Experience() {
  const { state, analyze, finalize, reset } = useAnalyzer();
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [playing, setPlaying] = useState(false);

  const stats = state.phase === 'done' ? state.analysis.stats : null;

  /* What the "ready" panel counts. A slide that cannot be filled honestly is
     dropped, so the number is different for every chat — plus the AI memory,
     the wall and the share card the deck always appends. */
  const freeSlides = useMemo(() => (stats ? slidesFor(stats).length : 0), [stats]);

  const onAnalyze = useCallback(
    (text: string, fileName: string) => analyze(text, fileName),
    [analyze],
  );

  const patchBrief = useCallback((patch: Partial<Brief>) => {
    setBrief((prev) => ({ ...prev, ...patch }));
  }, []);

  const restart = useCallback(() => {
    setPlaying(false);
    // Object URLs outlive the component that made them. Starting over without
    // handing them back leaks every photo for the lifetime of the document.
    setBrief((prev) => {
      releasePhotos(prev);
      return emptyBrief();
    });
    reset();
  }, [reset]);

  if (playing && state.phase === 'done') {
    // The button that got us here says "with sound", and that click is the user
    // gesture every browser wants before it will let an AudioContext run — so
    // the deck opens unmuted rather than making the reader ask twice.
    return (
      <Deck analysis={state.analysis} brief={brief} onRestart={restart} startWithSound />
    );
  }

  return (
    <Landing
      state={state}
      brief={brief}
      onBrief={patchBrief}
      onAnalyze={onAnalyze}
      onNames={finalize}
      onPlay={() => setPlaying(true)}
      onCancel={restart}
      stats={stats}
      freeCount={freeSlides + 1}
    />
  );
}
