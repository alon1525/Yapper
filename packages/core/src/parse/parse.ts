import type {
  AttachmentType,
  DateOrder,
  DateOrderConfidence,
  ExportFormat,
  Message,
  MessageKind,
  ParseOptions,
  ParseResult,
  ParseWarning,
} from '../types';
import {
  ANDROID_HEADER,
  ATTACHMENT_PATTERNS,
  DELETED_PATTERNS,
  IOS_HEADER,
  KNOWN_SYSTEM_PATTERNS,
  MAX_SENDER_LENGTH,
  SYSTEM_WITH_COLON_PATTERNS,
  stripInvisible,
} from './patterns';

/** A header line decomposed into its raw numeric parts, before D/M resolution. */
interface RawHeader {
  /** First date field as written — day under DMY, month under MDY. */
  a: number;
  /** Second date field as written — month under DMY, day under MDY. */
  b: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
  meridiem: string | undefined;
  /** Everything after the header: either `Sender: body` or a system notice. */
  remainder: string;
  /** 1-indexed source line. */
  line: number;
}

function matchHeader(
  line: string,
  format: ExportFormat | null,
): { header: Omit<RawHeader, 'line'>; format: ExportFormat } | null {
  const tryOrder: ExportFormat[] =
    format === 'ios' ? ['ios'] : format === 'android' ? ['android'] : ['ios', 'android'];

  for (const f of tryOrder) {
    const m = (f === 'ios' ? IOS_HEADER : ANDROID_HEADER).exec(line);
    if (!m) continue;
    return {
      format: f,
      header: {
        a: Number(m[1]),
        b: Number(m[2]),
        year: Number(m[3]),
        hour: Number(m[4]),
        minute: Number(m[5]),
        second: m[6] ? Number(m[6]) : 0,
        meridiem: m[7],
        remainder: m[8] ?? '',
      },
    };
  }
  return null;
}

function normaliseYear(y: number): number {
  if (y >= 1000) return y;
  // Two-digit years: WhatsApp has never exported a 20th-century chat, but keep
  // the conventional pivot rather than inventing a rule.
  return y < 70 ? 2000 + y : 1900 + y;
}

function normaliseHour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  const isPm = /p/i.test(meridiem);
  if (hour === 12) return isPm ? 12 : 0;
  return isPm ? hour + 12 : hour;
}

/**
 * Resolve dd/mm vs mm/dd for the file as a whole. It is not decidable per-line,
 * and guessing wrong flips every month and timeline statistic.
 *
 * 1. Any first-field > 12 proves the first field is the day (and vice versa).
 * 2. Otherwise, exploit the fact that an export is chronologically ordered:
 *    whichever reading produces fewer backwards jumps is the right one.
 * 3. If both readings are equally consistent there is genuinely no evidence;
 *    fall back to the caller's default and mark it `assumed` so the UI can
 *    offer a toggle.
 */
function resolveDateOrder(
  headers: RawHeader[],
  defaultOrder: DateOrder,
): { order: DateOrder; confidence: DateOrderConfidence; warning?: ParseWarning } {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const h of headers) {
    if (h.a > 12) firstOver12 = true;
    if (h.b > 12) secondOver12 = true;
  }

  if (firstOver12 && !secondOver12) return { order: 'DMY', confidence: 'certain' };
  if (secondOver12 && !firstOver12) return { order: 'MDY', confidence: 'certain' };

  if (firstOver12 && secondOver12) {
    // Both fields exceed 12 somewhere in the file — neither can be the month.
    // The export is malformed or concatenated from several chats.
    return {
      order: defaultOrder,
      confidence: 'assumed',
      warning: {
        code: 'conflicting-date-order',
        message:
          'Both date fields exceed 12 somewhere in this file, so neither can be the month. ' +
          `Falling back to ${defaultOrder}; dates may be wrong.`,
      },
    };
  }

  const violations = (order: DateOrder): number => {
    let bad = 0;
    let prev = -Infinity;
    for (const h of headers) {
      const day = order === 'DMY' ? h.a : h.b;
      const month = order === 'DMY' ? h.b : h.a;
      const key = normaliseYear(h.year) * 10000 + month * 100 + day;
      if (key < prev) bad++;
      prev = key;
    }
    return bad;
  };

  const dmy = violations('DMY');
  const mdy = violations('MDY');
  if (dmy !== mdy) {
    return { order: dmy < mdy ? 'DMY' : 'MDY', confidence: 'inferred' };
  }

  return {
    order: defaultOrder,
    confidence: 'assumed',
    warning: {
      code: 'ambiguous-date-order',
      message:
        'No date in this export has a day above 12, so day/month order cannot be determined. ' +
        `Assuming ${defaultOrder}.`,
    },
  };
}

function classifyBody(body: string): { kind: MessageKind; attachmentType?: AttachmentType } {
  const trimmed = body.trim();

  for (const p of DELETED_PATTERNS) {
    if (p.test(trimmed)) return { kind: 'deleted' };
  }
  for (const { pattern, type } of ATTACHMENT_PATTERNS) {
    if (pattern.test(trimmed)) return { kind: 'attachment', attachmentType: type };
  }
  return { kind: 'text' };
}

/**
 * Split a header remainder into sender and body.
 *
 * Returns `null` for system notices, which belong to no participant and must be
 * excluded from every per-person statistic rather than attributed to whoever
 * happened to speak last.
 */
function splitSender(remainder: string): { sender: string; body: string } | null {
  for (const p of SYSTEM_WITH_COLON_PATTERNS) {
    if (p.test(remainder)) return null;
  }

  const idx = remainder.indexOf(': ');
  if (idx === -1) return null;

  const sender = remainder.slice(0, idx).trim();
  if (sender.length === 0 || sender.length > MAX_SENDER_LENGTH) return null;

  return { sender, body: remainder.slice(idx + 2) };
}

export function parseChat(raw: string, options: ParseOptions = {}): ParseResult {
  const { onProgress, dateOrder: forcedOrder, defaultDateOrder = 'DMY' } = options;

  // Normalise line endings. A leading BOM needs no special case here: every
  // line is run through stripInvisible before anything inspects it.
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  // A trailing newline yields a final empty element that is not a real line.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const totalLines = lines.length;

  const warnings: ParseWarning[] = [];

  // ---- Pass 1: locate headers, decide format, collect raw date parts --------
  let format: ExportFormat | null = null;
  const headers: RawHeader[] = [];
  /** Parallel to `headers`: index of the source line for each. */
  const headerLineIndex: number[] = [];
  /** For every source line, true when that line opened a message. */
  const isHeaderLine = new Uint8Array(totalLines);

  for (let i = 0; i < totalLines; i++) {
    const line = stripInvisible(lines[i] ?? '');
    const hit = matchHeader(line, format);
    if (!hit) continue;

    // Commit to the first format we see. Mixing shapes within one file is not a
    // thing WhatsApp does, and letting it drift mid-file invites false matches.
    format ??= hit.format;
    if (hit.format !== format) continue;

    isHeaderLine[i] = 1;
    headerLineIndex.push(i);
    headers.push({ ...hit.header, line: i + 1 });

    if ((i & 0x3ff) === 0) onProgress?.((i / totalLines) * 0.5, headers.length);
  }

  if (headers.length === 0) {
    return {
      messages: [],
      participants: [],
      format: format ?? 'android',
      dateOrder: forcedOrder ?? defaultDateOrder,
      dateOrderConfidence: 'assumed',
      diagnostics: {
        totalLines,
        headerLines: 0,
        continuationLines: 0,
        orphanLines: totalLines,
        systemMessages: 0,
      },
      warnings: [
        {
          code: 'no-messages',
          message:
            'No WhatsApp messages found. This does not look like a chat export — make sure ' +
            'you exported the chat as a .txt file.',
        },
      ],
    };
  }

  // ---- Resolve day/month ordering across the whole file --------------------
  let order: DateOrder;
  let confidence: DateOrderConfidence;
  if (forcedOrder) {
    order = forcedOrder;
    confidence = 'certain';
  } else {
    const resolved = resolveDateOrder(headers, defaultDateOrder);
    order = resolved.order;
    confidence = resolved.confidence;
    if (resolved.warning) warnings.push(resolved.warning);
  }

  // ---- Pass 2: build messages, folding continuation lines ------------------
  const messages: Message[] = [];
  const senderCounts = new Map<string, number>();
  let continuationLines = 0;
  let systemMessages = 0;
  const suspiciousSystemLines: number[] = [];

  for (let h = 0; h < headers.length; h++) {
    const header = headers[h]!;
    const startLine = headerLineIndex[h]!;
    const endLine = h + 1 < headers.length ? headerLineIndex[h + 1]! : totalLines;

    // Continuation lines are everything up to the next header. Blank lines
    // inside a message count here too — they are part of the message text, and
    // leaving them unaccounted for would break the line invariant.
    const continuation: string[] = [];
    for (let i = startLine + 1; i < endLine; i++) {
      continuation.push(stripInvisible(lines[i] ?? ''));
    }
    continuationLines += continuation.length;

    const split = splitSender(header.remainder);
    const fullBody =
      continuation.length > 0
        ? [split ? split.body : header.remainder, ...continuation].join('\n')
        : split
          ? split.body
          : header.remainder;

    const day = order === 'DMY' ? header.a : header.b;
    const month = order === 'DMY' ? header.b : header.a;
    const year = normaliseYear(header.year);
    const hour = normaliseHour(header.hour, header.meridiem);

    // Anchored to UTC so that gaps are exact and identical on every machine.
    // See the note on Message.ts — this is NOT the real instant, and the
    // local* fields below are the only safe source for calendar facts.
    const ts = new Date(Date.UTC(year, month - 1, day, hour, header.minute, header.second));

    let kind: MessageKind;
    let attachmentType: AttachmentType | undefined;
    if (!split) {
      kind = 'system';
      systemMessages++;
      if (!KNOWN_SYSTEM_PATTERNS.some((p) => p.test(header.remainder))) {
        if (suspiciousSystemLines.length < 10) suspiciousSystemLines.push(header.line);
      }
    } else {
      const classified = classifyBody(fullBody);
      kind = classified.kind;
      attachmentType = classified.attachmentType;
      senderCounts.set(split.sender, (senderCounts.get(split.sender) ?? 0) + 1);
    }

    messages.push({
      id: messages.length,
      ts,
      localYear: year,
      localMonth: month,
      localDay: day,
      // Built from the local triple via UTC accessors so the runtime timezone
      // cannot shift it.
      localWeekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      localHour: hour,
      localMinute: header.minute,
      sender: split ? split.sender : null,
      body: fullBody,
      kind,
      ...(attachmentType ? { attachmentType } : {}),
      lineStart: header.line,
      lineCount: 1 + continuation.length,
    });

    if ((h & 0x3ff) === 0) onProgress?.(0.5 + (h / headers.length) * 0.5, messages.length);
  }

  const orphanLines = headerLineIndex[0]!;
  if (orphanLines > 0) {
    warnings.push({
      code: 'orphan-lines',
      message:
        `${orphanLines} line(s) before the first message could not be attached to anything. ` +
        'This usually means an unrecognised export format.',
      lines: Array.from({ length: Math.min(orphanLines, 10) }, (_, i) => i + 1),
    });
  }

  if (suspiciousSystemLines.length > 0) {
    warnings.push({
      code: 'suspicious-sender',
      message:
        `${suspiciousSystemLines.length}+ line(s) had no "Sender: " and matched no known system ` +
        'notice. They were treated as system messages and excluded from per-person stats.',
      lines: suspiciousSystemLines,
    });
  }

  const participants = [...senderCounts.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([name]) => name);

  onProgress?.(1, messages.length);

  return {
    messages,
    participants,
    format: format!,
    dateOrder: order,
    dateOrderConfidence: confidence,
    diagnostics: {
      totalLines,
      headerLines: headers.length,
      continuationLines,
      orphanLines,
      systemMessages,
    },
    warnings,
  };
}
