'use client';

import { motion } from 'framer-motion';
import type { PremiumState } from '@/lib/usePremium';
import { GROUP_SLOT_BACKDROP } from './photos';
import { DeckButton, Eyebrow, RegProse, Slide, type Backdrop } from './Shell';

/** The design's own closing frame: forest green, Reg, an amber button. */
export const PAYWALL_BACKDROP: Backdrop = GROUP_SLOT_BACKDROP.paywall;

/**
 * The wall.
 *
 * It arrives directly after the one free AI memory, which is the only place it
 * can work: the reader has just been shown that the thing is good, and the ask
 * is for more of exactly that. Listing what is inside beats describing it —
 * "a card for every person in this chat" is a promise the reader can already
 * picture, because they know who is in the chat.
 */

/**
 * The preview is opt-in, so plenty of readers arrive here having swiped
 * straight past it. Promising "more of what you just read" to someone who read
 * nothing is a claim about their own experience that they know is false — the
 * fastest way to lose them. The copy asks what actually happened instead.
 */
function included(previewSeen: boolean): string[] {
  return [
    previewSeen
      ? 'Five more moments, written up like the one you just read'
      : 'Five moments from your chat, written up as stories',
    'A character card for everyone in this chat — including the quiet ones',
    'The full awards ceremony, one winner each',
    'Your years, one line at a time',
  ];
}

export function PaywallSlide({
  state,
  onUnlock,
  peopleCount,
  previewSeen,
}: {
  state: PremiumState;
  onUnlock: () => void;
  peopleCount: number;
  previewSeen: boolean;
}) {
  const busy = state.phase === 'unlocking' || state.phase === 'generating';
  const INCLUDED = included(previewSeen);

  return (
    <Slide backdrop={PAYWALL_BACKDROP} photo="paywall">
      {/* The warm bloom the design puts behind Reg on this exact frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 60% at 50% 0%, rgb(245 179 36 / 0.20), transparent 70%)',
        }}
      />

      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reg.png" alt="" className="mb-4 block h-16 w-16 rounded-full" />

        <Eyebrow>{previewSeen ? 'That was the preview' : 'One story was free'}</Eyebrow>

        <RegProse>
          Reg wrote {peopleCount === 1 ? 'a lot' : 'a great deal'} more about you.
        </RegProse>

        <ul className="mt-6 flex flex-col gap-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[14.5px] leading-relaxed">
              <span
                className="mt-[3px] shrink-0 text-[11px]"
                style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
              >
                ✦
              </span>
              <span className="opacity-90">{item}</span>
            </li>
          ))}
        </ul>

        <p
          className="mt-5 text-[11px] opacity-60"
          style={{ fontFamily: 'var(--yap-mono)' }}
        >
          {peopleCount} people in this chat. {peopleCount} cards.
        </p>

        {state.phase === 'error' && (
          <p
            role="alert"
            className="mt-5 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--slide-panel)' }}
          >
            {state.message}
          </p>
        )}

        <motion.div whileTap={{ scale: 0.98 }} className="mt-7">
          <DeckButton onClick={onUnlock} disabled={busy}>
            {state.phase === 'unlocking'
              ? 'Unlocking…'
              : state.phase === 'generating'
                ? 'Writing your report…'
                : 'Unlock the full roast'}
          </DeckButton>
        </motion.div>

        {/*
          Stated plainly while it is true. This is a mock till: no card, no
          charge. Saying so is not modesty — a free unlock that looks like a
          purchase is the kind of thing people screenshot for the wrong reasons.
        */}
        <p
          className="mt-4 text-[11px] leading-relaxed opacity-55"
          style={{ fontFamily: 'var(--yap-mono)' }}
        >
          No payment is set up yet — this unlock is free while the product is being built.
        </p>
      </div>
    </Slide>
  );
}
