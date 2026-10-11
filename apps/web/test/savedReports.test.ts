import { describe, expect, it } from 'vitest';
import { computeStats, parseChat } from '@wrapped/core';
import { emptyBrief } from '@/lib/brief';
import { briefFromSaved, buildSavedReport, summarize } from '@/lib/savedReports';

/**
 * The record kept on the reader's device. IndexedDB itself is the browser's;
 * what is tested here is the shape that goes into it — above all that nothing
 * goes in that should not.
 */

const CHAT = [
  '12/01/2023, 20:00 - Daniel: tomorrow we start seriously',
  '12/01/2023, 20:01 - Ron: you said that in november',
  '12/01/2023, 20:02 - Daniel: this time is different',
  '13/01/2023, 09:00 - Avi: hahaha',
].join('\n');

function setup() {
  const parsed = parseChat(CHAT);
  return { stats: computeStats(parsed) };
}

describe('a report kept on this device', () => {
  it('leaves the photos out by construction', () => {
    const { stats } = setup();
    const brief = {
      ...emptyBrief(),
      language: 'he' as const,
      kind: 'Friends group',
      notes: 'Daniel never shows up',
      photos: { Daniel: 'blob:http://localhost/abc' },
      groupPhotos: { opener: 'blob:http://localhost/def' },
    };

    const record = buildSavedReport({ stats, brief, fileName: 'chat.txt', deck: null, preview: null });

    expect(record.brief).toEqual({
      language: 'he',
      kind: 'Friends group',
      tone: 'roast',
      notes: 'Daniel never shows up',
    });
    expect(JSON.stringify(record)).not.toContain('blob:');
    expect(record.version).toBe(1);
    expect(record.id).toBeTruthy();
  });

  it('reuses an id so a second save updates rather than duplicates', () => {
    const { stats } = setup();
    const first = buildSavedReport({ stats, brief: emptyBrief(), fileName: 'a', deck: null, preview: null });
    const second = buildSavedReport({
      stats,
      brief: emptyBrief(),
      fileName: 'a',
      deck: null,
      preview: null,
      id: first.id,
    });
    expect(second.id).toBe(first.id);
  });

  it('summarises what the front page needs and nothing heavy', () => {
    const { stats } = setup();
    const record = buildSavedReport({
      stats,
      brief: emptyBrief(),
      fileName: 'chat.txt',
      deck: null,
      preview: {
        memories: [{ title: 'x', story: 'y', cast: [] }],
        narrative: '',
        award: { name: 'a', winner: 'b', reason: 'c' },
      },
      now: new Date('2026-10-06T12:00:00Z'),
    });

    const summary = summarize(record);
    expect(summary).toMatchObject({
      id: record.id,
      savedAt: '2026-10-06T12:00:00.000Z',
      totalMessages: 4,
      people: 3,
      hasDeck: false,
      hasPreview: true,
    });
    expect('stats' in summary).toBe(false);
  });

  it('reopens with a brief the deck can read, faces falling back to animals', () => {
    const { stats } = setup();
    const record = buildSavedReport({ stats, brief: emptyBrief(), fileName: 'a', deck: null, preview: null });
    const brief = briefFromSaved(record);
    expect(brief.photos).toEqual({});
    expect(brief.groupPhotos).toEqual({});
    expect(brief.language).toBe('en');
  });
});
