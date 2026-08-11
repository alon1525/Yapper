import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { looksLikeLineExport, parseLineExport } from '../src/parse/line';
import type { ParseResult } from '../src/types';
import {
  AMBIGUOUS_DMY,
  ANDROID_BASIC,
  ATTACHMENTS,
  CRLF,
  IOS_BASIC,
  MULTILINE,
  SYSTEM_LINES,
} from './fixtures';

/**
 * Same check as the WhatsApp suite, with the one bucket LINE adds: a date
 * heading opens a day and belongs to no message, so it is counted rather than
 * folded into whichever message happens to sit under it.
 */
function expectAllLinesAccountedFor(result: ParseResult, raw: string) {
  const total = raw.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').length;
  const d = result.diagnostics;
  expect(d.totalLines).toBe(total);
  expect(d.headerLines + d.continuationLines + d.orphanLines + (d.dateHeadingLines ?? 0)).toBe(
    total,
  );
}

/** Android/iOS LINE, English UI, 24-hour clock. */
const LINE_BASIC = [
  '[LINE] Chat history with Pizza Tonight?',
  'Saved on: 2024/01/15 10:30',
  '',
  '2024/01/15(Mon)',
  '10:30\tBagel\tsomeone put this chat through Yapped',
  '10:31\tGinger\talready doing it',
  '',
  '2024/03/22(Fri)',
  '00:12\tBagel\twait no it will show how much I talk',
  '00:13\tGinger\ttoo late',
].join('\n');

/** Japanese UI: localised weekday, localised placeholders, localised notices. */
const LINE_JAPANESE = [
  '[LINE] ピザ会のトーク履歴',
  '保存日時：2024/01/15 10:30',
  '',
  '2024/01/15(月)',
  '10:30\t中村\tおはよう',
  '10:31\t田中\t[スタンプ]',
  '10:32\t中村\tメッセージの送信を取り消しました',
  '10:33\t田中\t[写真]',
].join('\n');

describe('detecting a LINE export', () => {
  it('recognises one with its banner', () => {
    expect(looksLikeLineExport(LINE_BASIC)).toBe(true);
    expect(looksLikeLineExport(LINE_JAPANESE)).toBe(true);
  });

  it('recognises one that has lost its banner', () => {
    const trimmed = LINE_BASIC.split('\n').slice(3).join('\n');
    expect(trimmed.startsWith('2024/01/15')).toBe(true);
    expect(looksLikeLineExport(trimmed)).toBe(true);
  });

  /* The expensive direction. A false positive here does not degrade a LINE
     import — it silently sends every WhatsApp export to the wrong parser. */
  it.each([
    ['android', ANDROID_BASIC],
    ['ios', IOS_BASIC],
    ['multiline', MULTILINE],
    ['system lines', SYSTEM_LINES],
    ['attachments', ATTACHMENTS],
    ['ambiguous dates', AMBIGUOUS_DMY],
    ['crlf', CRLF],
  ])('never fires on a WhatsApp export (%s)', (_name, raw) => {
    expect(looksLikeLineExport(raw)).toBe(false);
  });

  it('routes a LINE file through parseChat without being asked', () => {
    const r = parseChat(LINE_BASIC);
    expect(r.format).toBe('line');
    expect(r.messages).toHaveLength(4);
  });
});

describe('parsing a LINE export', () => {
  it('reads the columns, and the day from the heading above them', () => {
    const r = parseLineExport(LINE_BASIC);
    expect(r.messages).toHaveLength(4);

    const first = r.messages[0]!;
    expect(first.sender).toBe('Bagel');
    expect(first.body).toBe('someone put this chat through Yapped');
    expect([first.localYear, first.localMonth, first.localDay]).toEqual([2024, 1, 15]);
    expect([first.localHour, first.localMinute]).toEqual([10, 30]);

    const later = r.messages[2]!;
    expect([later.localYear, later.localMonth, later.localDay]).toEqual([2024, 3, 22]);
    expect(later.localHour).toBe(0);
  });

  it('takes the weekday from the date, not from the word beside it', () => {
    // 2024/01/15 was a Monday and 2024/03/22 a Friday. The heading says so in
    // whatever language the phone was set to; the parse must not care.
    const r = parseLineExport(LINE_BASIC);
    expect(r.messages[0]!.localWeekday).toBe(1);
    expect(r.messages[2]!.localWeekday).toBe(5);
    expect(parseLineExport(LINE_JAPANESE).messages[0]!.localWeekday).toBe(1);
  });

  it('never guesses at day/month order, because there is nothing to guess', () => {
    const r = parseLineExport(LINE_BASIC);
    expect(r.dateOrderConfidence).toBe('certain');
    expect(r.warnings).toHaveLength(0);
  });

  it('accounts for every line', () => {
    expectAllLinesAccountedFor(parseLineExport(LINE_BASIC), LINE_BASIC);
    expectAllLinesAccountedFor(parseLineExport(LINE_JAPANESE), LINE_JAPANESE);
  });

  it('ranks participants by how much they said', () => {
    const r = parseLineExport(LINE_BASIC);
    expect(r.participants).toEqual(['Bagel', 'Ginger']);
  });

  it('reads the 12-hour clock US phones write', () => {
    const raw = [
      '2024/01/15(Mon)',
      '12:05 AM\tBagel\tstill awake',
      '12:05 PM\tGinger\tand now it is noon',
      '1:30 PM\tBagel\tafternoon',
    ].join('\n');
    const hours = parseLineExport(raw).messages.map((m) => m.localHour);
    expect(hours).toEqual([0, 12, 13]);
  });

  it('classifies placeholders in either language', () => {
    const r = parseLineExport(LINE_JAPANESE);
    const [, sticker, unsent, photo] = r.messages;
    expect(sticker!.kind).toBe('attachment');
    expect(sticker!.attachmentType).toBe('sticker');
    expect(unsent!.kind).toBe('deleted');
    expect(photo!.attachmentType).toBe('image');

    const english = parseLineExport(
      ['2024/01/15(Mon)', '10:30\tBagel\t[Photo]', '10:31\tBagel\t[Voice message]'].join('\n'),
    );
    expect(english.messages.map((m) => m.attachmentType)).toEqual(['image', 'audio']);
  });

  it('treats joins, leaves and calls as notices rather than as things people said', () => {
    const raw = [
      '2024/01/15(Mon)',
      '10:30\tBagel\tGinger joined the group',
      '10:31\tBagel\t☎ Call time 2:03',
      '10:32\tMitzi\tactual message',
      '10:33\t中村\t田中がグループに参加しました',
    ].join('\n');
    const r = parseLineExport(raw);
    expect(r.messages.map((m) => m.kind)).toEqual(['system', 'system', 'text', 'system']);
    // A notice belongs to nobody: counting it would make the person who
    // happened to be in the sender column the chattiest member of the group.
    expect(r.messages.filter((m) => m.kind === 'system').every((m) => m.sender === null)).toBe(true);
    expect(r.participants).toEqual(['Mitzi']);
  });

  it('folds a wrapped message and drops the indentation LINE adds', () => {
    const raw = [
      '2024/01/15(Mon)',
      '10:30\tBagel\there is my manifesto',
      '\t\tsecond line',
      '\t\tthird line',
      '10:31\tGinger\tno',
    ].join('\n');
    const r = parseLineExport(raw);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]!.body).toBe('here is my manifesto\nsecond line\nthird line');
    expect(r.messages[0]!.lineCount).toBe(3);
    expectAllLinesAccountedFor(r, raw);
  });

  it('keeps a tab that is inside the message rather than around it', () => {
    const raw = ['2024/01/15(Mon)', '10:30\tBagel\tcolumn one\tcolumn two'].join('\n');
    expect(parseLineExport(raw).messages[0]!.body).toBe('column one\tcolumn two');
  });

  it('does not let a blank line before the next day trail into a message', () => {
    const raw = ['2024/01/15(Mon)', '10:30\tBagel\tlast word', '', '2024/01/16(Tue)', '09:00\tGinger\tmorning'].join(
      '\n',
    );
    const r = parseLineExport(raw);
    expect(r.messages[0]!.body).toBe('last word');
    expectAllLinesAccountedFor(r, raw);
  });

  it('says so when the file is LINE-shaped but empty of messages', () => {
    const r = parseLineExport('[LINE] Chat history with nobody\nSaved on: 2024/01/15 10:30\n');
    expect(r.messages).toHaveLength(0);
    expect(r.warnings[0]?.code).toBe('no-messages');
  });

  it('survives CRLF, which is what a Windows LINE export is saved as', () => {
    const r = parseLineExport(LINE_BASIC.replace(/\n/g, '\r\n'));
    expect(r.messages).toHaveLength(4);
    expect(r.messages[0]!.body).toBe('someone put this chat through Yapped');
  });
});
