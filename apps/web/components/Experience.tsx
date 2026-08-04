'use client';

import { useCallback, useMemo, useState } from 'react';
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
 * Uploading, parsing and naming all happen inside the landing page's modal
 * rather than on screens of their own — the reader stays on one page until
 * they choose to start the story, which is also the only point at which the
 * deck takes over the viewport.
 */
export function Experience() {
  const { state, analyze, finalize, reset } = useAnalyzer();
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

  const restart = useCallback(() => {
    setPlaying(false);
    reset();
  }, [reset]);

  if (playing && state.phase === 'done') {
    // The button that got us here says "with sound", and that click is the user
    // gesture every browser wants before it will let an AudioContext run — so
    // the deck opens unmuted rather than making the reader ask twice.
    return <Deck analysis={state.analysis} onRestart={restart} startWithSound />;
  }

  return (
    <Landing
      state={state}
      onAnalyze={onAnalyze}
      onNames={finalize}
      onPlay={() => setPlaying(true)}
      onCancel={restart}
      stats={stats}
      slideCount={freeSlides + 3}
      freeCount={freeSlides + 1}
    />
  );
}
