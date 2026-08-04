'use client';

import { useState } from 'react';
import { formatNumber, shortName } from '@/lib/format';
import type { Analysis } from '@/lib/useAnalyzer';
import { DeckButton, Eyebrow, Headline, Punchline, Slide, type Backdrop } from './Shell';

/** Closes on the same lime the deck opened on. */
export const FINAL_BACKDROP: Backdrop = 'lime';

export function FinalSlide({
  analysis,
  onRestart,
}: {
  analysis: Analysis;
  onRestart: () => void;
}) {
  const { stats } = analysis;
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch('/api/share-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: stats.groupName,
          spanLabel: stats.span.label,
          totalMessages: stats.totalMessages,
          topTalker: stats.people[0]
            ? { name: shortName(stats.people[0].name), share: stats.people[0].share }
            : null,
          nightOwl: stats.awards.nightOwl ? shortName(stats.awards.nightOwl) : null,
          topEmoji: stats.topEmoji[0]?.value ?? null,
          language: stats.language,
        }),
      });

      if (!response.ok) throw new Error('render failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stats.groupName ?? 'chat'}-yapped.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not build the image. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Slide backdrop={FINAL_BACKDROP}>
      <Eyebrow>Group verdict</Eyebrow>
      <Headline>Send it to the group</Headline>
      <Punchline>
        {formatNumber(stats.totalMessages, stats.language)} messages, {stats.span.label}, and
        somehow nobody has left yet. That&apos;s love, technically.
      </Punchline>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <DeckButton onClick={() => void download()} disabled={downloading}>
          {downloading ? 'Building your card…' : 'Download share card'}
        </DeckButton>
        <DeckButton onClick={onRestart} variant="ghost">
          Try another chat
        </DeckButton>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--slide-panel)' }}
        >
          {error}
        </p>
      )}

      <p
        className="mt-7 text-[11px] leading-relaxed opacity-60"
        style={{ fontFamily: 'var(--yap-mono)' }}
      >
        Your chat was never uploaded. Close this tab and it is gone.
      </p>
    </Slide>
  );
}
