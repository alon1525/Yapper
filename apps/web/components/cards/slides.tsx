'use client';

import { motion } from 'framer-motion';
import type { ChatStats } from '@wrapped/core';
import type { GroupSlot } from '@/lib/brief';
import type { Localised } from '@/lib/copy';
import { GROUP_SLOT_BACKDROP, Portrait } from './photos';
import { duration, day, hour, num, percent, shortName, span, spanLabel } from '@/lib/localFormat';
import {
  AnimatedNumber,
  BubbleBars,
  Eyebrow,
  Headline,
  Poster,
  Punchline,
  Ranking,
  Stat,
  Tag,
  type Backdrop,
} from './Shell';

export interface SlideDef {
  id: string;
  backdrop: Backdrop;
  /**
   * Takes a group photo behind the type when the reader supplied one for this
   * slot. Only the four slides the onboarding previews carry one — a photo on
   * every slide would be a slideshow, and the deck is not a slideshow.
   */
  photo?: GroupSlot;
  /** A slide that cannot be filled honestly is dropped rather than faked. */
  available: (s: ChatStats) => boolean;
  /**
   * Renders in the language the reader asked for.
   *
   * Every string here used to be typed straight into the JSX, which meant a
   * report in Japanese was a paragraph of Japanese under an English eyebrow.
   * The copy lives in `lib/copy` now and arrives as `l.t`, along with the
   * locale its numbers and dates are formatted in.
   */
  render: (s: ChatStats, l: Localised) => React.ReactNode;
}

/**
 * A name at poster size with that person's face beside it — the reader's photo
 * of them, or the animal that stands in when they did not supply one. Either
 * way something occupies the slot, which is why the portrait sits in a flex row
 * rather than being positioned against the headline.
 *
 * The headline box is `min-w-0` but deliberately not `flex-1`: stretching it to
 * the full column pushes a Hebrew name — which aligns to the end of its own box
 * — clear across the slide, leaving the portrait stranded on the far left. At
 * content width the face and the name stay together whichever way the script
 * runs, and a long name still wraps, because `min-w-0` lets the item shrink
 * below its content.
 */
function Named({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-4">
      <Portrait name={name} size={72} />
      <div className="min-w-0">
        <Headline>{name}</Headline>
      </div>
    </div>
  );
}

const person = (s: ChatStats, name: string | null) =>
  s.people.find((p) => p.name === name) ?? null;

/**
 * The colours are sequenced, not assigned. Consecutive slides never share a
 * ground, and the two dark ones (ink, navy) are spaced apart so the deck does
 * not go quiet in the middle — it is a story with a rhythm, and colour is how
 * that rhythm is felt.
 */
export const SLIDES: SlideDef[] = [
  {
    id: 'welcome',
    backdrop: GROUP_SLOT_BACKDROP.opener,
    photo: 'opener',
    available: () => true,
    render: (s, l) => (
      <>
        <Eyebrow>{spanLabel(l, s)}</Eyebrow>
        <Headline>{s.groupName ?? l.t('welcome.fallbackName')}</Headline>
        <Poster size="md">
          <span className="mt-2 block">{l.t('welcome.poster')}</span>
        </Poster>
        <Punchline>
          {l.t('welcome.punchline', {
            messages: num(l, s.totalMessages),
            days: span(l, s.span.days),
          })}
        </Punchline>
      </>
    ),
  },

  {
    id: 'total',
    backdrop: 'pink',
    available: (s) => s.totalMessages > 0,
    render: (s, l) => (
      <>
        <Eyebrow>{l.t('total.eyebrow')}</Eyebrow>
        <Poster>
          <AnimatedNumber value={s.totalMessages} locale={l.locale} />
        </Poster>
        <Poster size="sm">
          <span className="mt-2 block">
            {l.t('total.unit', { people: num(l, s.people.length) })}
          </span>
        </Poster>
        <Punchline>
          {l.t('total.punchline', {
            perDay: num(l, Math.round(s.perDay)),
            days: span(l, s.span.days),
          })}
        </Punchline>
        <div className="mt-7 grid grid-cols-3 gap-2">
          <Stat label={l.t('total.words')} value={num(l, s.totalWords)} />
          <Stat label={l.t('total.emoji')} value={num(l, s.totalEmoji)} />
          <Stat label={l.t('total.media')} value={num(l, s.totalAttachments)} />
        </div>
      </>
    ),
  },

  {
    id: 'talker',
    backdrop: 'purple',
    available: (s) => s.people.length >= 2,
    render: (s, l) => {
      const top = s.people[0]!;
      const rest = s.people.slice(1, 5);
      return (
        <>
          <Eyebrow>{l.t('talker.eyebrow')}</Eyebrow>
          <Ranking
            locale={l.locale}
            rows={[top, ...rest].map((p) => ({
              label: p.name,
              value: p.messages,
              // The person's own share, not one derived from the counts on
              // screen — these are the top five of a larger chat, and the
              // punchline below quotes the same figure.
              share: p.share,
            }))}
          />
          <Punchline>
            {l.t('talker.punchline', { share: percent(top.share) })}
            {rest[0] && (
              <>
                {' '}
                {l.t('talker.punchlineRunnerUp', {
                  times: (top.messages / Math.max(1, rest[0].messages)).toFixed(1),
                  name: shortName(rest[0].name),
                })}
              </>
            )}
          </Punchline>
        </>
      );
    },
  },

  /**
   * The chat's own clock, not one person's.
   *
   * This slide used to be headlined with whoever won the night-owl award, which
   * put a single name above a chart nobody could tell apart from the group's —
   * and the sample story on the landing page promises the group's. The award
   * still appears, as a footnote where it belongs.
   */
  {
    id: 'hours',
    backdrop: 'navy',
    available: (s) => s.totalMessages > 0,
    render: (s, l) => {
      const peakHour = s.busiestHour?.hour ?? 0;
      const max = Math.max(...s.hourHistogram, 1);
      const night = s.hourHistogram.slice(0, 5).reduce((sum, count) => sum + count, 0);
      const owl = person(s, s.awards.nightOwl);
      return (
        <>
          <Eyebrow>{l.t('hours.eyebrow')}</Eyebrow>
          <Poster size="md">
            {/* The hour is the accented word, and it does not sit in the same
                place in every language — Japanese puts it last, English after a
                colon. Splitting the untranslated template on its own
                placeholder puts the accent on the hour wherever the sentence
                happens to keep it. */}
            <span className="mt-2 block">
              {(() => {
                const [before = '', after = ''] = l.t('hours.peak').split('{hour}');
                return (
                  <>
                    {before}
                    <span style={{ color: 'var(--slide-accent)' }}>{hour(l, peakHour)}</span>
                    {after}
                  </>
                );
              })()}
            </span>
          </Poster>

          {/* The shape of the group's day is the actual content here, so it is
              drawn rather than described — and only the small hours are given
              the accent, because those are the ones that make the point.

              Pinned left-to-right in every language: a clock face and a
              timeline run that way in Hebrew publications too, and a day that
              started on the right would be read as ending at midnight. */}
          <div
            dir="ltr"
            className="mt-6 flex h-[130px] items-end justify-center gap-[3px]"
            aria-hidden="true"
          >
            {s.hourHistogram.map((count, h) => (
              <motion.div
                key={h}
                initial={{ height: 2 }}
                animate={{ height: `${Math.max(4, (count / max) * 100)}%` }}
                transition={{ delay: 0.3 + h * 0.02, duration: 0.5 }}
                className="w-full rounded-t-[3px]"
                style={{
                  background:
                    h < 5 || h >= 22
                      ? 'var(--slide-accent)'
                      : 'color-mix(in srgb, currentColor 45%, transparent)',
                }}
              />
            ))}
          </div>
          <p
            dir="ltr"
            className="mt-2 flex justify-between text-[10px] opacity-60"
            style={{ fontFamily: 'var(--yap-mono)' }}
          >
            <span>00h</span>
            <span>12h</span>
            <span>23h</span>
          </p>

          <Punchline>{l.t('hours.punchline', { count: num(l, night) })}</Punchline>
          {/* The count, not just the share: the night-owl award only needs five
              messages to win, and "50% after midnight" on its own would be six
              messages dressed up as a habit. */}
          {owl && (
            <Tag>
              {l.t('hours.tag', {
                name: shortName(owl.name),
                count: num(l, owl.nightMessages),
              })}
            </Tag>
          )}
        </>
      );
    },
  },

  {
    id: 'fastest',
    backdrop: 'teal',
    available: (s) => person(s, s.awards.fastestReplier) !== null,
    render: (s, l) => {
      const fast = person(s, s.awards.fastestReplier)!;
      const slow = person(s, s.awards.slowestReplier);
      return (
        <>
          <Eyebrow>{l.t('fastest.eyebrow')}</Eyebrow>
          <Named name={fast.name} />
          <Poster size="md">
            <span className="mt-2 block">
              {duration(l, fast.medianResponseMs, s.timestampPrecisionMs)}
            </span>
          </Poster>
          <Punchline>
            {l.t('fastest.punchline', { count: num(l, fast.responseSamples) })}
          </Punchline>
          {slow && slow.name !== fast.name && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat
                label={l.t('fastest.fastest')}
                value={duration(l, fast.medianResponseMs, s.timestampPrecisionMs)}
              />
              <Stat
                label={l.t('fastest.slowest', { name: shortName(slow.name) })}
                value={duration(l, slow.medianResponseMs, s.timestampPrecisionMs)}
              />
            </div>
          )}
        </>
      );
    },
  },

  {
    id: 'ghost',
    backdrop: 'ink',
    available: (s) => {
      const g = person(s, s.awards.ghost);
      return g !== null && g.longestSilenceDays >= 7;
    },
    render: (s, l) => {
      const ghost = person(s, s.awards.ghost)!;
      return (
        <>
          <Eyebrow>{l.t('ghost.eyebrow')}</Eyebrow>
          <div style={{ color: 'var(--slide-accent)' }}>
            <Named name={ghost.name} />
          </div>
          <div style={{ color: 'var(--slide-accent)' }}>
            <Poster size="md">
              <span className="mt-2 block">{span(l, ghost.longestSilenceDays)}</span>
            </Poster>
          </div>
          <Punchline>
            {l.t('ghost.punchline')}{' '}
            {ghost.stillGone ? l.t('ghost.stillGone') : l.t('ghost.returned')}
          </Punchline>
          {ghost.longestSilenceFrom && ghost.longestSilenceTo && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat label={l.t('ghost.lastSeen')} value={day(l, ghost.longestSilenceFrom)} />
              <Stat
                label={ghost.stillGone ? l.t('ghost.stillGoneLabel') : l.t('ghost.resurfaced')}
                value={day(l, ghost.longestSilenceTo)}
              />
            </div>
          )}
        </>
      );
    },
  },

  {
    id: 'emoji',
    backdrop: 'purple',
    available: (s) => s.topEmoji.length >= 3,
    render: (s, l) => {
      const podium = s.topEmoji.slice(0, 3);
      return (
        <>
          <Eyebrow>{l.t('emoji.eyebrow')}</Eyebrow>
          <div className="mt-4 flex items-end gap-5">
            {podium.map((e, i) => (
              <motion.div
                key={e.value}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: i === 0 ? 1 : i === 1 ? 0.85 : 0.7 }}
                transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 180, damping: 14 }}
                className="text-center"
              >
                <div style={{ fontSize: `${52 - i * 13}px`, lineHeight: 1 }}>{e.value}</div>
                <div
                  className="mt-1"
                  style={{
                    fontFamily: 'var(--yap-poster)',
                    fontSize: `${26 - i * 5}px`,
                    color: i === 0 ? 'var(--slide-accent)' : undefined,
                  }}
                >
                  {num(l, e.count)}
                </div>
              </motion.div>
            ))}
          </div>
          <Punchline>
            {podium[1]
              ? l.t('emoji.punchlineRunnerUp', {
                  emoji: podium[0]!.value,
                  count: num(l, podium[0]!.count),
                  times: (podium[0]!.count / Math.max(1, podium[1].count)).toFixed(1),
                  other: podium[1].value,
                })
              : l.t('emoji.punchline', {
                  emoji: podium[0]!.value,
                  count: num(l, podium[0]!.count),
                })}
          </Punchline>
          <div className="mt-6 flex flex-wrap gap-2">
            {s.topEmoji.slice(3, 9).map((e) => (
              <span
                key={e.value}
                className="flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{ background: 'var(--slide-panel)' }}
              >
                <span className="text-lg leading-none">{e.value}</span>
                <span className="text-xs opacity-75" style={{ fontFamily: 'var(--yap-mono)' }}>
                  {num(l, e.count)}
                </span>
              </span>
            ))}
          </div>
        </>
      );
    },
  },

  {
    id: 'chaos',
    backdrop: GROUP_SLOT_BACKDROP.chaos,
    photo: 'chaos',
    available: (s) => s.busiestDay !== null && s.busiestDay.count > 20,
    render: (s, l) => {
      const busiest = s.busiestDay!;
      const explosion = s.explosions.find((e) => e.day === busiest.day);
      return (
        <>
          <Eyebrow>{l.t('chaos.eyebrow')}</Eyebrow>
          <Headline>{day(l, busiest.day)}</Headline>
          <Poster size="sm">
            <span className="mt-2 block">
              {l.t('chaos.unit', { count: num(l, busiest.count) })}
            </span>
          </Poster>
          <Punchline>
            {l.t('chaos.punchline', {
              times: (busiest.count / Math.max(1, s.perDay)).toFixed(0),
            })}
          </Punchline>
          {explosion && explosion.topSenders.length > 0 && (
            <BubbleBars
              rows={explosion.topSenders.map((t) => ({
                label: shortName(t.value),
                value: t.count,
                caption: num(l, t.count),
              }))}
            />
          )}
        </>
      );
    },
  },

  {
    id: 'streak',
    backdrop: 'orange',
    available: (s) => (s.longestStreak?.days ?? 0) >= 5,
    render: (s, l) => {
      const streak = s.longestStreak!;
      const silence = s.silences[0];
      return (
        <>
          <Eyebrow>{l.t('streak.eyebrow')}</Eyebrow>
          <Poster>
            <AnimatedNumber value={streak.days} locale={l.locale} />
            <span className="ms-3 text-[0.28em] tracking-normal">{l.t('streak.days')}</span>
          </Poster>
          <Punchline>
            {l.t('streak.punchline', { from: day(l, streak.from), to: day(l, streak.to) })}
            {silence && (
              <>
                {' '}
                {l.t('streak.silence', {
                  days: span(l, silence.days),
                  quote: silence.brokenBy?.body.slice(0, 60) ?? '…',
                })}
              </>
            )}
          </Punchline>
          <Tag>{l.t('streak.tag')}</Tag>
        </>
      );
    },
  },
];

/** Slides that can be filled honestly from this particular chat. */
export function slidesFor(stats: ChatStats): SlideDef[] {
  return SLIDES.filter((slide) => slide.available(stats));
}
