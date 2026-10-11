'use client';

import { useMemo } from 'react';
import { computeStats, parseChat } from '@wrapped/core';
import { DEV_DECK, devExport } from '@/lib/devDeck';
import type { ReportLanguage } from '@/lib/languages';
import { briefFromSaved, SAVED_REPORT_VERSION, type SavedReport } from '@/lib/savedReports';
import { Deck } from '@/components/Deck';
import { slidesFor } from '@/components/cards/slides';

/**
 * The written deck, played through the real `Deck` with no model and no key.
 *
 * Mounted the way a report opened from this device's storage is: statistics
 * computed from a synthetic export, the written slides handed over already
 * finished, no chat behind them. The deck opens on the first paid slide so the
 * thing being looked at is the first thing on screen.
 */
export function DevDeck({
  language = 'en',
  from = 'paid',
}: {
  language?: ReportLanguage;
  /** Where to open: on the first written slide, or at the very start. */
  from?: 'paid' | 'start';
}) {
  const saved = useMemo<SavedReport>(() => {
    const parsed = parseChat(devExport());
    const stats = computeStats(parsed, { fileName: 'WhatsApp Chat with Famboys.txt' });
    return {
      id: 'dev',
      version: SAVED_REPORT_VERSION,
      savedAt: new Date().toISOString(),
      fileName: 'WhatsApp Chat with Famboys.txt',
      stats,
      brief: { language, kind: 'Friends group', tone: 'roast', notes: '' },
      deck: DEV_DECK,
      preview: null,
    };
  }, [language]);

  // The free slides, then the wall, then the first written one.
  const firstPaid = slidesFor(saved.stats).length + 1;

  return (
    <Deck
      stats={saved.stats}
      analysis={null}
      // Reg stands in for the group photo, so the drifting photo layer under
      // the cover, the loud day and the closer is exercised too.
      brief={{
        ...briefFromSaved(saved),
        groupPhotos: { opener: '/reg.png', chaos: '/reg.png', verdict: '/reg.png' },
      }}
      saved={saved}
      onRestart={() => window.location.reload()}
      startAt={from === 'start' ? 0 : firstPaid}
    />
  );
}
