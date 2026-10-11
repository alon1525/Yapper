'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { AnonymizedMessage, ChatStats } from '@wrapped/core';
import { useCopy } from '@/lib/copy';
import type { PreviewState } from '@/lib/useAiPreview';
import type { ReportState } from '@/lib/useReport';
import { GROUP_SLOT_BACKDROP } from './photos';
import { NightGround, accentOf } from './ReportGround';
import { ReportProgress } from './ReportProgress';
import { DeckButton, Eyebrow, RegProse, Slide, type Backdrop } from './Shell';

/** The night ground, with the design's amber as the one warm thing on it. */
export const WALL_BACKDROP: Backdrop = GROUP_SLOT_BACKDROP.paywall;

/**
 * The wall. One slide where there used to be two.
 *
 * The deck used to put the free story behind one gate and the paid report
 * behind the next: two consecutive slides, each with Reg's face, a serif
 * question and an amber button, each asking for consent to send something and
 * each followed by a wait. Read in sequence they were the same slide twice,
 * and the second opened by claiming "one story was free" to readers who had
 * swiped straight past the first.
 *
 * So this is the single place Reg asks. The report is the primary action. The
 * free, pseudonymised story is the secondary one — and once it has been
 * written it is shown here, in place of the pitch, because a story the reader
 * just laughed at sells the rest better than a bulleted list does.
 *
 * Request state belongs to the deck, not to this slide: a slide unmounts when
 * the reader swipes past it, and state held here would mean swiping back pays
 * for the same report twice. Once the report is ready the button is gone for
 * the same reason — a second tap would have run the whole pipeline again.
 */
export function WallSlide({
  stats,
  sample,
  preview,
  report,
  paidCount,
  onPreview,
  onUnlock,
}: {
  stats: ChatStats;
  /**
   * The anonymised lines the free story would be written from, for the
   * inspect panel. Null when the chat is not in memory — a report opened from
   * this device's storage — in which case nothing can be written either.
   */
  sample: (() => AnonymizedMessage[]) | null;
  preview: PreviewState;
  report: ReportState;
  /** How many paid slides follow, once there are any. */
  paidCount: number;
  onPreview: () => void;
  onUnlock: () => void;
}) {
  const copy = useCopy();
  const [showSample, setShowSample] = useState(false);
  const peopleCount = stats.people.length;
  const canWrite = sample !== null;

  const workingPhase =
    report.phase === 'unlocking' ||
    report.phase === 'investigating' ||
    report.phase === 'verifying' ||
    report.phase === 'writing'
      ? report.phase
      : null;
  const previewing = preview.phase === 'sending';
  const memory = preview.phase === 'done' ? preview.preview.memories[0] : undefined;

  const included = [
    copy.t('wall.sellStories'),
    copy.t('wall.sellCards'),
    copy.t('wall.sellAwards'),
    copy.t('wall.sellEras'),
  ];

  const mono = { fontFamily: 'var(--yap-mono)' } as const;

  return (
    <Slide
      backdrop={WALL_BACKDROP}
      photo="paywall"
      // The warm bloom the design puts behind Reg on this exact frame, and the
      // amber button under it.
      ground={<NightGround tone="sun" at="top" photo="paywall" />}
      accent={accentOf('sun')}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reg.png" alt="" className="mb-4 block h-16 w-16 rounded-full" />

        {report.phase === 'ready' ? (
          <>
            <Eyebrow>{copy.t('wall.ready')}</Eyebrow>
            <RegProse>{copy.t('wall.readyProse')}</RegProse>
            <p dir="auto" className="mt-5 text-[11px] opacity-60" style={mono}>
              {copy.t('wall.readyHint', { n: paidCount })}
            </p>
          </>
        ) : workingPhase ? (
          <>
            <Eyebrow>{copy.t('wall.working')}</Eyebrow>
            <ReportProgress
              phase={workingPhase}
              messages={stats.totalMessages}
              people={peopleCount}
            />
          </>
        ) : (
          <>
            <Eyebrow>{memory ? copy.t('wall.eyebrow') : copy.t('wall.turn')}</Eyebrow>

            {memory ? (
              <>
                {/* Model-written in the chat's own language, so dir="auto" on
                    every node — a Hebrew paragraph inside an LTR block pushes
                    its full stop and trailing emoji to the wrong edge. */}
                <RegProse>&ldquo;{memory.title}&rdquo;</RegProse>
                <motion.p
                  dir="auto"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 text-[14.5px] leading-[1.6] opacity-85"
                >
                  {memory.story}
                </motion.p>
                <p dir="auto" className="mt-5 text-[14.5px] leading-relaxed opacity-90">
                  {copy.t('wall.previewLede')}
                </p>
              </>
            ) : (
              <>
                <RegProse>{copy.t('wall.pitch')}</RegProse>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {included.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-[14.5px] leading-relaxed"
                    >
                      <span
                        className="mt-[3px] shrink-0 text-[11px]"
                        style={{ ...mono, color: 'var(--slide-accent)' }}
                      >
                        ✦
                      </span>
                      <span dir="auto" className="opacity-90">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p dir="auto" className="mt-5 text-[11px] opacity-60" style={mono}>
              {copy.t('wall.cards', { n: peopleCount })}
            </p>

            {report.phase === 'error' && (
              <p
                role="alert"
                dir="auto"
                className="mt-5 rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--slide-panel)' }}
              >
                {report.message}
              </p>
            )}

            {/*
              Said before the button, not after it, and not only in the policy.
              This is the single place in the product where a reader chooses to
              send their group's real names, and the other people it concerns
              are not here to be asked. A disclosure that arrives after the
              unlock is not a disclosure, it is an apology.
            */}
            <p dir="auto" className="mt-5 text-[11px] leading-relaxed opacity-55" style={mono}>
              {copy.t('wall.names')}
            </p>

            {/*
              A report opened from this device has no chat behind it, so there
              is nothing Reg could read. Said plainly instead of a button that
              would do nothing.
            */}
            {!canWrite && (
              <p dir="auto" className="mt-6 text-[14.5px] leading-relaxed opacity-85">
                {copy.t('wall.opened')}
              </p>
            )}

            {canWrite && (
              <motion.div whileTap={{ scale: 0.98 }} className="mt-7">
                <DeckButton onClick={onUnlock} disabled={previewing}>
                  {copy.t('wall.unlock')}
                </DeckButton>
              </motion.div>
            )}

            {/*
              The free story, as the smaller option under the real one. Gone
              once it has been written: the story itself is above by then, and
              there is nothing left to try.
            */}
            {canWrite && !memory && (
              <div className="mt-5">
                {previewing ? (
                  <ReportProgress
                    phase="preview"
                    messages={stats.totalMessages}
                    people={peopleCount}
                  />
                ) : (
                  <>
                    <DeckButton onClick={onPreview} variant="ghost">
                      {copy.t('wall.tryFree')}
                    </DeckButton>
                    <p
                      dir="auto"
                      className="mt-3 text-[11px] leading-relaxed opacity-55"
                      style={mono}
                    >
                      {copy.t('wall.freeNote')}{' '}
                      <button
                        type="button"
                        onClick={() => setShowSample((v) => !v)}
                        className="underline underline-offset-4"
                        style={{ color: 'var(--slide-accent)' }}
                      >
                        {showSample ? copy.t('share.close') : copy.t('ai.inspect')}
                      </button>
                    </p>

                    {showSample && (
                      <div
                        className="yap-quiet-scroll mt-3 max-h-40 overflow-y-auto rounded-xl p-4"
                        style={{ background: 'var(--slide-panel)' }}
                      >
                        {sample!().map((m, i) => (
                          <p
                            key={i}
                            dir="auto"
                            className="text-[11px] leading-relaxed opacity-70"
                            style={mono}
                          >
                            <span style={{ color: 'var(--slide-accent)' }}>{m.sender}</span>:{' '}
                            {m.text}
                          </p>
                        ))}
                      </div>
                    )}

                    {preview.phase === 'error' && (
                      <p
                        role="alert"
                        dir="auto"
                        className="mt-3 rounded-xl px-4 py-3 text-sm"
                        style={{ background: 'var(--slide-panel)' }}
                      >
                        {preview.message}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/*
              Stated plainly while it is true. This is a mock till: no card, no
              charge. A free unlock that looks like a purchase is the kind of
              thing people screenshot for the wrong reasons.
            */}
            <p dir="auto" className="mt-5 text-[11px] leading-relaxed opacity-55" style={mono}>
              {copy.t('wall.noPayment')}
            </p>

            {/*
              The terms have to be reachable from the till rather than only from
              the landing footer, because this is the screen where somebody
              agrees to them. Every link opens in a new tab: the whole product
              is a single page holding an analysis that was never written down
              anywhere, and navigating this tab away would throw it out.
            */}
            <p className="mt-3 text-[11px] leading-relaxed opacity-40" style={mono}>
              {(
                [
                  ['/terms', 'wall.terms'],
                  ['/refunds', 'wall.refunds'],
                  ['/privacy', 'wall.privacy'],
                ] as const
              ).map(([href, key], i) => (
                <span key={href}>
                  {i > 0 && ' · '}
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                    {copy.t(key)}
                  </a>
                </span>
              ))}
            </p>
          </>
        )}
      </div>
    </Slide>
  );
}
