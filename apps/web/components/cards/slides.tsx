'use client';

import { motion } from 'framer-motion';
import type { ChatStats } from '@wrapped/core';
import type { GroupSlot } from '@/lib/brief';
import { GROUP_SLOT_BACKDROP, Portrait } from './photos';
import {
  formatDay,
  formatDays,
  formatDuration,
  formatHour,
  formatNumber,
  percent,
  shortName,
} from '@/lib/format';
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
  render: (s: ChatStats) => React.ReactNode;
}

/**
 * A name at poster size with the reader's photo of that person beside it.
 * Collapses to the headline alone when there is no photo, which is why the
 * portrait sits in a flex row rather than being positioned against it.
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
    render: (s) => (
      <>
        <Eyebrow>{s.span.label}</Eyebrow>
        <Headline>{s.groupName ?? 'Your chat'}</Headline>
        <Poster size="md">
          <span className="mt-2 block">Yapped.</span>
        </Poster>
        <Punchline>
          Reg read all {formatNumber(s.totalMessages, s.language)} messages so you never have
          to. {formatDays(s.span.days)} of it. Tap through. Volume up.
        </Punchline>
      </>
    ),
  },

  {
    id: 'total',
    backdrop: 'pink',
    available: (s) => s.totalMessages > 0,
    render: (s) => (
      <>
        <Eyebrow>Total damage</Eyebrow>
        <Poster>
          <AnimatedNumber value={s.totalMessages} language={s.language} />
        </Poster>
        <Poster size="sm">
          <span className="mt-2 block">
            messages · {formatNumber(s.people.length, s.language)} people
          </span>
        </Poster>
        <Punchline>
          That is {formatNumber(Math.round(s.perDay), s.language)} a day, every day, for{' '}
          {formatDays(s.span.days)}. Including the years you claim you were &quot;busy&quot;.
        </Punchline>
        <div className="mt-7 grid grid-cols-3 gap-2">
          <Stat label="Words" value={formatNumber(s.totalWords, s.language)} />
          <Stat label="Emoji" value={formatNumber(s.totalEmoji, s.language)} />
          <Stat label="Media" value={formatNumber(s.totalAttachments, s.language)} />
        </div>
      </>
    ),
  },

  {
    id: 'talker',
    backdrop: 'purple',
    available: (s) => s.people.length >= 2,
    render: (s) => {
      const top = s.people[0]!;
      const rest = s.people.slice(1, 5);
      return (
        <>
          <Eyebrow>The yap leaderboard</Eyebrow>
          <Ranking
            language={s.language}
            rows={[top, ...rest].map((p) => ({ label: p.name, value: p.messages }))}
          />
          <Punchline>
            {percent(top.share)} of every message in this chat came from one person.
            {rest[0] &&
              ` That is ${(top.messages / Math.max(1, rest[0].messages)).toFixed(1)}× more than ${shortName(rest[0].name)}, who is not even close.`}
          </Punchline>
        </>
      );
    },
  },

  {
    id: 'nightowl',
    backdrop: 'navy',
    available: (s) => person(s, s.awards.nightOwl) !== null,
    render: (s) => {
      const owl = person(s, s.awards.nightOwl)!;
      const peakHour = owl.hourHistogram.indexOf(Math.max(...owl.hourHistogram));
      const max = Math.max(...owl.hourHistogram, 1);
      return (
        <>
          <Eyebrow>When they yap</Eyebrow>
          <Named name={owl.name} />
          <Poster size="sm">
            <span className="mt-3 block">
              Peak hour:{' '}
              <span style={{ color: 'var(--slide-accent)' }}>{formatHour(peakHour)}</span>
            </span>
          </Poster>

          {/* The shape of someone's day is the actual content here, so it is
              drawn rather than described — and only the small hours are given
              the accent, because those are the ones that make the point. */}
          <div className="mt-6 flex h-[130px] items-end justify-center gap-[3px]" aria-hidden="true">
            {owl.hourHistogram.map((count, hour) => (
              <motion.div
                key={hour}
                initial={{ height: 2 }}
                animate={{ height: `${Math.max(4, (count / max) * 100)}%` }}
                transition={{ delay: 0.3 + hour * 0.02, duration: 0.5 }}
                className="w-full rounded-t-[3px]"
                style={{
                  background:
                    hour < 5 || hour >= 22
                      ? 'var(--slide-accent)'
                      : 'color-mix(in srgb, currentColor 45%, transparent)',
                }}
              />
            ))}
          </div>
          <p
            className="mt-2 flex justify-between text-[10px] opacity-60"
            style={{ fontFamily: 'var(--yap-mono)' }}
          >
            <span>00h</span>
            <span>12h</span>
            <span>23h</span>
          </p>

          <Punchline>
            {formatNumber(owl.nightMessages, s.language)} messages sent between midnight and
            5 AM. Nobody asked for them. They arrived anyway.
          </Punchline>
        </>
      );
    },
  },

  {
    id: 'fastest',
    backdrop: 'teal',
    available: (s) => person(s, s.awards.fastestReplier) !== null,
    render: (s) => {
      const fast = person(s, s.awards.fastestReplier)!;
      const slow = person(s, s.awards.slowestReplier);
      return (
        <>
          <Eyebrow>Fastest trigger finger</Eyebrow>
          <Named name={fast.name} />
          <Poster size="md">
            <span className="mt-2 block">{formatDuration(fast.medianResponseMs)}</span>
          </Poster>
          <Punchline>
            Across {formatNumber(fast.responseSamples, s.language)} replies, they somehow got
            there before anyone else had finished reading.
          </Punchline>
          {slow && slow.name !== fast.name && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat label="Fastest" value={formatDuration(fast.medianResponseMs)} />
              <Stat
                label={`Slowest · ${shortName(slow.name)}`}
                value={formatDuration(slow.medianResponseMs)}
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
    render: (s) => {
      const ghost = person(s, s.awards.ghost)!;
      return (
        <>
          <Eyebrow>Certified ghost</Eyebrow>
          <div style={{ color: 'var(--slide-accent)' }}>
            <Named name={ghost.name} />
          </div>
          <div style={{ color: 'var(--slide-accent)' }}>
            <Poster size="md">
              <span className="mt-2 block">{formatDays(ghost.longestSilenceDays)}</span>
            </Poster>
          </div>
          <Punchline>
            Gone that long without a single message.
            {ghost.stillGone
              ? ' And has not come back. The group carried on without them.'
              : ' Then returned as if nothing had happened.'}
          </Punchline>
          {ghost.longestSilenceFrom && ghost.longestSilenceTo && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat label="Last seen" value={formatDay(ghost.longestSilenceFrom, s.language)} />
              <Stat
                label={ghost.stillGone ? 'Still gone' : 'Resurfaced'}
                value={formatDay(ghost.longestSilenceTo, s.language)}
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
    render: (s) => {
      const podium = s.topEmoji.slice(0, 3);
      return (
        <>
          <Eyebrow>Emoji podium</Eyebrow>
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
                  {formatNumber(e.count, s.language)}
                </div>
              </motion.div>
            ))}
          </div>
          <Punchline>
            {podium[0]!.value} was used {formatNumber(podium[0]!.count, s.language)} times
            {podium[1] &&
              ` — ${(podium[0]!.count / Math.max(1, podium[1].count)).toFixed(1)}× more than ${podium[1].value}`}
            . No serious conversation here ever survived long enough to need a second one.
          </Punchline>
          <div className="mt-6 flex flex-wrap gap-2">
            {s.topEmoji.slice(3, 9).map((e) => (
              <span
                key={e.value}
                className="flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{ background: 'var(--slide-panel)' }}
              >
                <span className="text-lg leading-none">{e.value}</span>
                <span
                  className="text-xs opacity-75"
                  style={{ fontFamily: 'var(--yap-mono)' }}
                >
                  {formatNumber(e.count, s.language)}
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
    render: (s) => {
      const day = s.busiestDay!;
      const explosion = s.explosions.find((e) => e.day === day.day);
      return (
        <>
          <Eyebrow>Peak chaos</Eyebrow>
          <Headline>{formatDay(day.day, s.language)}</Headline>
          <Poster size="sm">
            <span className="mt-2 block">
              {formatNumber(day.count, s.language)} messages in one day
            </span>
          </Poster>
          <Punchline>
            {(day.count / Math.max(1, s.perDay)).toFixed(0)}× a normal day here. Something
            happened. Everyone remembers what.
          </Punchline>
          {explosion && explosion.topSenders.length > 0 && (
            <BubbleBars
              rows={explosion.topSenders.map((t) => ({
                label: shortName(t.value),
                value: t.count,
                caption: formatNumber(t.count, s.language),
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
    render: (s) => {
      const streak = s.longestStreak!;
      const silence = s.silences[0];
      return (
        <>
          <Eyebrow>Longest streak</Eyebrow>
          <Poster>
            <AnimatedNumber value={streak.days} language={s.language} />
            <span className="ml-3 text-[0.28em] tracking-normal">days</span>
          </Poster>
          <Punchline>
            Not one silent day between {formatDay(streak.from, s.language)} and{' '}
            {formatDay(streak.to, s.language)}.
            {silence &&
              ` The other extreme: ${formatDays(silence.days)} of total silence, finally broken by "${silence.brokenBy?.body.slice(0, 60) ?? '…'}".`}
          </Punchline>
          <Tag>Nobody here has ever left a chat unread</Tag>
        </>
      );
    },
  },
];

/** Slides that can be filled honestly from this particular chat. */
export function slidesFor(stats: ChatStats): SlideDef[] {
  return SLIDES.filter((slide) => slide.available(stats));
}
