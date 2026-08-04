'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { buildPreviewPayload } from '@/lib/aiPayload';
import type { PreviewState } from '@/lib/useAiPreview';
import type { Analysis } from '@/lib/useAnalyzer';
import { DeckButton, Eyebrow, Panel, RegProse, Slide, type Backdrop } from './Shell';

/** Reg's own voice, so it is the one slide set on paper rather than in colour. */
export const AI_BACKDROP: Backdrop = 'paper';

/**
 * The consent gate.
 *
 * Everything before this slide happened on the device. This is the only point
 * where anything leaves, and it never happens automatically — the user has to
 * press the button. The panel below the button shows the actual anonymised
 * lines that would be sent, because a privacy promise you can inspect is worth
 * more than one you have to believe.
 *
 * The request state belongs to the deck rather than to this component: a slide
 * unmounts when you swipe past it, and state held here would mean swiping back
 * pays for the same story twice.
 */
export function AiSlide({
  analysis,
  state,
  onRun,
}: {
  analysis: Analysis;
  state: PreviewState;
  onRun: () => void;
}) {
  const [showSample, setShowSample] = useState(false);

  const sample = () => {
    const { payload } = buildPreviewPayload(analysis);
    return (payload.moments[0]?.messages ?? []).slice(0, 6);
  };

  if (state.phase === 'done') {
    const { preview } = state;
    const memory = preview.memories[0];
    return (
      <Slide backdrop={AI_BACKDROP}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/reg.png" alt="" className="block h-6 w-6 rounded-full" />
          <Eyebrow>Reg&apos;s account of that night</Eyebrow>
        </div>

        {memory && (
          <>
            {/*
              Every string below is written by the model in the chat's own
              language, so each carries dir="auto" — the same rule the rest of
              the deck follows. Without it a Hebrew paragraph renders inside an
              LTR block and its neutral characters (the closing full stop, an
              em dash, a trailing emoji) migrate to the wrong edge.
            */}
            <RegProse>&ldquo;{memory.title}&rdquo;</RegProse>
            <motion.p
              dir="auto"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-4 text-[14.5px] leading-[1.6] opacity-80"
            >
              {memory.story}
            </motion.p>
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6"
        >
          <Panel>
            <p
              dir="auto"
              className="text-[10px] tracking-[0.18em] uppercase"
              style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
            >
              {preview.award.name}
            </p>
            <p dir="auto" className="mt-1.5 text-xl leading-tight" style={{ fontFamily: 'var(--yap-serif)' }}>
              {preview.award.winner}
            </p>
            <p dir="auto" className="mt-1 text-sm leading-relaxed opacity-75">
              {preview.award.reason}
            </p>
          </Panel>
        </motion.div>

        <motion.p
          dir="auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-5 text-[14.5px] leading-relaxed opacity-70 italic"
        >
          {preview.narrative}
        </motion.p>
      </Slide>
    );
  }

  return (
    <Slide backdrop={AI_BACKDROP}>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reg.png" alt="" className="block h-6 w-6 rounded-full" />
        <Eyebrow>One more thing</Eyebrow>
      </div>

      <RegProse>
        Want Reg to write it up <em style={{ color: 'var(--slide-accent)' }}>properly?</em>
      </RegProse>

      <p className="mt-4 text-[14.5px] leading-relaxed opacity-80">
        Everything so far was calculated on your device. To find the moments worth
        remembering, Reg needs to read a few of your conversations — so every name
        WhatsApp knows is replaced with a token first, and mapped back here in your
        browser.
      </p>

      {/*
        Said plainly rather than buried, because it is the one thing the
        redaction genuinely cannot do: an export only reveals display names, and
        groups address each other by nicknames that appear nowhere in that list.
        Verified on a real export — most of this group's members are called
        something in the messages that is not what WhatsApp calls them.
      */}
      <p className="mt-3 text-[13px] leading-relaxed opacity-60">
        What it cannot catch: a nickname your group invented. Those exist only inside
        the messages, so nothing can tell them apart from ordinary words.
      </p>

      <button
        type="button"
        onClick={() => setShowSample((v) => !v)}
        className="mt-4 text-xs underline underline-offset-4"
        style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
      >
        {showSample ? 'Hide' : 'Show me exactly what gets sent'}
      </button>

      {showSample && (
        <div
          className="mt-3 max-h-40 overflow-y-auto rounded-xl p-4"
          style={{ background: 'var(--slide-panel)' }}
        >
          {sample().map((m, i) => (
            <p
              key={i}
              className="text-[11px] leading-relaxed opacity-70"
              style={{ fontFamily: 'var(--yap-mono)' }}
            >
              <span style={{ color: 'var(--slide-accent)' }}>{m.sender}</span>: {m.text}
            </p>
          ))}
        </div>
      )}

      {state.phase === 'error' && (
        <p
          role="alert"
          className="mt-5 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--slide-panel)' }}
        >
          {state.message}
        </p>
      )}

      <div className="mt-7">
        <DeckButton onClick={onRun} disabled={state.phase === 'sending'}>
          {state.phase === 'sending' ? 'Reading your best moments…' : 'Write my story ✦'}
        </DeckButton>
      </div>

      <p
        className="mt-4 text-[11px] opacity-55"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        Nothing is stored. Skip this and the rest of your story still works.
      </p>
    </Slide>
  );
}
