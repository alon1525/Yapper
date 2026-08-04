import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import type { ParseResult } from '../src/types';
import {
  AMBIGUOUS_DMY,
  AMBIGUOUS_MDY,
  ANDROID_BASIC,
  ATTACHMENTS,
  CRLF,
  IOS_BASIC,
  MULTILINE,
  SYSTEM_LINES,
} from './fixtures';

/**
 * The check that actually catches parser bugs. WhatsApp exposes no message
 * count to compare against, so instead we assert that every single line in the
 * file was accounted for as exactly one of header / continuation / orphan.
 */
function expectAllLinesAccountedFor(result: ParseResult, raw: string) {
  const d = result.diagnostics;
  expect(d.headerLines + d.continuationLines + d.orphanLines).toBe(d.totalLines);
  expect(d.orphanLines).toBe(0);

  const expectedLines = raw.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').length;
  expect(d.totalLines).toBe(expectedLines);
}

describe('format detection', () => {
  it('detects Android exports', () => {
    const r = parseChat(ANDROID_BASIC);
    expect(r.format).toBe('android');
    expectAllLinesAccountedFor(r, ANDROID_BASIC);
  });

  it('detects iOS exports through invisible direction marks', () => {
    const r = parseChat(IOS_BASIC);
    expect(r.format).toBe('ios');
    expect(r.messages).toHaveLength(5);
    expectAllLinesAccountedFor(r, IOS_BASIC);
  });

  it('handles CRLF line endings and a trailing newline', () => {
    const r = parseChat(CRLF);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]!.body).toBe('hello');
    expectAllLinesAccountedFor(r, CRLF);
  });

  it('strips direction marks without destroying zero-width-joined emoji', () => {
    // U+200D sits inside the invisible-character block but is load-bearing:
    // stripping it shatters 👨‍💻 into two separate emoji and inflates every
    // emoji statistic downstream.
    const zwj = String.fromCharCode(0x200d);
    const body = `look \u{1F468}${zwj}\u{1F4BB} coding`;
    const r = parseChat(`12/01/2023, 09:00 - Alon: ${body}`);
    expect(r.messages[0]!.body).toBe(body);
    expect(r.messages[0]!.body).toContain(zwj);
  });

  it('reports a clear error when the file is not an export at all', () => {
    const r = parseChat('just some random text\nwith no timestamps');
    expect(r.messages).toHaveLength(0);
    expect(r.warnings[0]!.code).toBe('no-messages');
  });
});

describe('timestamps', () => {
  it('keeps calendar fields independent of the runtime timezone', () => {
    const r = parseChat(ANDROID_BASIC);
    const midnight = r.messages.find((m) => m.body.includes('ask you the same thing'))!;
    // 22/03/2023 at 00:12 — the field values must survive verbatim regardless
    // of where this test runs, which is exactly what breaks Night Owl.
    expect(midnight.localDay).toBe(22);
    expect(midnight.localMonth).toBe(3);
    expect(midnight.localYear).toBe(2023);
    expect(midnight.localHour).toBe(0);
    expect(midnight.localMinute).toBe(12);
  });

  it('normalises 12-hour clocks, including both noon and midnight', () => {
    const r = parseChat(IOS_BASIC);
    const hours = r.messages.map((m) => m.localHour);
    // 9:05 AM, 11:47 PM, 11:48 PM, 12:00 AM, 12:00 PM
    expect(hours).toEqual([9, 23, 23, 0, 12]);
  });

  it('derives weekday from the local triple', () => {
    const r = parseChat(ANDROID_BASIC);
    // 12 Jan 2023 was a Thursday.
    expect(r.messages[0]!.localWeekday).toBe(4);
  });

  it('produces exact gaps for response-time arithmetic', () => {
    const r = parseChat(IOS_BASIC);
    const gapMs = r.messages[2]!.ts.getTime() - r.messages[1]!.ts.getTime();
    expect(gapMs).toBe(58_000);
  });
});

describe('day/month resolution', () => {
  it('is certain when a day above 12 appears', () => {
    const r = parseChat(ANDROID_BASIC);
    expect(r.dateOrder).toBe('DMY');
    expect(r.dateOrderConfidence).toBe('certain');
  });

  it('falls back to chronological monotonicity when every day is <= 12', () => {
    const mdy = parseChat(AMBIGUOUS_MDY);
    expect(mdy.dateOrder).toBe('MDY');
    expect(mdy.dateOrderConfidence).toBe('inferred');

    const dmy = parseChat(AMBIGUOUS_DMY);
    expect(dmy.dateOrder).toBe('DMY');
    expect(dmy.dateOrderConfidence).toBe('inferred');
  });

  it('honours a forced ordering from the caller', () => {
    const r = parseChat(AMBIGUOUS_MDY, { dateOrder: 'DMY' });
    expect(r.dateOrder).toBe('DMY');
    expect(r.messages[0]!.localDay).toBe(1);
    expect(r.messages[0]!.localMonth).toBe(2);
  });

  it('warns when there is genuinely no evidence either way', () => {
    const r = parseChat('01/02/2023, 09:00 - Alon: only one message');
    expect(r.dateOrderConfidence).toBe('assumed');
    expect(r.warnings.some((w) => w.code === 'ambiguous-date-order')).toBe(true);
  });
});

describe('multi-line messages', () => {
  it('folds continuation lines into the preceding message', () => {
    const r = parseChat(MULTILINE);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]!.body).toBe(
      'here is my manifesto\npoint one: everything is fine\n\npoint two: nothing is fine',
    );
    expect(r.messages[0]!.lineCount).toBe(4);
    expectAllLinesAccountedFor(r, MULTILINE);
  });

  it('does not leak continuation text into the next sender', () => {
    const r = parseChat(MULTILINE);
    expect(r.messages[1]!.sender).toBe('Sarah Levi');
    expect(r.messages[1]!.body).toBe('ok');
  });

  it('counts a blank line inside a message rather than dropping it', () => {
    const r = parseChat(MULTILINE);
    expect(r.diagnostics.continuationLines).toBe(3);
  });
});

describe('system messages', () => {
  it('never attributes a system notice to a participant', () => {
    const r = parseChat(SYSTEM_LINES);
    const system = r.messages.filter((m) => m.kind === 'system');
    expect(system).toHaveLength(6);
    expect(system.every((m) => m.sender === null)).toBe(true);
    expectAllLinesAccountedFor(r, SYSTEM_LINES);
  });

  it('keeps system notices out of the participant list', () => {
    const r = parseChat(SYSTEM_LINES);
    expect(r.participants).toEqual(['Alon']);
  });

  it('does not mis-split a system notice that contains a colon', () => {
    const r = parseChat(SYSTEM_LINES);
    const subject = r.messages.find((m) => m.body.includes('Weekend Plans'))!;
    expect(subject.kind).toBe('system');
    expect(subject.sender).toBeNull();
  });

  it('splits the sender on the first colon only', () => {
    const r = parseChat('12/01/2023, 09:00 - Alon: ratio: 3:1 in our favour');
    expect(r.messages[0]!.sender).toBe('Alon');
    expect(r.messages[0]!.body).toBe('ratio: 3:1 in our favour');
  });
});

describe('attachments and deletions', () => {
  it('classifies every placeholder dialect', () => {
    const r = parseChat(ATTACHMENTS);
    const types = r.messages.map((m) => m.attachmentType ?? m.kind);
    expect(types).toEqual([
      'unknown',
      'image',
      'video',
      'audio',
      'sticker',
      'image',
      'deleted',
      'text',
    ]);
    expectAllLinesAccountedFor(r, ATTACHMENTS);
  });

  it('still credits attachments to their sender', () => {
    const r = parseChat(ATTACHMENTS);
    expect(r.participants).toEqual(['Alon', 'Sarah Levi']);
  });
});

describe('participants', () => {
  it('orders by message count descending', () => {
    const r = parseChat(
      [
        '12/01/2023, 09:00 - Sarah Levi: one',
        '12/01/2023, 09:01 - Alon: one',
        '15/01/2023, 09:02 - Alon: two',
        '15/01/2023, 09:03 - Alon: three',
      ].join('\n'),
    );
    expect(r.participants).toEqual(['Alon', 'Sarah Levi']);
  });
});

describe('progress reporting', () => {
  it('reports monotonic progress ending at 1', () => {
    const seen: number[] = [];
    parseChat(ANDROID_BASIC, { onProgress: (f) => seen.push(f) });
    expect(seen.at(-1)).toBe(1);
    expect(seen.every((f, i) => i === 0 || f >= seen[i - 1]!)).toBe(true);
  });
});
