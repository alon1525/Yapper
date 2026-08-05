import { describe, expect, it } from 'vitest';
import {
  applyAliases,
  isUnsavedSender,
  roster,
  suggestMerges,
  unsavedParticipants,
} from '../src/parse/identity';
import { parseChat } from '../src/parse/parse';

const CHAT = [
  '4/15/17, 12:43 AM - +972 58-666-8048: כל הכבוד',
  '4/15/17, 12:44 AM - Yanku: מה קורה',
  '4/15/17, 12:45 AM - +972 58-666-8048: שום דבר',
  '4/15/17, 12:46 AM - עומר סמורו: יאללה',
].join('\n');

describe('unsaved contacts', () => {
  it('recognises a display name that is only a phone number', () => {
    expect(isUnsavedSender('+972 58-666-8048')).toBe(true);
    expect(isUnsavedSender('+1 (555) 123-4567')).toBe(true);
    expect(isUnsavedSender('972526499694')).toBe(true);
  });

  it('never mistakes a real name for a number', () => {
    // The cost of a false positive is renaming somebody who was named all
    // along, so a single letter anywhere disqualifies. Real display names in
    // the test export include "Yanku" and "בןבןבןבן דוד".
    for (const name of ['Yanku', 'בבלי', 'Turtle', 'Yanku2', 'שחר דק', 'A1B2C3D4E5F6G7']) {
      expect(isUnsavedSender(name)).toBe(false);
    }
  });

  it('ignores short digit strings that are not phone numbers', () => {
    expect(isUnsavedSender('123')).toBe(false);
    expect(isUnsavedSender('2024')).toBe(false);
  });

  it('finds the unsaved participants in a parsed chat', () => {
    expect(unsavedParticipants(parseChat(CHAT))).toEqual(['+972 58-666-8048']);
  });

  it('renames senders and participants together', () => {
    const parsed = parseChat(CHAT);
    const renamed = applyAliases(parsed, { '+972 58-666-8048': 'נדב' });

    expect(renamed.participants).toContain('נדב');
    expect(renamed.participants).not.toContain('+972 58-666-8048');
    expect(renamed.messages.filter((m) => m.sender === 'נדב')).toHaveLength(2);
    expect(renamed.messages.some((m) => m.sender === '+972 58-666-8048')).toBe(false);
  });

  it('leaves the number alone when the box was left empty', () => {
    const parsed = parseChat(CHAT);
    const renamed = applyAliases(parsed, { '+972 58-666-8048': '   ' });
    expect(renamed.participants).toContain('+972 58-666-8048');
  });

  it('preserves participant ordering, which is by message count', () => {
    const parsed = parseChat(CHAT);
    const before = parsed.participants.indexOf('+972 58-666-8048');
    const renamed = applyAliases(parsed, { '+972 58-666-8048': 'נדב' });
    expect(renamed.participants.indexOf('נדב')).toBe(before);
  });

  it('does not touch the original parse result', () => {
    const parsed = parseChat(CHAT);
    applyAliases(parsed, { '+972 58-666-8048': 'נדב' });
    expect(parsed.participants).toContain('+972 58-666-8048');
  });
});

/* A contact renamed partway through, which is the ordinary case in a group that
   has run for years — and the reason a leaderboard can be quietly wrong. */
const RENAMED = [
  '15/04/17, 00:43 - תמיר: מה קורה',
  '15/04/17, 00:44 - תמיר: יאללה',
  '15/04/17, 00:45 - בבלי: כלום',
  '20/06/19, 10:00 - תמיר הגבר: חזרתי',
  '20/06/19, 10:01 - תמיר הגבר: מישהו פה',
  '20/06/19, 10:02 - תמיר הגבר: הלו',
  '20/06/19, 10:03 - בבלי: אה',
].join('\n');

describe('roster', () => {
  it('counts each participant and dates their first and last message', () => {
    const rows = roster(parseChat(RENAMED));
    const tamir = rows.find((r) => r.name === 'תמיר')!;

    expect(tamir.messages).toBe(2);
    expect(tamir.firstDay).toBe('2017-04-15');
    expect(tamir.lastDay).toBe('2017-04-15');
    expect(tamir.unsaved).toBe(false);
  });

  it('flags the participants WhatsApp only had a number for', () => {
    const rows = roster(parseChat(CHAT));
    expect(rows.find((r) => r.name === '+972 58-666-8048')!.unsaved).toBe(true);
    expect(rows.find((r) => r.name === 'Yanku')!.unsaved).toBe(false);
  });
});

describe('merge suggestions', () => {
  it('spots a contact that was renamed, and says when', () => {
    expect(suggestMerges(parseChat(RENAMED))).toEqual([
      { from: 'תמיר', into: 'תמיר הגבר', why: 'renamed 2019' },
    ]);
  });

  it('never suggests merging two unsaved numbers', () => {
    const chat = [
      '15/04/17, 00:43 - +972 58-666-8048: א',
      '15/04/17, 00:44 - +972 52-447-1180: ב',
    ].join('\n');
    expect(suggestMerges(parseChat(chat))).toEqual([]);
  });

  it('leaves unrelated names alone', () => {
    expect(suggestMerges(parseChat(CHAT))).toEqual([]);
  });

  it('folds the merged person into one row rather than two', () => {
    const parsed = parseChat(RENAMED);
    const merged = applyAliases(parsed, { תמיר: 'תמיר הגבר' });

    expect(merged.participants.filter((p) => p === 'תמיר הגבר')).toHaveLength(1);
    expect(merged.messages.filter((m) => m.sender === 'תמיר הגבר')).toHaveLength(5);
  });
});
