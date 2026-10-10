'use client';

import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatStats } from '@wrapped/core';
import { buildPreviewPayload } from '@/lib/aiPayload';
import type { Brief } from '@/lib/brief';
import { CopyContext, localise } from '@/lib/copy';
import {
  buildSavedReport,
  saveReport,
  storageAvailable,
  type SavedReport,
} from '@/lib/savedReports';
import type { Analysis } from '@/lib/useAnalyzer';
import { useAiPreview } from '@/lib/useAiPreview';
import { useReport } from '@/lib/useReport';
import { useStorySound } from '@/lib/useStorySound';
import { PhotoProvider } from './cards/photos';
import { slidesFor } from './cards/slides';
import { NightGround, accentOf, type Dress } from './cards/ReportGround';
import { BACKDROPS, Slide, type Backdrop } from './cards/Shell';
import { WallSlide, WALL_BACKDROP } from './cards/WallSlide';
import { reportSlidesFor } from './cards/ReportSlides';
import { FinalSlide, FINAL_BACKDROP, type SaveStatus } from './cards/FinalSlide';

export function Deck({
  stats,
  analysis,
  brief,
  saved = null,
  onRestart,
  startWithSound = false,
  startAt = 0,
}: {
  stats: ChatStats;
  /**
   * The parsed chat, while it is in memory. Null for a report opened from this
   * device's storage: those slides are already written, and the only things
   * that need the chat itself — the two model calls and the inspect panel —
   * are not offered.
   */
  analysis: Analysis | null;
  /** What the reader told Reg on the way in: language, kind, notes, photos. */
  brief: Brief;
  /** The stored report this deck was opened from, if it was. */
  saved?: SavedReport | null;
  onRestart: () => void;
  /** The reader arrived via a button that promised sound, which is the gesture. */
  startWithSound?: boolean;
  /** Which slide to open on. The dev preview uses it to land on the paid deck. */
  startAt?: number;
}) {
  /* The report's language, chosen on the first question of the onboarding.
     Every slide reads it from context rather than being handed it, because a
     slide that forgets to accept the prop renders in English and nothing in
     the types says so. */
  const copy = useMemo(() => localise(brief.language), [brief.language]);
  /* Which way the deck runs. A right-to-left report is right-to-left all the
     way down: the layout mirrors, the story advances leftwards, and the back
     third of the screen is the right third. */
  const rtl = copy.rtl;
  const free = useMemo(() => slidesFor(stats), [stats]);
  // A saved report opens with whatever had been written when it was kept.
  const preview = useAiPreview(
    analysis,
    brief,
    saved?.preview ? { phase: 'done', preview: saved.preview } : undefined,
  );
  const report = useReport(
    analysis,
    brief,
    saved?.deck ? { phase: 'ready', deck: saved.deck } : undefined,
  );
  const sound = useStorySound(startWithSound);

  /*
    Keeping the report on this device. Opt-in from the last slide, and the one
    thing in the product that outlives the tab.

    What was saved is remembered by id so a second save updates the same record
    rather than adding a twin — the common case being a reader who kept the
    statistics, then unlocked the report, and now wants the saved copy to have
    it too. `stale` is that state.
  */
  const [savedAs, setSavedAs] = useState<{ id: string; withDeck: boolean } | null>(
    saved ? { id: saved.id, withDeck: saved.deck !== null } : null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() =>
    !storageAvailable() ? 'unavailable' : saved ? 'saved' : 'idle',
  );
  const deckReady = report.state.phase === 'ready';
  const effectiveSaveStatus: SaveStatus =
    saveStatus === 'saved' && savedAs && !savedAs.withDeck && deckReady ? 'stale' : saveStatus;

  const save = useCallback(async () => {
    if (saveStatus === 'saving' || saveStatus === 'unavailable') return;
    setSaveStatus('saving');
    try {
      const record = buildSavedReport({
        stats,
        brief,
        fileName: analysis?.fileName ?? saved?.fileName ?? '',
        deck: report.state.phase === 'ready' ? report.state.deck : null,
        preview: preview.state.phase === 'done' ? preview.state.preview : null,
        id: savedAs?.id,
      });
      await saveReport(record);
      setSavedAs({ id: record.id, withDeck: record.deck !== null });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [analysis, brief, preview.state, report.state, saved, savedAs, saveStatus, stats]);

  // The anonymised lines the free story would be written from, for the wall's
  // inspect panel. Only exists while the chat does.
  const sample = useMemo(
    () =>
      analysis
        ? () => (buildPreviewPayload(analysis).payload.moments[0]?.messages ?? []).slice(0, 6)
        : null,
    [analysis],
  );

  /**
   * The deck grows when the report arrives. Free slides, then the wall — one
   * slide that offers the report and, as the smaller option, the free story —
   * and once it is unlocked the paid slides splice in between the wall and the
   * share card, so the reader keeps swiping in the same direction rather than
   * being sent somewhere new.
   */
  const paid = useMemo(
    () =>
      report.state.phase === 'ready'
        ? reportSlidesFor(report.state.deck.slides, report.state.deck.dictionary, {
            groupName: stats.groupName,
            participantCount: stats.people.length,
          })
        : [],
    [report.state, stats.groupName, stats.people.length],
  );

  const slides = free;
  const total = slides.length + 2 + paid.length; // + the wall + paid + final
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startAt), total - 1));

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))),
    [total],
  );

  useEffect(() => {
    // The arrows follow the direction the deck runs in: in a right-to-left
    // report the story advances leftwards, so ← is forward.
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === forward || e.key === ' ') go(1);
      if (e.key === backward) go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, rtl]);

  const current = slides[index];
  const wallIndex = slides.length;
  const paidSlide = paid[index - wallIndex - 1];
  const isFinal = index === total - 1;

  /**
   * The chrome sits outside the slide, so it cannot inherit the slide's colour
   * the way everything else does — it has to be told which ground it is on, or
   * white ticks vanish the moment the deck lands on lime.
   */
  const backdrop: Backdrop = current
    ? current.backdrop
    : index === wallIndex
      ? WALL_BACKDROP
      : (paidSlide?.backdrop ?? FINAL_BACKDROP);

  // One note per slide, a chord on the last. Silent until the reader asks for
  // sound; `sting` checks that itself rather than trusting the caller. Keyed on
  // the function, not the whole sound object, so that unmuting does not replay
  // the current slide's note.
  const { sting } = sound;
  useEffect(() => {
    sting(index, isFinal);
  }, [index, isFinal, sting]);

  // The deck is one screen deep and taps rather than scrolls. Leaving the page
  // scrollable underneath it puts a bar down the right of a story player, and
  // on a phone lets the whole deck rubber-band.
  useEffect(() => {
    document.body.classList.add('yap-locked');
    return () => document.body.classList.remove('yap-locked');
  }, []);

  const chromeButton =
    'grid h-8 w-8 place-items-center rounded-full text-[13px] transition hover:opacity-100';

  /**
   * The night ground under a slide, from how the slide said it should sit.
   * Nothing for a slide with no tone — the dossier keeps its paper.
   */
  const groundFor = (dress: Partial<Dress>) =>
    dress.tone ? (
      <NightGround
        tone={dress.tone}
        at={dress.at ?? 'bottom'}
        photo={dress.photo}
        letterbox={dress.letterbox}
      />
    ) : undefined;
  const accentFor = (dress: Partial<Dress>) => (dress.tone ? accentOf(dress.tone) : undefined);
  /**
   * The cover and the closer sit at the foot of the frame because the design
   * puts a photograph above them. With no photo there is nothing above them
   * but black, and type at the bottom of an empty frame reads as having
   * slipped; so without one they centre like everything else.
   */
  const alignFor = (dress: Partial<Dress>) =>
    dress.align === 'end' && !(dress.photo && brief.groupPhotos[dress.photo])
      ? 'center'
      : dress.align;

  /**
   * Tap left third to go back, the rest to go forward — except on anything the
   * reader could have meant to press.
   *
   * Deciding this at the container, from where the click landed, is what lets a
   * slide contain a real button. The alternative every story player reaches for
   * first — two invisible hit targets stretched over the slide — cannot work
   * here, because the slides have buttons on them and an overlay is either
   * above those buttons or it is not an overlay.
   */
  const onTap = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

      const box = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - box.left;
      // The back third is the one the story came from: the left in a
      // left-to-right deck, the right in a right-to-left one.
      const back = rtl ? x > (box.width * 2) / 3 : x < box.width / 3;
      go(back ? -1 : 1);
    },
    [go, rtl],
  );

  return (
    <CopyContext.Provider value={copy}>
    <PhotoProvider brief={brief}>
    <main
      onClick={onTap}
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: BACKDROPS[backdrop].bg, color: BACKDROPS[backdrop].fg }}
      // The deck runs the way its language does. This used to be forced LTR
      // with every text node resolving its own direction, which kept an English
      // deck readable around a Hebrew name — but left a Hebrew deck as Hebrew
      // sentences pinned to the left edge of a left-to-right frame, with the
      // chrome, the rankings and the progress bar all running the wrong way.
      // Names and quoted messages still carry dir="auto", because the chat's
      // script is not the report's.
      lang={copy.language}
      dir={rtl ? 'rtl' : 'ltr'}
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
          <Slide
            key={current.id}
            backdrop={current.backdrop}
            photo={current.photo}
            align={alignFor(current)}
            ground={groundFor(current)}
            accent={accentFor(current)}
          >
            {current.render(stats, copy)}
          </Slide>
        ) : index === wallIndex ? (
          <WallSlide
            key="wall"
            stats={stats}
            sample={sample}
            preview={preview.state}
            report={report.state}
            paidCount={paid.length}
            onPreview={() => void preview.run()}
            onUnlock={() => void report.run()}
          />
        ) : paidSlide ? (
          <Slide
            key={paidSlide.id}
            backdrop={paidSlide.backdrop}
            photo={paidSlide.photo}
            align={alignFor(paidSlide)}
            ground={groundFor(paidSlide)}
            accent={accentFor(paidSlide)}
          >
            {paidSlide.render()}
          </Slide>
        ) : (
          <FinalSlide
            key="final"
            stats={stats}
            onRestart={onRestart}
            save={{ status: effectiveSaveStatus, onSave: () => void save() }}
          />
        )}
      </AnimatePresence>

      {/* Story progress. Fills in the deck's own reading order: from the left
          in a left-to-right report, from the right in a right-to-left one. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1 p-3">
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
                transformOrigin: rtl ? 'right' : 'left',
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
            aria-label={copy.t(sound.enabled ? 'deck.mute' : 'deck.unmute')}
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
            aria-label={copy.t('deck.restart')}
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
        Advancing by tap is handled on the container above, not by these — they
        are `pointer-events-none` and exist only so the deck is reachable by
        keyboard and announced to a screen reader as two controls rather than as
        a region that mysteriously changes.

        They used to be real full-height hit targets at `z-10`, which is above
        every slide, which meant every button *inside* a slide — write my story,
        unlock, download the card — was covered by "next slide". Clicking one
        advanced the deck instead. The same class of bug the sample story had,
        for the same reason: an animated slide makes its own stacking context,
        so a slide cannot raise its own children above a sibling overlay.
      */}
      <button
        type="button"
        aria-label={copy.t('deck.prev')}
        onClick={() => go(-1)}
        disabled={index === 0}
        className="pointer-events-none absolute top-20 bottom-16 start-0 z-10 w-1/3"
      />
      <button
        type="button"
        aria-label={copy.t('deck.next')}
        onClick={() => go(1)}
        disabled={index === total - 1}
        className="pointer-events-none absolute top-20 end-0 bottom-16 z-10 w-2/3"
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 pt-5 pb-4"
        style={{
          fontFamily: 'var(--yap-mono)',
          // A fade under the counter on the night ground, so it stays legible
          // over a photo. The paper dossier would only be smudged by it.
          background:
            backdrop === 'night' ? 'linear-gradient(0deg, rgb(0 0 0 / 0.45), transparent)' : undefined,
        }}
      >
        <span dir="ltr" className="text-[10px] tracking-[0.12em] opacity-70">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <span className={`text-[10px] opacity-70 ${rtl ? 'tracking-[0.04em]' : 'tracking-[0.12em]'}`}>
          {copy.t(isFinal ? 'deck.end' : 'deck.tap')}
        </span>
      </div>
    </main>
    </PhotoProvider>
    </CopyContext.Provider>
  );
}
