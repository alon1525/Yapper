import { describe, expect, it } from 'vitest';
import { applyAliases, isUnsavedSender, unsavedParticipants } from '../src/parse/identity';
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
