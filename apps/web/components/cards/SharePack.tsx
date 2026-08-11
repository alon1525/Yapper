'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatStats } from '@wrapped/core';
import { useCopy } from '@/lib/copy';
import { num } from '@/lib/localFormat';
import {
  cardsFor,
  cardToFile,
  drawCard,
  ensureFonts,
  type CardSpec,
} from '@/lib/shareCards';
import { DeckButton } from './Shell';

/**
 * Getting the report out of the tab and into a group chat.
 *
 * What is actually possible from a web page decides the shape of this: there is
 * no way to post to Instagram or TikTok directly — both need an app the user
 * installs and a login we would have to hold — but every phone has a share
 * sheet, and the share sheet carries files to whichever app is installed.
 * WhatsApp, Instagram, TikTok and Messages are all in there. So the job here is
 * to make pictures worth sharing and hand them over in one tap.
 *
 * The cards are drawn on the device (see `lib/shareCards.ts`), which is the
 * only version of this feature that does not quietly break the promise the
 * landing page makes.
 *
 * Desktop browsers do not implement file sharing, so there the same button
 * downloads instead. That is checked with `canShare({files})` rather than by
 * sniffing the browser, because the answer differs by OS, browser and even by
 * how many files are being shared.
 */
export function SharePack({
  stats,
  onClose,
}: {
  stats: ChatStats;
  onClose: () => void;
}) {
  const copy = useCopy();
  const cards = useMemo(() => cardsFor(stats, copy), [stats, copy]);

  const [picked, setPicked] = useState<string[]>(() => cards.slice(0, 3).map((c) => c.id));
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const canvases = useRef(new Map<string, HTMLCanvasElement>());

  const caption = copy.t('share.caption', { messages: num(copy, stats.totalMessages) });

  /* Thumbnails are the same drawing at a tenth of the size, so what the reader
     ticks is what they get — not an approximation of it. */
  useEffect(() => {
    let cancelled = false;
    void ensureFonts().then(() => {
      if (cancelled) return;
      for (const card of cards) {
        const canvas = canvases.current.get(card.id);
        if (canvas) drawCard(canvas, card, copy, { scale: 0.25 });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [cards, copy]);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const chosen = cards.filter((c) => picked.includes(c.id));

  const build = useCallback(async () => {
    await ensureFonts();
    return Promise.all(chosen.map((card) => cardToFile(card, copy)));
  }, [chosen, copy]);

  const share = async () => {
    setBusy('share');
    setNote(null);
    try {
      const files = await build();
      // Asked with the actual files: some platforms allow one file and refuse
      // several, and a button that opens a sheet for one card and throws for
      // three is worse than one that never opens it.
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, text: caption });
      } else {
        download(files);
        setNote(copy.t('share.hintDesktop'));
      }
    } catch (error) {
      // An abort is the reader closing the sheet, which is not a failure and
      // must not be reported as one.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setNote(copy.t('share.failed'));
      }
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setNote(null);
    try {
      download(await build());
    } catch {
      setNote(copy.t('share.failed'));
    } finally {
      setBusy(null);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setNote(copy.t('share.captionCopied'));
    } catch {
      setNote(caption);
    }
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    /* Fixed to the viewport, not to the slide: the slide is a centred column
       with its own padding, and a picker rendered inside it is a picker in a
       box. Its own dark ground rather than the slide's, because the cards are
       the colourful thing here and eight of them on lime is a fruit bowl. */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#0B0F0C', color: '#F1F3EC' }}
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <div
          className="text-[11px] tracking-[0.16em] uppercase opacity-70"
          style={{ fontFamily: 'var(--yap-mono)' }}
        >
          {copy.t('share.title')}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.t('share.close')}
          className="grid h-8 w-8 place-items-center rounded-full text-[13px]"
          style={{ background: 'color-mix(in srgb, currentColor 16%, transparent)' }}
        >
          ✕
        </button>
      </div>

      <p className="px-5 pt-3 text-[13px] leading-relaxed opacity-75">{copy.t('share.lede')}</p>

      {/* The picker. Horizontal, because a story card is tall and a column of
          them on a phone shows one and a half. */}
      <div className="yap-quiet-scroll flex flex-1 items-center gap-3 overflow-x-auto px-5 py-4">
        {cards.map((card) => {
          const on = picked.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggle(card.id)}
              aria-pressed={on}
              className="relative shrink-0 overflow-hidden rounded-2xl transition"
              style={{
                width: 150,
                height: 267,
                outline: on ? '3px solid currentColor' : '1px solid transparent',
                outlineOffset: 2,
                opacity: on ? 1 : 0.55,
              }}
            >
              <canvas
                ref={(el) => {
                  if (el) canvases.current.set(card.id, el);
                  else canvases.current.delete(card.id);
                }}
                className="block h-full w-full"
              />
              <span
                className="absolute right-2 bottom-2 grid h-6 w-6 place-items-center rounded-full text-[12px]"
                style={{
                  background: on ? 'currentColor' : 'rgba(0,0,0,.45)',
                  color: on ? 'var(--slide-bg)' : 'inherit',
                }}
              >
                {on ? '✓' : '+'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 px-5 pb-6">
        <div
          className="text-[11px] tracking-[0.14em] uppercase opacity-70"
          style={{ fontFamily: 'var(--yap-mono)' }}
        >
          {chosen.length > 0 ? copy.t('share.count', { n: chosen.length }) : copy.t('share.none')}
        </div>

        <DeckButton
          onClick={() => void share()}
          disabled={chosen.length === 0 || busy !== null || !ready}
        >
          {busy === 'share' ? copy.t('share.sharing') : copy.t('share.share')}
        </DeckButton>

        <div className="flex gap-3">
          <DeckButton
            onClick={() => void save()}
            variant="ghost"
            disabled={chosen.length === 0 || busy !== null || !ready}
          >
            {busy === 'save'
              ? copy.t('share.saving')
              : canNativeShare
                ? copy.t('share.save')
                : copy.t('share.saveDesktop')}
          </DeckButton>
          <DeckButton onClick={() => void copyCaption()} variant="ghost">
            {copy.t('share.copyCaption')}
          </DeckButton>
        </div>

        <p className="text-[11px] leading-relaxed opacity-60" style={{ fontFamily: 'var(--yap-mono)' }}>
          {note ?? (canNativeShare ? copy.t('share.hint') : copy.t('share.hintDesktop'))}
        </p>
      </div>
    </div>
  );
}

/** Saves every chosen card. One click per file is what a browser allows. */
function download(files: File[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    // Revoked on the next turn rather than immediately: Safari has not finished
    // reading the blob when the click returns, and a revoked URL saves nothing.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export type { CardSpec };
