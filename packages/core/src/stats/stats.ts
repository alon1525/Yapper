import type { Message, ParseResult } from '../types';
import {
  detectLanguage,
  minWordLength,
  stopwordsFor,
  wordSegmenterFor,
  type ChatLanguage,
} from '../lang/language';
import {
  countLaughter,
  countWords,
  extractEmoji,
  extractLinks,
  extractWords,
  increment,
  topEntries,
} from './text';
import type {
  Awards,
  ChatStats,
  Counted,
  DayActivity,
  DayKey,
  Explosion,
  MonthKey,
  PersonStats,
  QuotedMessage,
  Silence,
  StatsOptions,
} from './types';

const DAY_MS = 86_400_000;
/** A second message from the same person this long after the first is a nudge. */
const DOUBLE_TEXT_MS = 10 * 60 * 1000;
const DEFAULT_REPLY_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEFAULT_CONVERSATION_GAP_MS = 3 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (m: Message): DayKey =>
  `${m.localYear}-${pad(m.localMonth)}-${pad(m.localDay)}`;

export const monthKey = (m: Message): MonthKey => `${m.localYear}-${pad(m.localMonth)}`;

/** Midnight-UTC epoch for a message's local date, for exact day arithmetic. */
const dayEpoch = (m: Message): number =>
  Date.UTC(m.localYear, m.localMonth - 1, m.localDay);

const dayKeyFromEpoch = (epoch: number): DayKey => {
  const d = new Date(epoch);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function quote(m: Message): QuotedMessage {
  return { body: m.body, sender: m.sender, day: dayKey(m), hour: m.localHour };
}

/**
 * Recover the group name. WhatsApp does not put it in the file body, so the
 * export filename is the only reliable source; the "created group" system
 * notice is a fallback for chats that have one.
 */
function findGroupName(messages: Message[], fileName: string | undefined): string | null {
  if (fileName) {
    const m = /WhatsApp Chat (?:with|-)\s*(.+?)\.(txt|zip)$/i.exec(fileName);
    if (m?.[1]) return m[1].trim();
  }
  for (const msg of messages) {
    if (msg.kind !== 'system') continue;
    const created = /created (?:this )?group\s+"(.+?)"/i.exec(msg.body);
    if (created?.[1]) return created[1];
    const subject = /changed the subject (?:from .+? )?to:?\s*"?(.+?)"?$/i.exec(msg.body);
    if (subject?.[1]) return subject[1].trim();
  }
  return null;
}

/** Per-person accumulator. Kept separate from the public shape so the hot loop
 * touches plain mutable fields rather than rebuilding objects. */
interface Acc {
  name: string;
  messages: number;
  words: number;
  characters: number;
  attachments: number;
  deleted: number;
  links: number;
  laughs: number;
  emojiTotal: number;
  emoji: Map<string, number>;
  wordCounts: Map<string, number>;
  hours: number[];
  nightMessages: number;
  earlyMessages: number;
  responses: number[];
  conversationsStarted: number;
  doubleTexts: number;
  days: Set<DayKey>;
  firstTs: number;
  lastTs: number;
  firstDay: DayKey;
  lastDay: DayKey;
  longest: Message | null;
  /** Epoch-ms of this person's previous message, for silence detection. */
  prevTs: number;
  longestSilenceMs: number;
  silenceFrom: number;
  silenceTo: number;
}

function newAcc(name: string, m: Message): Acc {
  return {
    name,
    messages: 0,
    words: 0,
    characters: 0,
    attachments: 0,
    deleted: 0,
    links: 0,
    laughs: 0,
    emojiTotal: 0,
    emoji: new Map(),
    wordCounts: new Map(),
    hours: new Array(24).fill(0),
    nightMessages: 0,
    earlyMessages: 0,
    responses: [],
    conversationsStarted: 0,
    doubleTexts: 0,
    days: new Set(),
    firstTs: m.ts.getTime(),
    lastTs: m.ts.getTime(),
    firstDay: dayKey(m),
    lastDay: dayKey(m),
    longest: null,
    prevTs: -1,
    longestSilenceMs: 0,
    silenceFrom: 0,
    silenceTo: 0,
  };
}

export function computeStats(parsed: ParseResult, options: StatsOptions = {}): ChatStats {
  const {
    replyWindowMs = DEFAULT_REPLY_WINDOW_MS,
    conversationGapMs = DEFAULT_CONVERSATION_GAP_MS,
    fileName,
  } = options;

  const language = options.language ?? detectLanguage(parsed.messages);
  const stopwords = stopwordsFor(language);
  const minWord = minWordLength(language);
  /* Built once for the whole export rather than per message: a chat with no
     spaces in it needs ICU to find its word boundaries, and constructing a
     segmenter 173,000 times is most of the cost of doing so. */
  const segmenter = wordSegmenterFor(language);

  // System messages are excluded from every per-person statistic. They belong
  // to nobody, and attributing them silently inflates whoever spoke last.
  const msgs = parsed.messages.filter((m) => m.kind !== 'system');
  const systemCount = parsed.messages.length - msgs.length;

  if (msgs.length === 0) {
    return emptyStats(systemCount, findGroupName(parsed.messages, fileName), language);
  }

  const accs = new Map<string, Acc>();
  const emojiAll = new Map<string, number>();
  const wordsAll = new Map<string, number>();
  const dayCounts = new Map<DayKey, number>();
  const daySenders = new Map<DayKey, Map<string, number>>();
  const monthCounts = new Map<MonthKey, number>();
  const hourHistogram = new Array<number>(24).fill(0);
  const weekdayHistogram = new Array<number>(7).fill(0);

  let totalWords = 0;
  let totalCharacters = 0;
  let totalAttachments = 0;
  let totalDeleted = 0;
  let totalLinks = 0;
  let totalEmoji = 0;
  let longestOverall: Message | null = null;
  // A single message with a non-zero seconds field is enough to prove the
  // export was written to the second; without one, every gap in the file is a
  // whole number of minutes.
  let hasSeconds = false;

  const silences: Silence[] = [];

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    const sender = m.sender!;
    const ts = m.ts.getTime();
    const dk = dayKey(m);

    let acc = accs.get(sender);
    if (!acc) {
      acc = newAcc(sender, m);
      accs.set(sender, acc);
    }

    acc.messages++;
    acc.hours[m.localHour] = (acc.hours[m.localHour] ?? 0) + 1;
    acc.days.add(dk);
    acc.lastTs = ts;
    acc.lastDay = dk;

    if (!hasSeconds && m.ts.getUTCSeconds() !== 0) hasSeconds = true;

    if (m.localHour < 5) acc.nightMessages++;
    else if (m.localHour < 8) acc.earlyMessages++;

    hourHistogram[m.localHour] = (hourHistogram[m.localHour] ?? 0) + 1;
    weekdayHistogram[m.localWeekday] = (weekdayHistogram[m.localWeekday] ?? 0) + 1;
    increment(dayCounts, dk);
    increment(monthCounts, monthKey(m));

    let bySender = daySenders.get(dk);
    if (!bySender) {
      bySender = new Map();
      daySenders.set(dk, bySender);
    }
    increment(bySender, sender);

    if (m.kind === 'attachment') {
      acc.attachments++;
      totalAttachments++;
    } else if (m.kind === 'deleted') {
      acc.deleted++;
      totalDeleted++;
    } else {
      // Only real text contributes to language statistics — counting
      // `<Media omitted>` as words would make the media spammer the essayist.
      const chars = m.body.length;
      acc.characters += chars;
      totalCharacters += chars;

      const wordTotal = countWords(m.body, segmenter);
      acc.words += wordTotal;
      totalWords += wordTotal;

      for (const w of extractWords(m.body, stopwords, minWord, segmenter)) {
        increment(acc.wordCounts, w);
        increment(wordsAll, w);
      }
      for (const e of extractEmoji(m.body)) {
        increment(acc.emoji, e);
        increment(emojiAll, e);
        acc.emojiTotal++;
        totalEmoji++;
      }
      const linkCount = extractLinks(m.body).length;
      acc.links += linkCount;
      totalLinks += linkCount;

      acc.laughs += countLaughter(m.body);

      if (!acc.longest || m.body.length > acc.longest.body.length) acc.longest = m;
      if (!longestOverall || m.body.length > longestOverall.body.length) longestOverall = m;
    }

    // Reply timing and conversation starts, both relative to the previous
    // message from anyone.
    const prev = i > 0 ? msgs[i - 1]! : null;
    if (prev) {
      const gap = ts - prev.ts.getTime();
      if (prev.sender !== sender && gap >= 0 && gap <= replyWindowMs) {
        acc.responses.push(gap);
      }
      // Their own message, still unanswered after ten minutes, and here is
      // another. Under ten it is one thought in two bubbles, not a nudge.
      if (prev.sender === sender && gap >= DOUBLE_TEXT_MS && gap < conversationGapMs) {
        acc.doubleTexts++;
      }
      if (gap >= conversationGapMs) {
        acc.conversationsStarted++;
        if (gap >= DAY_MS) {
          silences.push({
            from: dayKey(prev),
            to: dk,
            days: Math.round(gap / DAY_MS),
            brokenBy: quote(m),
          });
        }
      }
    } else {
      acc.conversationsStarted++;
    }

    // Per-person silence: the longest stretch this person said nothing.
    if (acc.prevTs >= 0) {
      const personGap = ts - acc.prevTs;
      if (personGap > acc.longestSilenceMs) {
        acc.longestSilenceMs = personGap;
        acc.silenceFrom = acc.prevTs;
        acc.silenceTo = ts;
      }
    }
    acc.prevTs = ts;
  }

  const chatEndTs = msgs[msgs.length - 1]!.ts.getTime();

  // A trailing silence — last message to the end of the chat — is the real
  // ghost case, and funnier than any mid-chat gap, so it competes on equal
  // terms rather than being ignored.
  for (const acc of accs.values()) {
    const trailing = chatEndTs - acc.lastTs;
    if (trailing > acc.longestSilenceMs) {
      acc.longestSilenceMs = trailing;
      acc.silenceFrom = acc.lastTs;
      acc.silenceTo = chatEndTs;
    }
  }

  const firstMsg = msgs[0]!;
  const lastMsg = msgs[msgs.length - 1]!;
  const firstEpoch = dayEpoch(firstMsg);
  const lastEpoch = dayEpoch(lastMsg);
  const spanDays = Math.round((lastEpoch - firstEpoch) / DAY_MS) + 1;

  const people: PersonStats[] = [...accs.values()]
    .map((a) => {
      const sortedResponses = [...a.responses].sort((x, y) => x - y);
      const meanResponse =
        a.responses.length > 0
          ? a.responses.reduce((s, v) => s + v, 0) / a.responses.length
          : null;

      // Consistency is measured over the days this person could have been
      // present, not the whole chat — otherwise anyone who joined late looks
      // flaky for reasons outside their control.
      const availableDays =
        Math.round((lastEpoch - Date.parse(`${a.firstDay}T00:00:00Z`)) / DAY_MS) + 1;

      return {
        name: a.name,
        messages: a.messages,
        share: a.messages / msgs.length,
        words: a.words,
        characters: a.characters,
        attachments: a.attachments,
        deleted: a.deleted,
        links: a.links,
        emojiTotal: a.emojiTotal,
        laughs: a.laughs,
        topEmoji: topEntries(a.emoji, 5),
        topWords: topEntries(a.wordCounts, 10),
        hourHistogram: a.hours,
        nightMessages: a.nightMessages,
        nightShare: a.nightMessages / a.messages,
        earlyMessages: a.earlyMessages,
        earlyShare: a.earlyMessages / a.messages,
        medianResponseMs: median(sortedResponses),
        meanResponseMs: meanResponse,
        responseSamples: a.responses.length,
        conversationsStarted: a.conversationsStarted,
        doubleTexts: a.doubleTexts,
        longestSilenceDays: a.longestSilenceMs / DAY_MS,
        longestSilenceFrom: a.longestSilenceMs > 0 ? dayKeyFromEpoch(a.silenceFrom) : null,
        longestSilenceTo: a.longestSilenceMs > 0 ? dayKeyFromEpoch(a.silenceTo) : null,
        stillGone: a.longestSilenceMs > 0 && a.silenceTo === chatEndTs,
        activeDays: a.days.size,
        consistency: availableDays > 0 ? a.days.size / availableDays : 0,
        firstMessageDay: a.firstDay,
        lastMessageDay: a.lastDay,
        longestMessage: a.longest ? quote(a.longest) : null,
      } satisfies PersonStats;
    })
    .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));

  const daily: DayActivity[] = [...dayCounts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const monthly = [...monthCounts.entries()]
    .map(([key, count]) => {
      const [y, mo] = key.split('-');
      return { key, year: Number(y), month: Number(mo), count };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const busiestDay = daily.reduce<DayActivity | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  );
  const busiestMonth = monthly.reduce<{ key: MonthKey; count: number } | null>(
    (best, m) => (!best || m.count > best.count ? { key: m.key, count: m.count } : best),
    null,
  );
  const busiestHour = hourHistogram.reduce<{ hour: number; count: number } | null>(
    (best, count, hour) => (!best || count > best.count ? { hour, count } : best),
    null,
  );

  return {
    groupName: findGroupName(parsed.messages, fileName),
    isGroup: accs.size > 2,
    language,
    totalMessages: msgs.length,
    totalSystemMessages: systemCount,
    totalWords,
    totalCharacters,
    totalAttachments,
    totalDeleted,
    totalLinks,
    totalEmoji,
    span: {
      first: dayKey(firstMsg),
      last: dayKey(lastMsg),
      days: spanDays,
      activeDays: dayCounts.size,
      label: spanLabel(firstMsg, lastMsg),
    },
    perDay: msgs.length / spanDays,
    timestampPrecisionMs: hasSeconds ? 1_000 : 60_000,
    people,
    hourHistogram,
    weekdayHistogram,
    monthly,
    daily,
    busiestDay,
    busiestMonth,
    busiestHour,
    topEmoji: topEntries(emojiAll, 10),
    topWords: topEntries(wordsAll, 20),
    longestMessage: longestOverall ? quote(longestOverall) : null,
    firstMessage: quote(firstMsg),
    lastMessage: quote(lastMsg),
    longestStreak: computeStreak(daily),
    explosions: computeExplosions(daily, daySenders),
    silences: silences.sort((a, b) => b.days - a.days).slice(0, 5),
    awards: computeAwards(people),
  };
}

function spanLabel(first: Message, last: Message): string {
  const a = `${MONTH_NAMES[first.localMonth - 1]} ${first.localYear}`;
  const b = `${MONTH_NAMES[last.localMonth - 1]} ${last.localYear}`;
  return a === b ? a : `${a} – ${b}`;
}

function computeStreak(daily: DayActivity[]): ChatStats['longestStreak'] {
  if (daily.length === 0) return null;

  let bestLen = 1;
  let bestStart = daily[0]!.day;
  let bestEnd = daily[0]!.day;
  let curLen = 1;
  let curStart = daily[0]!.day;

  for (let i = 1; i < daily.length; i++) {
    const prev = Date.parse(`${daily[i - 1]!.day}T00:00:00Z`);
    const cur = Date.parse(`${daily[i]!.day}T00:00:00Z`);
    if (cur - prev === DAY_MS) {
      curLen++;
    } else {
      curLen = 1;
      curStart = daily[i]!.day;
    }
    if (curLen > bestLen) {
      bestLen = curLen;
      bestStart = curStart;
      bestEnd = daily[i]!.day;
    }
  }
  return { days: bestLen, from: bestStart, to: bestEnd };
}

/**
 * Days that stand out against the chat's own baseline, not an absolute
 * threshold — a 40-message day is chaos in a quiet group and a slow Tuesday in
 * a loud one.
 */
function computeExplosions(
  daily: DayActivity[],
  daySenders: Map<DayKey, Map<string, number>>,
): Explosion[] {
  if (daily.length < 3) return [];

  const counts = daily.map((d) => d.count);
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
  const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return [];

  return daily
    .map((d) => ({
      ...d,
      zScore: (d.count - mean) / sd,
      topSenders: topEntries(daySenders.get(d.day) ?? new Map<string, number>(), 3),
    }))
    .filter((d) => d.zScore >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** Picks the winner of a category, or null when there is nothing to compare. */
function argmax<T>(items: T[], score: (item: T) => number | null): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s === null || Number.isNaN(s)) continue;
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return best;
}

function computeAwards(people: PersonStats[]): Awards {
  const name = (p: PersonStats | null) => p?.name ?? null;

  // Response-time awards need enough samples to mean anything; one lucky reply
  // should not crown the fastest replier.
  const repliers = people.filter((p) => p.responseSamples >= 5 && p.medianResponseMs !== null);
  const talkers = people.filter((p) => p.messages >= 5);

  return {
    biggestTalker: name(argmax(people, (p) => p.messages)),
    nightOwl: name(argmax(talkers, (p) => p.nightShare)),
    earlyBird: name(argmax(talkers, (p) => p.earlyShare)),
    fastestReplier: name(argmax(repliers, (p) => -(p.medianResponseMs ?? Infinity))),
    slowestReplier: name(argmax(repliers, (p) => p.medianResponseMs ?? -Infinity)),
    ghost: name(argmax(people, (p) => p.longestSilenceDays)),
    conversationStarter: name(argmax(people, (p) => p.conversationsStarted)),
    emojiAddict: name(argmax(talkers, (p) => p.emojiTotal / p.messages)),
    essayist: name(argmax(talkers, (p) => p.characters / Math.max(1, p.messages - p.attachments))),
    mostConsistent: name(argmax(talkers, (p) => p.consistency)),
    funniest: name(argmax(talkers, (p) => p.laughs / p.messages)),
    mediaSpammer: name(argmax(people, (p) => p.attachments)),
  };
}

function emptyStats(
  systemCount: number,
  groupName: string | null,
  language: ChatLanguage,
): ChatStats {
  const noAward: Awards = {
    biggestTalker: null,
    nightOwl: null,
    earlyBird: null,
    fastestReplier: null,
    slowestReplier: null,
    ghost: null,
    conversationStarter: null,
    emojiAddict: null,
    essayist: null,
    mostConsistent: null,
    funniest: null,
    mediaSpammer: null,
  };
  return {
    groupName,
    isGroup: false,
    language,
    totalMessages: 0,
    totalSystemMessages: systemCount,
    totalWords: 0,
    totalCharacters: 0,
    totalAttachments: 0,
    totalDeleted: 0,
    totalLinks: 0,
    totalEmoji: 0,
    span: { first: '', last: '', days: 0, activeDays: 0, label: '' },
    perDay: 0,
    timestampPrecisionMs: 60_000,
    people: [],
    hourHistogram: new Array<number>(24).fill(0),
    weekdayHistogram: new Array<number>(7).fill(0),
    monthly: [],
    daily: [],
    busiestDay: null,
    busiestMonth: null,
    busiestHour: null,
    topEmoji: [] as Counted[],
    topWords: [] as Counted[],
    longestMessage: null,
    firstMessage: null,
    lastMessage: null,
    longestStreak: null,
    explosions: [],
    silences: [],
    awards: noAward,
  };
}
