'use client';

import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Brief } from '@/lib/brief';
import type { Analysis } from '@/lib/useAnalyzer';
import { useAiPreview } from '@/lib/useAiPreview';
import { usePremium } from '@/lib/usePremium';
import { useStorySound } from '@/lib/useStorySound';
import { PhotoProvider } from './cards/photos';
import { slidesFor } from './cards/slides';
import { BACKDROPS, Slide, type Backdrop } from './cards/Shell';
import { AiSlide, AI_BACKDROP } from './cards/AiSlide';
import { PaywallSlide, PAYWALL_BACKDROP } from './cards/PaywallSlide';
import { premiumSlidesFor } from './cards/PremiumSlides';
import { FinalSlide, FINAL_BACKDROP } from './cards/FinalSlide';

export function Deck({
  analysis,
  brief,
  onRestart,
  startWithSound = false,
}: {
  analysis: Analysis;
  /** What the reader told Reg on the way in: language, kind, notes, photos. */
  brief: Brief;
  onRestart: () => void;
  /** The reader arrived via a button that promised sound, which is the gesture. */
  startWithSound?: boolean;
}) {
  const { stats } = analysis;
  const free = useMemo(() => slidesFor(stats), [stats]);
  const preview = useAiPreview(analysis, brief);
  const premium = usePremium(analysis, brief);
  const sound = useStorySound(startWithSound);

  /**
   * The deck grows when the report arrives. Free slides, then the one AI
   * memory, then the wall — and once it is unlocked the paid slides splice in
   * between the wall and the share card, so the reader keeps swiping in the
   * same direction rather than being sent somewhere new.
   */
  const paid = useMemo(
    () =>
      premium.state.phase === 'ready'
        ? premiumSlidesFor(premium.state.report, premium.state.demo)
        : [],
    [premium.state],
  );

  const slides = free;
  const total = slides.length + 3 + paid.length; // + AI preview + paywall + paid + final
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const current = slides[index];
  const aiIndex = slides.length;
  const paywallIndex = aiIndex + 1;
  const paidSlide = paid[index - paywallIndex - 1];
  const isFinal = index === total - 1;

  /**
   * The chrome sits outside the slide, so it cannot inherit the slide's colour
   * the way everything else does — it has to be told which ground it is on, or
   * white ticks vanish the moment the deck lands on lime.
   */
  const backdrop: Backdrop = current
    ? current.backdrop
    : index === aiIndex
      ? AI_BACKDROP
      : index === paywallIndex
        ? PAYWALL_BACKDROP
        : (paidSlide?.backdrop ?? FINAL_BACKDROP);

  // One note per slide, a chord on the last. Silent until the reader asks for
  // sound; `sting` checks that itself rather than trusting the caller.
  useEffect(() => {
    sound.sting(index, isFinal);
  }, [index, isFinal, sound]);

  const chromeButton =
    'grid h-8 w-8 place-items-center rounded-full text-[13px] transition hover:opacity-100';

  return (
    <PhotoProvider brief={brief}>
    <main
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: BACKDROPS[backdrop].bg, color: BACKDROPS[backdrop].fg }}
      // Direction is resolved per text node via dir="auto", not forced here.
      // Forcing rtl on the container reorders the English UI copy around any
      // embedded number — "54,162 messages" renders with the number displaced
      // and the full stop on the wrong end. Letting each string pick its own
      // direction from its first strong character keeps English copy LTR and
      // Hebrew names RTL, including when they appear in the same sentence.
      dir="ltr"
    >
      {/*
        Deliberately NOT mode="wait". That mode holds the outgoing slide until
        its exit animation finishes, which makes *which slide you are on* depend
        on an animation completing. Background a tab mid-deck and the browser
        throttles rAF: the exit never finishes, the next slide never mounts, and
        the deck sticks while the progress bar keeps advancing. Slides are
        absolutely positioned, so a plain cross-fade looks the same and cannot
        get stuck.
      */}
      <AnimatePresence initial={false}>
        {current ? (
          <Slide key={current.id} backdrop={current.backdrop} photo={current.photo}>
            {current.render(stats)}
          </Slide>
        ) : index === aiIndex ? (
          <AiSlide key="ai" analysis={analysis} state={preview.state} onRun={() => void preview.run()} />
        ) : index === paywallIndex ? (
          <PaywallSlide
            key="paywall"
            state={premium.state}
            onUnlock={() => void premium.unlock()}
            peopleCount={stats.people.length}
            previewSeen={preview.state.phase === 'done'}
          />
        ) : paidSlide ? (
          <Slide key={paidSlide.id} backdrop={paidSlide.backdrop}>
            {paidSlide.render()}
          </Slide>
        ) : (
          <FinalSlide key="final" analysis={analysis} onRestart={onRestart} />
        )}
      </AnimatePresence>

      {/* Story progress. Forced LTR so the bar always fills in reading order of
          the deck itself rather than flipping with the chat's language. */}
      <div dir="ltr" className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1 p-3">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 overflow-hidden rounded-full"
            style={{ background: 'color-mix(in srgb, currentColor 28%, transparent)' }}
          >
            <div
              className="h-full rounded-full transition-transform duration-300 ease-out"
              style={{
                background: 'currentColor',
                transform: `scaleX(${i <= index ? 1 : 0})`,
                transformOrigin: 'left',
              }}
            />
          </div>
        ))}
      </div>

      {/* Reg's byline and the two controls, exactly where the sample story on
          the landing page puts them. */}
      <div className="absolute inset-x-0 top-6 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reg.png"
            alt=""
            className="block h-6 w-6 rounded-full"
            style={{ boxShadow: '0 0 0 1.5px color-mix(in srgb, currentColor 55%, transparent)' }}
          />
          <span
            className="text-[10px] tracking-[0.14em] uppercase opacity-80"
            style={{ fontFamily: 'var(--yap-mono)' }}
          >
            Yapped · {stats.span.last.slice(0, 4)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={sound.toggle}
            aria-label={sound.enabled ? 'Mute the soundtrack' : 'Play the soundtrack'}
            className={chromeButton}
            style={{
              background: 'color-mix(in srgb, currentColor 16%, transparent)',
              color: 'currentColor',
            }}
          >
            {sound.enabled ? '♪' : '✕'}
          </button>
          <button
            type="button"
            onClick={() => setIndex(0)}
            aria-label="Back to the first slide"
            className={chromeButton}
            style={{
              background: 'color-mix(in srgb, currentColor 16%, transparent)',
              color: 'currentColor',
            }}
          >
            ↺
          </button>
        </div>
      </div>

      {/*
        Tap targets. Buttons rather than a div so the deck is keyboard- and
        screen-reader navigable, not just tappable. The narrow-left/wide-right
        split is the one every story player on a phone uses — going forward is
        the common case and deserves the bigger target. They stop short of the
        chrome so the sound and restart buttons stay clickable.
      */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(-1)}
        disabled={index === 0}
        className="absolute top-20 bottom-16 left-0 z-10 w-1/3 cursor-default disabled:cursor-not-allowed"
      />
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(1)}
        disabled={index === total - 1}
        className="absolute top-20 right-0 bottom-16 z-10 w-2/3 cursor-default disabled:cursor-not-allowed"
      />

      <div
        dir="ltr"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 pb-4"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        <span className="text-[10px] tracking-[0.12em] opacity-70">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <span className="text-[10px] tracking-[0.12em] opacity-70">
          {isFinal ? 'the end' : 'tap →'}
        </span>
      </div>
    </main>
    </PhotoProvider>
  );
}
