'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCopy, type CopyKey } from '@/lib/copy';
import { num } from '@/lib/localFormat';
import { ScanFilm } from '../yapped/ScanFilm';

/**
 * What the reader looks at while the report is written.
 *
 * The whole run is two model calls with verification between them — a minute
 * or two on a real chat — and until this existed the only sign of life was a
 * button whose label changed four times. For long stretches nothing on the
 * screen moved, and a screen where nothing moves is a screen that has crashed.
 *
 * So three things move. The film of the chat going past under a scanner, the
 * same one the onboarding showed while the file was read, because it is the
 * same promise: the chat is being read, here, now. A bar that creeps rather
 * than fills, since the server reports nothing back until it is done. And a
 * line under the current step that changes every few seconds and says, in
 * Reg's voice, what he is doing — not because any of those lines is tied to a
 * real sub-step, but because a wait with a changing caption is a wait with
 * somebody in it.
 */

export type ProgressPhase = 'unlocking' | 'investigating' | 'verifying' | 'writing' | 'preview';

const STEPS: { phase: ProgressPhase; label: CopyKey }[] = [
  { phase: 'unlocking', label: 'progress.stepUnlock' },
  { phase: 'investigating', label: 'progress.stepRead' },
  { phase: 'verifying', label: 'progress.stepCheck' },
  { phase: 'writing', label: 'progress.stepWrite' },
];

const LINES: Record<ProgressPhase, CopyKey[]> = {
  unlocking: ['progress.unlock1'],
  investigating: [
    'progress.read1',
    'progress.read2',
    'progress.read3',
    'progress.read4',
    'progress.read5',
    'progress.read6',
    'progress.read7',
    'progress.read8',
  ],
  verifying: ['progress.check1', 'progress.check2', 'progress.check3', 'progress.check4'],
  writing: [
    'progress.write1',
    'progress.write2',
    'progress.write3',
    'progress.write4',
    'progress.write5',
    'progress.write6',
    'progress.write7',
  ],
  preview: ['progress.preview1', 'progress.preview2', 'progress.preview3'],
};

/**
 * Where the bar sits when a phase begins, where it may creep to while the
 * phase lasts, and how fast it gets there (seconds to roughly two thirds of
 * the way). The two model calls own most of the bar because they own most of
 * the time; the verification between them is local and takes a second.
 *
 * The bar never reaches the end of its range, so a slow model call shows a bar
 * that is still, visibly, moving — and never a full bar over a page that has
 * not changed, which is the one thing worse than no bar at all.
 */
const RANGE: Record<ProgressPhase, { from: number; to: number; tau: number }> = {
  unlocking: { from: 0.02, to: 0.08, tau: 3 },
  investigating: { from: 0.08, to: 0.56, tau: 45 },
  verifying: { from: 0.56, to: 0.64, tau: 4 },
  writing: { from: 0.64, to: 0.97, tau: 40 },
  preview: { from: 0.05, to: 0.92, tau: 25 },
};

/** How long each caption stays before the next one. */
const LINE_MS = 2800;

/** Cycles through a phase's captions, starting over when the phase changes. */
function useRotatingLine(phase: ProgressPhase): CopyKey {
  const [index, setIndex] = useState(0);
  const keys = LINES[phase];

  useEffect(() => {
    setIndex(0);
    if (keys.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % keys.length), LINE_MS);
    return () => clearInterval(id);
  }, [phase, keys.length]);

  return keys[index % keys.length]!;
}

/** Seconds since the phase began, ticking four times a second. */
function useElapsed(phase: ProgressPhase): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [phase]);

  return elapsed;
}

function Caption({ line, params }: { line: CopyKey; params: Record<string, string | number> }) {
  const copy = useCopy();
  return (
    <motion.p
      key={line}
      dir="auto"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="text-[12.5px] leading-snug opacity-80"
      style={{ fontFamily: 'var(--yap-mono)' }}
    >
      {copy.t(line, params)}
    </motion.p>
  );
}

export function ReportProgress({
  phase,
  messages,
  people,
}: {
  phase: ProgressPhase;
  /** For the captions that quote the size of the job back at the reader. */
  messages: number;
  people: number;
}) {
  const copy = useCopy();
  const line = useRotatingLine(phase);
  const elapsed = useElapsed(phase);

  const { from, to, tau } = RANGE[phase];
  const fraction = from + (to - from) * (1 - Math.exp(-elapsed / tau));
  const stepIndex = STEPS.findIndex((s) => s.phase === phase);
  const params = { n: num(copy, messages), people: num(copy, people) };

  // The free story is one call and one caption: the checklist would be a list
  // of one, and the film is shortened so the slide's buttons stay in reach.
  const compact = phase === 'preview';

  return (
    <div aria-live="polite" className="mt-5">
      <div
        dir="ltr"
        className="h-[5px] overflow-hidden rounded-full"
        style={{ background: 'var(--slide-panel)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(fraction * 1000) / 10}%`,
            background: 'var(--slide-accent)',
            transition: 'width .3s linear',
          }}
        />
      </div>

      <ScanFilm
        height={compact ? 'clamp(72px, 11vh, 96px)' : 'clamp(96px, 16vh, 132px)'}
        marginTop={14}
      />

      {compact ? (
        <div className="mt-4">
          <Caption line={line} params={params} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {STEPS.map((step, k) => {
            const done = k < stepIndex;
            const current = k === stepIndex;
            return (
              <div key={step.phase}>
                <div
                  className="flex items-center gap-3 text-[14.5px] leading-tight"
                  style={{
                    opacity: done || current ? 1 : 0.45,
                    color: current ? 'var(--slide-accent)' : undefined,
                    transition: 'opacity .3s ease, color .3s ease',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="w-4 shrink-0 text-[13px]"
                    style={{ fontFamily: 'var(--yap-mono)' }}
                  >
                    {done ? '✓' : current ? '▸' : '·'}
                  </span>
                  <span dir="auto">{copy.t(step.label)}</span>
                </div>
                {current && (
                  <div className="mt-1.5 ml-7">
                    <Caption line={line} params={params} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p
        dir="auto"
        className="mt-5 text-[11px] leading-relaxed opacity-55"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        {copy.t(compact ? 'progress.shortWait' : 'progress.longWait')}
      </p>
    </div>
  );
}
