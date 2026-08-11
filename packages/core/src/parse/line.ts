import type {
  AttachmentType,
  Message,
  MessageKind,
  ParseOptions,
  ParseResult,
  ParseWarning,
} from '../types';
import { MAX_SENDER_LENGTH, stripInvisible } from './patterns';

/**
 * LINE exports.
 *
 * A different file from WhatsApp's in every respect, which is why it gets its
 * own reader rather than a third dialect inside the WhatsApp one. WhatsApp
 * stamps every line with a full date; LINE writes the date once as a heading
 * and then columns underneath it, tab-separated:
 *
 *     [LINE] Chat history with Pizza Tonight?
 *     Saved on: 2024/01/15 10:30
 *
 *     2024/01/15(Mon)
 *     10:30\tBagel\tsomeone put this chat through Yapped
 *     10:31\tGinger\t[Sticker]
 *     10:32\tBagel\tAlice joined the group      ← two columns, no sender: a notice
 *
 * Two consequences worth stating up front. The date is written `YYYY/MM/DD`, so
 * the day/month guessing that dominates the WhatsApp parser has nothing to do
 * here — the order is certain. And the sender lives in a column rather than
 * behind a `: `, so a message whose text contains a colon, or a name that
 * contains one, cannot be mis-split; only the first two tabs are structural and
 * everything after them is body, verbatim.
 */

/** `2024/01/15(Mon)`, `2024/01/15(月)`, `2024.01.15 Monday`, `2024/1/5(水)`. */
const DATE_HEADING = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})\s*(?:[(（].*[)）]|\s+\S+)?\s*$/;

/**
 * `10:30\t…` and the 12-hour `10:30 AM\t…` that US-locale phones write.
 *
 * The tab is the whole discriminator, and it is what keeps this from firing on
 * a WhatsApp line: WhatsApp puts ` - ` or `] ` after its timestamp, never a tab.
 */
const MESSAGE_LINE = /^(\d{1,2}):(\d{2})(?:[\s  ]*([AaPp])\.?[Mm]\.?)?\t(.*)$/;

/**
 * Placeholders LINE writes where the media was, in the two languages its
 * exports are most often read in. Table-driven for the same reason the WhatsApp
 * one is: another language is rows here, not code.
 *
 * These are UI strings from the exporting phone, not the language of the chat —
 * a Japanese group on an English phone emits the English ones.
 */
const ATTACHMENTS: ReadonlyArray<{ pattern: RegExp; type: AttachmentType }> = [
  { pattern: /^\[(Photo|Image)\]$/i, type: 'image' },
  { pattern: /^\[写真\]$/, type: 'image' },
  { pattern: /^\[Video\]$/i, type: 'video' },
  { pattern: /^\[動画\]$/, type: 'video' },
  { pattern: /^\[(Voice message|Audio|Voice note)\]$/i, type: 'audio' },
  { pattern: /^\[(ボイスメッセージ|音声メッセージ|音声)\]$/, type: 'audio' },
  { pattern: /^\[Sticker\]$/i, type: 'sticker' },
  { pattern: /^\[スタンプ\]$/, type: 'sticker' },
  { pattern: /^\[GIF\]$/i, type: 'gif' },
  { pattern: /^\[File\]$/i, type: 'document' },
  { pattern: /^\[ファイル\]$/, type: 'document' },
  { pattern: /^\[Contact\]$/i, type: 'contact' },
  { pattern: /^\[連絡先\]$/, type: 'contact' },
  // No location or album type in the model, and inventing one would mean every
  // consumer learning about it to render the same "something was sent" tile.
  { pattern: /^\[(Location|Album|Note|Gift|Payment|Poll)\]$/i, type: 'unknown' },
  { pattern: /^\[(位置情報|アルバム|ノート|ギフト|送金|投票)\]$/, type: 'unknown' },
];

/** A message the sender pulled back. LINE's wording for WhatsApp's "deleted". */
const UNSENT = [
  /^(You )?unsent a message\.?$/i,
  /^メッセージの送信を取り消しました$/,
  /^送信取消しました$/,
];

/**
 * Calls and joins and leaves: things that happened rather than things somebody
 * said.
 *
 * LINE puts a name in the sender column for these, which is exactly why they
 * need naming — left as ordinary messages, "Call time" becomes one of the
 * group's favourite phrases and every call counts as somebody talking. They are
 * classified as system notices with no sender, matching how the WhatsApp
 * parser treats the same events.
 */
const EVENTS = [
  /^☎/,
  /^\[Call\]$/i,
  /^\[通話\]$/,
  /^Call time /i,
  /^通話時間/,
  /^(No answer|Canceled the call|Missed call)\.?$/i,
  /^(不在着信|通話をキャンセルしました|応答がありませんでした)$/,
  /\b(joined the group|left the group|invited|was invited by|has left)\b/i,
  /(がグループに参加しました|がグループから退出しました|を招待しました|が退出しました|がグループに招待されました)$/,
  /^(.{1,80}) changed the group name to /i,
  /(がグループ名を変更しました|がノートを投稿しました|がアルバムを作成しました)$/,
];

/**
 * Does this look like LINE rather than WhatsApp?
 *
 * The banner is checked but never relied on: it is gone the moment anybody
 * re-saves, forwards or trims the file, and a chat that arrives without it is
 * still a chat. What actually decides it is the shape — timestamped lines with
 * a tab immediately after the clock, under `YYYY/MM/DD` headings — which no
 * WhatsApp export has ever produced.
 *
 * Reads a prefix rather than the file: this runs before the parse on something
 * that can be hundreds of megabytes, and the answer is settled in the first
 * screenful.
 */
export function looksLikeLineExport(raw: string): boolean {
  const head = raw.slice(0, 40_000).replace(/\r\n?/g, '\n').split('\n');

  let banner = false;
  let messages = 0;
  let dates = 0;

  for (const line of head) {
    const s = stripInvisible(line);
    if (!banner && (/^\[LINE\]/.test(s) || /トーク履歴$/.test(s))) banner = true;
    if (MESSAGE_LINE.test(s)) messages++;
    else if (DATE_HEADING.test(s)) dates++;
  }

  // With the banner one real message is enough; without it, insist on a heading
  // and a few lines under it, so that a stray tab in some other kind of text
  // file cannot carry the whole decision.
  return banner ? messages >= 1 : dates >= 1 && messages >= 3;
}

function normaliseHour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  const isPm = /p/i.test(meridiem);
  if (hour === 12) return isPm ? 12 : 0;
  return isPm ? hour + 12 : hour;
}

function classify(body: string): { kind: MessageKind; attachmentType?: AttachmentType } {
  const trimmed = body.trim();
  for (const p of UNSENT) {
    if (p.test(trimmed)) return { kind: 'deleted' };
  }
  for (const { pattern, type } of ATTACHMENTS) {
    if (pattern.test(trimmed)) return { kind: 'attachment', attachmentType: type };
  }
  return { kind: 'text' };
}

function isEvent(body: string): boolean {
  const trimmed = body.trim();
  return EVENTS.some((p) => p.test(trimmed));
}

/** Everything a message needs before its continuation lines have been read. */
interface Pending {
  hour: number;
  minute: number;
  year: number;
  month: number;
  day: number;
  sender: string | null;
  head: string;
  lineStart: number;
  continuation: string[];
}

export function parseLineExport(raw: string, options: ParseOptions = {}): ParseResult {
  const { onProgress } = options;

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const totalLines = lines.length;

  const messages: Message[] = [];
  const senderCounts = new Map<string, number>();
  const warnings: ParseWarning[] = [];

  let year = 0;
  let month = 0;
  let day = 0;
  let pending: Pending | null = null;
  let dateHeadingLines = 0;
  let continuationLines = 0;
  let orphanLines = 0;
  let systemMessages = 0;

  const flush = () => {
    if (!pending) return;

    // Trailing blanks belong to the gap before the next day's heading, not to
    // the message they happen to follow. They stay in `lineCount` — the line
    // accounting has to add up — but they do not become two empty lines at the
    // end of somebody's message.
    const tail = [...pending.continuation];
    while (tail.length > 0 && tail[tail.length - 1]!.trim() === '') tail.pop();

    const body = [pending.head, ...tail].join('\n');
    const isSystem = pending.sender === null || isEvent(body);

    let kind: MessageKind;
    let attachmentType: AttachmentType | undefined;
    if (isSystem) {
      kind = 'system';
      systemMessages++;
    } else {
      const classified = classify(body);
      kind = classified.kind;
      attachmentType = classified.attachmentType;
      senderCounts.set(pending.sender!, (senderCounts.get(pending.sender!) ?? 0) + 1);
    }

    messages.push({
      id: messages.length,
      // Anchored to UTC so gaps are exact and identical on every machine — the
      // same contract as the WhatsApp parser, and the same warning: these are
      // not real instants, and only the local* fields are safe for calendar
      // facts.
      ts: new Date(Date.UTC(pending.year, pending.month - 1, pending.day, pending.hour, pending.minute)),
      localYear: pending.year,
      localMonth: pending.month,
      localDay: pending.day,
      // From the date, never from the weekday LINE prints beside it — that is
      // written in the phone's language and is decoration.
      localWeekday: new Date(Date.UTC(pending.year, pending.month - 1, pending.day)).getUTCDay(),
      localHour: pending.hour,
      localMinute: pending.minute,
      sender: isSystem ? null : pending.sender,
      body,
      kind,
      ...(attachmentType ? { attachmentType } : {}),
      lineStart: pending.lineStart,
      lineCount: 1 + pending.continuation.length,
    });

    pending = null;
  };

  for (let i = 0; i < totalLines; i++) {
    const line = stripInvisible(lines[i] ?? '');

    const date = DATE_HEADING.exec(line);
    if (date) {
      flush();
      year = Number(date[1]);
      month = Number(date[2]);
      day = Number(date[3]);
      dateHeadingLines++;
      continue;
    }

    const hit = MESSAGE_LINE.exec(line);
    if (hit && year > 0) {
      flush();

      const rest = hit[4] ?? '';
      // Only the first two tabs are structure. A body that contains one — LINE
      // does not escape them — keeps it.
      const tab = rest.indexOf('\t');
      let sender: string | null = null;
      let head = rest;
      if (tab !== -1) {
        const candidate = rest.slice(0, tab).trim();
        // A "name" longer than any real display name means the line was a
        // notice that happened to contain a tab, not a message.
        if (candidate.length > 0 && candidate.length <= MAX_SENDER_LENGTH) {
          sender = candidate;
          head = rest.slice(tab + 1);
        }
      }

      pending = {
        hour: normaliseHour(Number(hit[1]), hit[3]),
        minute: Number(hit[2]),
        year,
        month,
        day,
        sender,
        head,
        lineStart: i + 1,
        continuation: [],
      };
      continue;
    }

    if (pending) {
      // Wrapped lines are indented under the text column with the tabs of the
      // two empty columns above them. Left in place they land in the word
      // counts as whitespace and in the longest-message stat as length.
      pending.continuation.push(line.replace(/^\t{1,2}/, ''));
      continuationLines++;
    } else {
      // The banner and its blank line, before the first heading.
      orphanLines++;
    }

    if ((i & 0x3ff) === 0) onProgress?.(i / totalLines, messages.length);
  }

  flush();

  if (messages.length === 0) {
    return {
      messages: [],
      participants: [],
      format: 'line',
      dateOrder: 'DMY',
      dateOrderConfidence: 'certain',
      diagnostics: {
        totalLines,
        headerLines: 0,
        continuationLines: 0,
        orphanLines: totalLines,
        systemMessages: 0,
        dateHeadingLines,
      },
      warnings: [
        {
          code: 'no-messages',
          message:
            'This looks like a LINE export but no messages could be read from it. Save the ' +
            'chat again from LINE as a .txt file and try that one.',
        },
      ],
    };
  }

  const participants = [...senderCounts.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([name]) => name);

  onProgress?.(1, messages.length);

  return {
    messages,
    participants,
    format: 'line',
    // LINE writes `YYYY/MM/DD`. There is nothing to resolve and nothing to get
    // wrong, which is the one thing this format does better than WhatsApp's.
    dateOrder: 'DMY',
    dateOrderConfidence: 'certain',
    diagnostics: {
      totalLines,
      headerLines: messages.length,
      continuationLines,
      orphanLines,
      systemMessages,
      dateHeadingLines,
    },
    warnings,
  };
}
