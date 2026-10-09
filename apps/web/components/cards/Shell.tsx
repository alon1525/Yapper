'use client';

import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { type CSSProperties, type ReactNode, useEffect, useMemo } from 'react';
import type { GroupSlot } from '@/lib/brief';
import { useCopy } from '@/lib/copy';
import { percent } from '@/lib/format';
import { Portrait, SlidePhoto } from './photos';

/**
 * Per-slide palettes.
 *
 * Flat, saturated, full-bleed — no gradients fading into near-black. A slide is
 * one colour and one idea, which is what makes it survive being screenshotted
 * and reposted at thumbnail size.
 *
 * Each entry carries everything a slide needs to stay legible on its own
 * ground: the text colour, an accent that contrasts against *this* background
 * (never a fixed brand colour, which is how you end up with dark green on
 * black), the text colour to use on top of that accent, and a panel fill that
 * is a tint of the foreground rather than a hardcoded black.
 *
 * Nothing downstream may name a colour. Children inherit `color` and reach for
 * `--slide-accent` / `--slide-on-accent` / `--slide-panel`.
 */
export const BACKDROPS = {
  lime: {
    bg: '#C9F24D',
    fg: '#10130E',
    accent: '#1D3A2A',
    onAccent: '#F6F0E4',
    panel: 'rgb(16 19 14 / 0.09)',
  },
  pink: {
    bg: '#FF4FA3',
    fg: '#180410',
    accent: '#180410',
    onAccent: '#FF9DCB',
    panel: 'rgb(24 4 16 / 0.12)',
  },
  purple: {
    bg: '#4B1BD1',
    fg: '#F1ECFF',
    accent: '#C9F24D',
    onAccent: '#10130E',
    panel: 'rgb(255 255 255 / 0.10)',
  },
  orange: {
    bg: '#FF6B1A',
    fg: '#1A0A00',
    accent: '#1A0A00',
    onAccent: '#FFB25E',
    panel: 'rgb(26 10 0 / 0.12)',
  },
  ink: {
    bg: '#10130E',
    fg: '#EFEFE6',
    accent: '#C9F24D',
    onAccent: '#10130E',
    panel: 'rgb(255 255 255 / 0.07)',
  },
  teal: {
    bg: '#16E0C8',
    fg: '#04211D',
    accent: '#04211D',
    onAccent: '#16E0C8',
    panel: 'rgb(4 33 29 / 0.10)',
  },
  navy: {
    bg: '#121A3A',
    fg: '#E7EBFF',
    accent: '#C9F24D',
    onAccent: '#10130E',
    panel: 'rgb(255 255 255 / 0.08)',
  },
  /*
    Deepened from the design's #FF2E2E. That red is drawn behind three words at
    poster size, where 3.4:1 is fine; this deck puts body copy on it too, and
    at 15px the same pair is unreadable. #D61616 keeps the slide unmistakably
    the red one and clears 4.5:1.
  */
  red: {
    bg: '#D61616',
    fg: '#FFF3F3',
    accent: '#10130E',
    onAccent: '#FFF3F3',
    panel: 'rgb(255 255 255 / 0.14)',
  },
  /**
   * Reg's own voice. The one slide type set in a serif, on paper.
   *
   * The ember is a shade darker than the landing page's #C2571F, which is used
   * there only for display type. Here it also fills buttons, and white on the
   * lighter ember misses 4.5:1.
   */
  paper: {
    bg: '#F6EFE4',
    fg: '#15251C',
    accent: '#B04A18',
    onAccent: '#FFF6E8',
    panel: 'rgb(21 37 28 / 0.07)',
  },
  forest: {
    bg: '#1D3A2A',
    fg: '#F6EFE4',
    accent: '#F5B324',
    onAccent: '#221600',
    panel: 'rgb(246 239 228 / 0.08)',
  },
  /**
   * The paid report's ground. The design's second deck sits every written
   * slide on the same near-black and lets a per-slide bloom supply the colour,
   * so the colour rotation lives in `ReportGround` rather than here. White type;
   * lime for the one accented thing on a slide.
   */
  night: {
    bg: '#0B0B0F',
    fg: '#FFFFFF',
    accent: '#C9F24D',
    onAccent: '#10130E',
    panel: 'rgb(255 255 255 / 0.10)',
  },
} as const;

export type Backdrop = keyof typeof BACKDROPS;

/**
 * The dossier stock.
 *
 * The one slide in the deck that does not take the rotating ground. A case file
 * is a *paper* object — printed rules, a dotted leader, a portrait plate — and
 * every tone below is a shade of the same cream, which is what makes it read as
 * one sheet rather than as a card with lines drawn on it. Run the same markup on
 * lime and the rules become decoration.
 *
 * So this is a closed set, and it is here rather than in the slide for the same
 * reason `BACKDROPS` is: the deck keeps its colours in one file.
 *
 * `accents` rotate per person. Three, because a dossier is a serious document
 * with exactly one coloured thing on it, and a fourth hue starts to look like a
 * palette rather than a file stamp.
 */
export const DOSSIER = {
  stock: '#F3EADA',
  ink: '#15251C',
  /** The printed rules above and below the fact strip. */
  rule: '#D9CDB5',
  /** Leaders between a score's label and its number. */
  leader: '#CFC2A8',
  /** Unfilled part of a score bar. */
  track: '#E0D4BC',
  /** Small caps: exhibit number, field names, the official-title label. */
  muted: '#8A7B63',
  /** Body copy that is not the headline — the epithet, a score's label. */
  body: '#3F4A36',
  /** The portrait plate: the stock behind a photo, or behind the stand-in face. */
  plate: '#E5D9C1',
  accents: ['#C2571F', '#2F4FB8', '#1D3A2A'],
} as const;

/** Hebrew has no Anton. Names in it are set in Heebo's heaviest weight instead. */
const HEBREW = /[֐-׿]/;

function isHebrew(node: ReactNode): boolean {
  return typeof node === 'string' && HEBREW.test(node);
}

/**
 * The face for a line of display type.
 *
 * Anton for Latin, Heebo's heaviest for Hebrew — decided per string, because
 * an English deck still carries Hebrew names. A right-to-left deck takes Heebo
 * for everything at poster size, including the digits: a number set in a
 * condensed Latin face beside a Hebrew word in a wide one reads as two fonts
 * arguing, and the one thing a poster must not do is argue with itself.
 */
export function posterFace(text: ReactNode, rtl: boolean): CSSProperties {
  const hebrew = rtl || isHebrew(text);
  return {
    fontFamily: hebrew ? 'var(--yap-heb)' : 'var(--yap-poster)',
    fontWeight: hebrew ? 900 : 400,
    letterSpacing: hebrew ? '-0.01em' : '-0.02em',
  };
}

/**
 * Tracking for a small-caps label. Hebrew has no capitals and no small caps,
 * and a label tracked out to 0.18em in it reads as separate letters rather
 * than a word, so a right-to-left deck pulls every label's tracking in.
 */
const track = (rtl: boolean, wide: string) => (rtl ? 'tracking-[0.04em]' : wide);

export function slideVars(backdrop: Backdrop): CSSProperties {
  const b = BACKDROPS[backdrop];
  return {
    background: b.bg,
    color: b.fg,
    ['--slide-accent' as string]: b.accent,
    ['--slide-on-accent' as string]: b.onAccent,
    ['--slide-panel' as string]: b.panel,
  };
}

/**
 * Where the column sits on the slide. The statistics deck centres everything;
 * the written deck reads top-down like a page and bottom-up on its cover, the
 * way the design's second deck does.
 */
export type SlideAlign = 'start' | 'center' | 'end';

const ALIGN: Record<SlideAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

export function Slide({
  backdrop,
  photo,
  align = 'center',
  ground,
  accent,
  children,
}: {
  backdrop: Backdrop;
  /** Renders the reader's own photo behind the type, graded into this ground. */
  photo?: GroupSlot;
  align?: SlideAlign;
  /**
   * Anything drawn under the column at the slide's full size — the night
   * deck's bloom and grain. The column is `max-w-lg`, so a layer rendered
   * inside it would stop at the column's edge.
   */
  ground?: ReactNode;
  /**
   * This slide's own accent, overriding the backdrop's. On the night ground
   * the colour belongs to the slide rather than to the backdrop, and every
   * widget that reaches for `--slide-accent` should get the slide's.
   */
  accent?: { color: string; on: string };
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className={`yap-quiet-scroll absolute inset-0 flex flex-col ${ALIGN[align]} overflow-y-auto px-7 pt-24 pb-24 sm:px-14`}
      style={{
        ...slideVars(backdrop),
        ...(accent
          ? { ['--slide-accent' as string]: accent.color, ['--slide-on-accent' as string]: accent.on }
          : null),
      }}
    >
      {/* The ground is handed down rather than looked up, so the photo layer
          never has to know which slide it is on — it tints itself with whatever
          colour this slide already is. */}
      {photo && <SlidePhoto slot={photo} ground={BACKDROPS[backdrop].bg} />}
      {ground}
      {/*
        The design frames every slide inside a 368px phone. On a 1440px desktop
        the same type at the same measure would be a wall, so the column stays
        narrow and centred — the deck reads like a story on any screen instead
        of only on the one it was drawn for.
      */}
      <div className="relative mx-auto w-full max-w-lg">{children}</div>
    </motion.section>
  );
}

/**
 * Small caps label. Names the category so the big type does not have to.
 *
 * A `div`, not a `p`: the written deck puts a face beside the name in it, and
 * a face is a block.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  const { rtl } = useCopy();
  return (
    <motion.div
      // The written deck puts a model-written subtitle here, which may be in
      // the chat's script rather than the report's.
      dir="auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`mb-4 text-[11px] uppercase opacity-70 ${track(rtl, 'tracking-[0.18em]')}`}
      style={{ fontFamily: 'var(--yap-mono)' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The headline. Anton for Latin, Heebo 900 for Hebrew — Anton ships no Hebrew
 * glyphs at all, and letting it fall back would render a participant's name in
 * whatever the system happens to have.
 *
 * `dir="auto"` throughout: a headline is usually a participant's name, which
 * may be Hebrew while the surrounding UI copy is English. Letting the browser
 * pick direction per string is what keeps a mixed deck readable.
 */
export function Headline({ children }: { children: ReactNode }) {
  const { rtl } = useCopy();
  const hebrew = rtl || isHebrew(children);
  return (
    <motion.h2
      dir="auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={
        hebrew
          ? 'text-[clamp(2.6rem,10vw,4.4rem)] leading-[0.92]'
          : 'text-[clamp(2.6rem,10vw,4.6rem)] leading-[0.86] uppercase'
      }
      style={posterFace(children, rtl)}
    >
      {children}
    </motion.h2>
  );
}

/**
 * A number or a short statement at poster size.
 *
 * Anton in a Latin deck. A right-to-left deck sets it in Heebo, which is wider,
 * so the scale steps down a notch to keep a six-digit total inside a phone.
 * Direction is inherited: this used to be pinned LTR for the sake of the
 * numbers, but a number reads the same both ways and the word beside it does
 * not.
 */
export function Poster({
  children,
  size = 'lg',
}: {
  children: ReactNode;
  size?: 'lg' | 'md' | 'sm';
}) {
  const { rtl } = useCopy();
  const scale = (
    rtl
      ? {
          lg: 'text-[clamp(3rem,14vw,5.6rem)] leading-[0.9]',
          md: 'text-[clamp(2.1rem,9.5vw,3.5rem)] leading-[0.95]',
          sm: 'text-[clamp(1.4rem,5.5vw,1.9rem)] leading-[1]',
        }
      : {
          lg: 'text-[clamp(3.4rem,17vw,6.5rem)] leading-[0.82] uppercase',
          md: 'text-[clamp(2.4rem,11vw,4rem)] leading-[0.88] uppercase',
          sm: 'text-[clamp(1.5rem,6vw,2.1rem)] leading-[0.95] uppercase',
        }
  )[size];

  return (
    <div className={scale} style={posterFace(children, rtl)}>
      {children}
    </div>
  );
}

/** Reg talking. The only voice in the deck set in a serif. */
export function RegProse({ children }: { children: ReactNode }) {
  return (
    <motion.p
      dir="auto"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="text-[clamp(1.4rem,5vw,2.05rem)] leading-[1.12]"
      style={{ fontFamily: 'var(--yap-serif)' }}
    >
      {children}
    </motion.p>
  );
}

/**
 * The line that makes it worth screenshotting. Deliberately last in the reading
 * order and last to animate in — it is the punchline, not the label.
 */
export function Punchline({ children }: { children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mt-5 max-w-[34ch] text-[15px] leading-[1.5] opacity-90"
    >
      {children}
    </motion.p>
  );
}

/** A pill of secondary information, in the accent rather than the body colour. */
export function Tag({ children }: { children: ReactNode }) {
  const { rtl } = useCopy();
  return (
    <span
      className={`mt-5 inline-flex w-fit rounded-full px-3.5 py-2 text-[11px] uppercase ${track(rtl, 'tracking-[0.1em]')}`}
      style={{
        fontFamily: 'var(--yap-mono)',
        background: 'var(--slide-accent)',
        color: 'var(--slide-on-accent)',
      }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  const { rtl } = useCopy();
  return (
    <div
      className="rounded-2xl border px-3.5 py-3"
      style={{
        background: 'var(--slide-panel)',
        borderColor: 'color-mix(in srgb, currentColor 14%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p
        className={`text-[9.5px] uppercase opacity-65 ${track(rtl, 'tracking-[0.15em]')}`}
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        {label}
      </p>
      {/* A value is a date or a duration as often as a number, and in Hebrew
          both are words — "פחות מדקה" has no Anton glyphs at all. */}
      <p dir="auto" className="mt-1 text-xl leading-none" style={posterFace(value, rtl)}>
        {value}
      </p>
    </div>
  );
}

/** A soft card for prose. Tinted from the foreground, so it works on any ground. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--slide-panel)' }}>
      {children}
    </div>
  );
}

/**
 * Counts up to the real figure. The animation is the point on a slide whose
 * only job is a number — a static 173,474 is a fact, a climbing one is a
 * reveal.
 */
export function AnimatedNumber({
  value,
  locale = 'en-GB',
  className = '',
}: {
  value: number;
  /** The report's locale, not the chat's — this number is the report talking. */
  locale?: string;
  className?: string;
}) {
  const count = useMotionValue(0);
  const format = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const text = useTransform(count, (v) => format.format(Math.round(v)));

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, {
      duration: Math.min(2.2, 0.9 + Math.log10(Math.max(10, value)) * 0.32),
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [count, value]);

  return <motion.span className={className}>{text}</motion.span>;
}

/**
 * The leaderboard. Rank in Anton, name in its own script, count in mono pinned
 * to the trailing edge — the design's own shape, and the reason it reads at a
 * glance is that the eye only has to scan one column.
 *
 * Every row carries a face: the reader's photo of that person where there is
 * one, the animal that stands in for them where there is not. The portraits are
 * deliberately small — the ranking is the content, and eight circular
 * photographs down the left edge would turn a leaderboard into a contact list.
 *
 * `share` is optional and adds a second line under each row: a bar drawn against
 * the leader, with the person's percentage of the whole chat at the end of it.
 * Both live below rather than becoming further columns — the name row is already
 * four items wide inside a 368px phone, and the name is the one thing on it that
 * must not be squeezed. The percentage also belongs next to the bar it labels.
 */
export function Ranking({
  rows,
  locale = 'en-GB',
}: {
  rows: { label: string; value: number; share?: number }[];
  locale?: string;
}) {
  const { rtl } = useCopy();
  // Bars are scaled to the leader, not to 100%: one person with 18% of a
  // sixteen-person chat is the top of this board, and a bar filling a fifth of
  // the slide would read as "barely spoke".
  const topShare = Math.max(...rows.map((r) => r.share ?? 0), 0);

  return (
    <div className="mt-5 flex flex-col">
      {rows.map((row, i) => (
        <motion.div
          key={row.label}
          // Rows slide in from the edge they are read from.
          initial={{ opacity: 0, x: rtl ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-1.5 border-b ${i < 3 ? 'py-2' : 'py-1.5'}`}
          style={{
            opacity: i > 2 ? 0.62 : 1,
            borderColor: 'color-mix(in srgb, currentColor 12%, transparent)',
          }}
        >
          {/* The design's board: the rank small in mono, the name at a size
              that falls with the rank, the count pinned to the trailing edge. */}
          <div className="flex items-center gap-2.5">
            <span
              dir="ltr"
              className="min-w-[20px] shrink-0 text-[10px] opacity-50"
              style={{ fontFamily: 'var(--yap-mono)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <Portrait name={row.label} size={i === 0 ? 34 : 26} />
            <span
              dir="auto"
              className="min-w-0 flex-1 truncate"
              style={{
                ...posterFace(row.label, rtl),
                fontSize: i === 0 ? 'clamp(30px,10vw,44px)' : i < 3 ? 'clamp(23px,7.5vw,32px)' : '19px',
                lineHeight: 0.98,
                color: i === 0 ? 'var(--slide-accent)' : undefined,
              }}
            >
              {row.label}
            </span>
            <span
              dir="ltr"
              className="shrink-0 text-xs tabular-nums"
              style={{
                fontFamily: 'var(--yap-mono)',
                color: i === 0 ? 'var(--slide-accent)' : undefined,
                opacity: i === 0 ? 1 : 0.75,
              }}
            >
              {new Intl.NumberFormat(locale).format(row.value)}
            </span>
          </div>
          {row.share !== undefined && (
            <div className="ms-10 flex items-center gap-3">
              <div
                aria-hidden="true"
                className="h-[3px] flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--slide-panel)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(3, (row.share / Math.max(topShare, 0.0001)) * 100)}%`,
                  }}
                  transition={{ delay: 0.35 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      i === 0
                        ? 'var(--slide-accent)'
                        : 'color-mix(in srgb, currentColor 45%, transparent)',
                  }}
                />
              </div>
              <span
                className="w-9 shrink-0 text-end text-xs tabular-nums"
                style={{
                  fontFamily: 'var(--yap-mono)',
                  color: i === 0 ? 'var(--slide-accent)' : undefined,
                  opacity: i === 0 ? 1 : 0.75,
                }}
              >
                {percent(row.share)}
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/** Horizontal bars, filled in the slide's accent. */
export function BubbleBars({
  rows,
}: {
  rows: { label: string; value: number; caption: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="mt-7 flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={row.label} className="flex items-center gap-3">
          <span dir="auto" className="w-20 shrink-0 truncate text-sm opacity-75">
            {row.label}
          </span>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(8, (row.value / max) * 100)}%` }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-8 min-w-fit items-center justify-end rounded-lg px-2.5"
            style={{ background: 'var(--slide-accent)' }}
          >
            <span
              className="text-xs whitespace-nowrap"
              style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-on-accent)' }}
            >
              {row.caption}
            </span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

/** The one button shape in the deck: accent fill, hard shadow, no border. */
export function DeckButton({
  children,
  onClick,
  disabled,
  variant = 'solid',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'ghost';
}) {
  const solid = variant === 'solid';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] transition disabled:opacity-60"
      style={
        solid
          ? {
              fontFamily: 'var(--yap-sans)',
              fontWeight: 700,
              background: 'var(--slide-accent)',
              color: 'var(--slide-on-accent)',
              border: 0,
            }
          : {
              fontFamily: 'var(--yap-mono)',
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: 'currentColor',
              border: '1px solid color-mix(in srgb, currentColor 32%, transparent)',
            }
      }
    >
      {children}
    </button>
  );
}
