'use client';

import { motion, type Transition } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import type { GroupSlot } from '@/lib/brief';
import { useCopy } from '@/lib/copy';
import { posterFace, type SlideAlign } from './Shell';
import { useGroupPhoto } from './photos';

/**
 * The written deck's ground and its vocabulary.
 *
 * The statistics deck is one flat colour per slide. The written deck is the
 * design's second pass: every slide on the same near-black, a bloom of one
 * colour bleeding in from an edge, film grain over everything, and on a few
 * slides the reader's own photo drifting underneath. Colour is a per-slide
 * *tone* rather than a backdrop, and the pieces below — stickers, bubbles,
 * stamps, glass cards — take a tone and draw themselves in it, which is what
 * lets fourteen formats share one palette without sharing one shape.
 */

export const NIGHT = {
  lime: '#C9F24D',
  pink: '#FF4FA3',
  sun: '#F5B324',
  teal: '#16E0C8',
  orange: '#FF6B1A',
  violet: '#4B1BD1',
  /** The loud day. Outside the rotation: one slide in a deck gets to be red. */
  red: '#FF2E2E',
  white: '#FFFFFF',
} as const;

export type Tone = keyof typeof NIGHT;

/** The ink that reads on each tone when the tone is a fill. */
export const INK: Record<Tone, string> = {
  lime: '#10130E',
  pink: '#180410',
  sun: '#221600',
  teal: '#04231F',
  orange: '#1A0A00',
  violet: '#F1ECFF',
  red: '#FFF3F3',
  white: '#0B0B0F',
};

/** The tones a bloom rotates through, in the order the design sequences them. */
export const TONES: readonly Tone[] = ['lime', 'pink', 'violet', 'orange', 'sun', 'teal'];

/** A tone as the slide's accent: what `--slide-accent` / `--slide-on-accent` become. */
export const accentOf = (tone: Tone) => ({ color: NIGHT[tone], on: INK[tone] });

export type BloomAt = 'top' | 'bottom' | 'left' | 'right';

/**
 * How a slide sits on the night ground: its colour, where the colour bleeds
 * in from, how the column is aligned, which group photo lies under it. Both
 * decks declare one of these per slide and `Deck` draws the ground from it; a
 * slide with no `tone` (the dossier) draws none.
 */
export interface Dress {
  tone: Tone;
  at: BloomAt;
  align?: SlideAlign;
  photo?: GroupSlot;
  letterbox?: boolean;
}

const BLOOM_POS: Record<BloomAt, CSSProperties> = {
  top: { left: '-20%', top: '-10%', width: '90%', height: '50%' },
  bottom: { left: '-30%', right: '-30%', bottom: '-20%', height: '70%' },
  left: { left: '-20%', bottom: '-10%', width: '90%', height: '50%' },
  right: { right: '-30%', top: '10%', width: '90%', height: '50%' },
};

export const alpha = (colour: string, a: number) =>
  `color-mix(in srgb, ${colour} ${Math.round(a * 100)}%, transparent)`;

/**
 * Everything under the column but the photo: the bloom and the grain. The
 * photo itself is `SlidePhoto`, drawn by `Slide` from the reader's slot, so
 * that the onboarding's preview tile and the deck cannot disagree about how a
 * photo will look. All of it `pointer-events-none` so the tap-to-advance still
 * lands.
 */
export function NightGround({
  tone,
  at = 'bottom',
  photo,
  letterbox = false,
}: {
  tone: Tone;
  at?: BloomAt;
  /**
   * The slot `Slide` is drawing under this ground, if any. A filled slot
   * brings its own grain and softens the bloom, so the colour does not fight
   * the picture.
   */
  photo?: GroupSlot;
  /** Two black bars, top and bottom. The documentary is shot in widescreen. */
  letterbox?: boolean;
}) {
  const url = useGroupPhoto(photo);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {letterbox && (
        <>
          <div className="absolute inset-x-0 top-0 z-10 h-[7%] bg-black/85" />
          <div className="absolute inset-x-0 bottom-0 z-10 h-[7%] bg-black/85" />
        </>
      )}
      <div
        className="absolute"
        style={{
          ...BLOOM_POS[at],
          background: `radial-gradient(closest-side, ${alpha(NIGHT[tone], url ? 0.4 : 0.5)}, transparent 70%)`,
          filter: 'blur(30px)',
        }}
      />
      {!url && <div className="yap-grain absolute inset-0" style={{ opacity: 0.16 }} />}
    </div>
  );
}

/**
 * The pill above a cover: a glowing dot in the tone, then one or two labels in
 * mono. The design's "הFAMבויז ממדגסקר · 8 suspects".
 */
export function Badge({
  tone,
  children,
  delay = 0.05,
}: {
  tone: Tone;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      {...upSm(delay)}
      className="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 ps-2"
      style={{
        background: 'rgb(255 255 255 / 0.14)',
        borderColor: 'rgb(255 255 255 / 0.18)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: NIGHT[tone], boxShadow: `0 0 12px ${NIGHT[tone]}` }}
      />
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

const EASE: Transition['ease'] = [0.22, 1, 0.36, 1];

/** Rises into place. The default entrance for a block of copy. */
export const up = (delay = 0) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: EASE },
});

export const upSm = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: EASE },
});

/** The cover number: rises further and grows into place. */
export const big = (delay = 0) => ({
  initial: { opacity: 0, y: 40, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { delay, duration: 0.6, ease: EASE },
});

/** A sticker slapped on: overshoots, settles, keeps its tilt. */
export const punch = (delay = 0, rotate = 0) => ({
  initial: { opacity: 0, scale: 0.6, rotate },
  animate: { opacity: 1, scale: [0.6, 1.06, 1], rotate },
  transition: { delay, duration: 0.5, ease: EASE },
});

/** Slides in from the edge the reader starts reading at. */
export const slideIn = (delay = 0, rtl = false, from: 'start' | 'end' = 'start') => {
  const sign = (from === 'start') !== rtl ? -1 : 1;
  return {
    initial: { opacity: 0, x: sign * 30 },
    animate: { opacity: 1, x: 0 },
    transition: { delay, duration: 0.45, ease: EASE },
  };
};

export const fade = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.5 },
});

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

const POSTER_SIZE = {
  xl: 'text-[clamp(84px,24vw,126px)] leading-[0.86]',
  lg: 'text-[clamp(40px,12vw,58px)] leading-[0.9]',
  md: 'text-[clamp(30px,9.5vw,44px)] leading-[0.92]',
  sm: 'text-[clamp(22px,7vw,30px)] leading-[0.95]',
} as const;

/** One line of display type, in the poster face for its script. */
export function Poster({
  children,
  text,
  size = 'lg',
  tone,
  className = '',
}: {
  children: ReactNode;
  /**
   * The string the children are drawn from, for picking the face: a title
   * split into a head and a coloured tail is two nodes, and the script test
   * only reads a string.
   */
  text?: string;
  size?: keyof typeof POSTER_SIZE;
  /** Colours the whole line. */
  tone?: Tone;
  className?: string;
}) {
  const { rtl } = useCopy();
  const face = posterFace(text ?? children, rtl);
  const hebrew = face.fontFamily === 'var(--yap-heb)';
  return (
    <div
      dir="auto"
      className={`${POSTER_SIZE[size]} ${hebrew ? '' : 'uppercase'} ${className}`}
      style={{ ...face, color: tone ? NIGHT[tone] : undefined, textWrap: 'balance' }}
    >
      {children}
    </div>
  );
}

/**
 * A word set on a block of colour, tilted. The design's "evidence." — the one
 * word on the cover that is a sticker rather than type.
 */
export function Stamp({
  children,
  tone = 'white',
  rotate = -2,
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
}) {
  return (
    <span
      dir="auto"
      className="mt-1.5 inline-block px-3 pt-[2px]"
      style={{
        background: NIGHT[tone],
        color: INK[tone],
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {children}
    </span>
  );
}

/** Reg narrating. The serif, italic, at reading size. */
export function Narration({
  children,
  size = 'md',
  italic = true,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  italic?: boolean;
  delay?: number;
  className?: string;
}) {
  const scale = {
    lg: 'text-[clamp(1.5rem,5.5vw,2.1rem)] leading-[1.1]',
    md: 'text-[clamp(1.2rem,4.2vw,1.55rem)] leading-[1.18]',
    sm: 'text-[15.5px] leading-[1.3]',
  }[size];
  return (
    <motion.p
      dir="auto"
      {...upSm(delay)}
      className={`${scale} ${italic ? 'italic' : ''} ${className}`}
      style={{ fontFamily: 'var(--yap-serif)', textWrap: 'pretty' }}
    >
      {children}
    </motion.p>
  );
}

/** Body copy on the night ground. */
export function Prose({
  children,
  delay = 0.3,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.p
      dir="auto"
      {...upSm(delay)}
      className={`text-[15px] leading-[1.55] opacity-85 ${className}`}
      style={{ textWrap: 'pretty' }}
    >
      {children}
    </motion.p>
  );
}

/* ------------------------------------------------------------------ *
 * Stickers, bubbles, cards
 * ------------------------------------------------------------------ */

export type Side = 'start' | 'end' | 'center';

const SELF: Record<Side, string> = {
  start: 'self-start',
  end: 'self-end',
  center: 'self-center',
};

/**
 * A label and a big value in a pill, tilted and slapped on. The design draws
 * the group diagnosis this way — "Friendship 94/100" — and it is the natural
 * shape for a verdict, which is a joke in the shape of a rating.
 */
export function Sticker({
  label,
  value,
  tone,
  side = 'start',
  rotate = 0,
  delay = 0,
}: {
  label: string;
  value: string;
  tone: Tone;
  side?: Side;
  rotate?: number;
  delay?: number;
}) {
  return (
    <motion.div
      {...punch(delay, rotate)}
      className={`${SELF[side]} inline-flex max-w-full items-center gap-3.5 rounded-full py-[7px] ps-4 pe-3.5`}
      style={{
        background: NIGHT[tone],
        color: INK[tone],
        boxShadow: '0 14px 34px rgb(0 0 0 / 0.4)',
      }}
    >
      <span dir="auto" className="min-w-0 text-[14.5px] leading-tight font-bold">
        {label}
      </span>
      <span
        dir="ltr"
        className="shrink-0 text-[24px] leading-none"
        style={{ fontFamily: 'var(--yap-poster)' }}
      >
        {value}
      </span>
    </motion.div>
  );
}

/**
 * A chat bubble, because this is a report about a chat. `glass` is the
 * received-message grey; a tone is the sent-message colour. The tail corner
 * follows the side the bubble sits on, in whichever direction the deck runs.
 */
export function Bubble({
  children,
  side = 'start',
  tone = 'glass',
  rotate = 0,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  side?: Side;
  tone?: Tone | 'glass';
  rotate?: number;
  delay?: number;
  className?: string;
}) {
  const { rtl } = useCopy();
  // border-radius corners are physical. The tail is the bottom corner nearest
  // the edge the bubble hugs, which is the left in LTR for a "start" bubble and
  // the right in RTL for the same bubble.
  const tailLeft = (side === 'start') !== rtl;

  // A centred bubble is a day divider — the small pill a chat puts between
  // "yesterday" and "today" — rather than a message.
  if (side === 'center') {
    return (
      <motion.div
        dir="auto"
        {...fade(delay)}
        className={`self-center rounded-full px-2.5 py-[3px] text-[10px] uppercase ${rtl ? 'tracking-[0.04em]' : 'tracking-[0.12em]'} ${className}`}
        style={{
          fontFamily: 'var(--yap-mono)',
          background: 'rgb(255 255 255 / 0.10)',
          color: 'rgb(255 255 255 / 0.7)',
        }}
      >
        {children}
      </motion.div>
    );
  }

  const fill = tone === 'glass' ? 'rgb(255 255 255 / 0.14)' : NIGHT[tone];
  const ink = tone === 'glass' ? '#fff' : INK[tone];

  return (
    <motion.div
      dir="auto"
      {...slideIn(delay, rtl, side)}
      className={`${SELF[side]} max-w-[84%] px-3 py-[6px] text-[13px] leading-[1.35] ${className}`}
      style={{
        background: fill,
        color: ink,
        borderRadius: tailLeft ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.3)',
        rotate: rotate ? `${rotate}deg` : undefined,
        textWrap: 'pretty',
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The punchline on a coloured note, tilted. The design's "Three people are 68%
 * of this group. The other five are witnesses." under the leaderboard.
 */
export function Note({
  children,
  tone = 'orange',
  rotate = -1.5,
  delay = 0,
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  delay?: number;
}) {
  return (
    <motion.div
      dir="auto"
      {...punch(delay, rotate)}
      className="inline-block px-3.5 py-2.5 text-[14px] leading-[1.35] font-bold"
      style={{
        background: NIGHT[tone],
        color: INK[tone],
        borderRadius: '14px 14px 14px 4px',
        textWrap: 'pretty',
      }}
    >
      {children}
    </motion.div>
  );
}

/** A frosted card with one big value and a small label. The design's score grid. */
export function GlassCard({
  value,
  label,
  tone = 'white',
  rotate = 0,
  delay = 0,
}: {
  value: string;
  label: string;
  tone?: Tone;
  rotate?: number;
  delay?: number;
}) {
  return (
    <motion.div
      {...punch(delay, rotate)}
      className="rounded-[18px] border px-3 pt-3.5 pb-3"
      style={{
        background: 'rgb(255 255 255 / 0.09)',
        borderColor: 'rgb(255 255 255 / 0.14)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        dir="ltr"
        className="text-[clamp(28px,8.5vw,40px)] leading-[0.9] tracking-[-0.01em]"
        style={{ fontFamily: 'var(--yap-poster)', color: NIGHT[tone] }}
      >
        {value}
      </div>
      <div
        dir="auto"
        className="mt-2 text-[9px] tracking-[0.1em] uppercase opacity-65"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        {label}
      </div>
    </motion.div>
  );
}

/** A frosted panel for anything else. */
export function Glass({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: 'rgb(255 255 255 / 0.09)',
        borderColor: 'rgb(255 255 255 / 0.14)',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small caps in mono. Used for everything that is a label rather than a line. */
export function Mono({
  children,
  tone,
  className = '',
  dir = 'auto',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}) {
  const { rtl } = useCopy();
  return (
    <span
      dir={dir}
      className={`text-[10px] uppercase ${rtl ? 'tracking-[0.04em]' : 'tracking-[0.16em]'} ${className}`}
      style={{ fontFamily: 'var(--yap-mono)', color: tone ? NIGHT[tone] : undefined }}
    >
      {children}
    </span>
  );
}
