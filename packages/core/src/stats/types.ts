import type { ChatLanguage } from '../lang/language';

/** `YYYY-MM-DD`, built from the message's local calendar fields. */
export type DayKey = string;
/** `YYYY-MM`, built from the message's local calendar fields. */
export type MonthKey = string;

export interface Counted<T = string> {
  value: T;
  count: number;
}

export interface QuotedMessage {
  body: string;
  sender: string | null;
  day: DayKey;
  hour: number;
}

export interface PersonStats {
  name: string;
  messages: number;
  share: number;
  words: number;
  characters: number;
  attachments: number;
  deleted: number;
  links: number;
  emojiTotal: number;
  laughs: number;
  topEmoji: Counted[];
  topWords: Counted[];

  /** 24 buckets, from localHour — never from the runtime timezone. */
  hourHistogram: number[];

  /** Messages sent between 00:00 and 04:59. */
  nightMessages: number;
  nightShare: number;
  /** Messages sent between 05:00 and 07:59. */
  earlyMessages: number;
  earlyShare: number;

  /**
   * Reply gaps in ms, only counted when the previous message was someone else's
   * and the gap is under the cutoff — otherwise overnight gaps swamp the number.
   */
  medianResponseMs: number | null;
  meanResponseMs: number | null;
  responseSamples: number;

  /** Messages that opened a conversation after a long lull. */
  conversationsStarted: number;
  /**
   * Messages sent while their own previous message was still the last thing
   * in the chat, ten minutes or more later: the nudge after no reply. In a
   * two-person chat this is the balance of the relationship in one number.
   */
  doubleTexts: number;

  /** Longest stretch with no message from this person, in days. */
  longestSilenceDays: number;
  longestSilenceFrom: DayKey | null;
  longestSilenceTo: DayKey | null;
  /** True when the longest silence runs to the end of the chat — a real ghost. */
  stillGone: boolean;

  activeDays: number;
  /** Share of the days this person could have been active on. */
  consistency: number;

  firstMessageDay: DayKey;
  lastMessageDay: DayKey;
  longestMessage: QuotedMessage | null;
}

export interface DayActivity {
  day: DayKey;
  count: number;
}

export interface Explosion extends DayActivity {
  /** Standard deviations above the chat's own daily mean. */
  zScore: number;
  topSenders: Counted[];
}

export interface Silence {
  from: DayKey;
  to: DayKey;
  days: number;
  /** The message that finally broke it. */
  brokenBy: QuotedMessage | null;
}

export interface Awards {
  biggestTalker: string | null;
  nightOwl: string | null;
  earlyBird: string | null;
  fastestReplier: string | null;
  slowestReplier: string | null;
  ghost: string | null;
  conversationStarter: string | null;
  emojiAddict: string | null;
  essayist: string | null;
  mostConsistent: string | null;
  funniest: string | null;
  mediaSpammer: string | null;
}

export interface ChatStats {
  /** Best-effort group name; null for a 1:1 chat or when it cannot be found. */
  groupName: string | null;
  isGroup: boolean;
  /**
   * Language of the conversation — which is independent of the language of the
   * system notices, since WhatsApp writes those in the phone's UI language.
   * Drives stopword choice and whether the deck lays out right-to-left.
   */
  language: ChatLanguage;

  totalMessages: number;
  totalSystemMessages: number;
  totalWords: number;
  totalCharacters: number;
  totalAttachments: number;
  totalDeleted: number;
  totalLinks: number;
  totalEmoji: number;

  span: {
    first: DayKey;
    last: DayKey;
    /** Inclusive day count across the whole export. */
    days: number;
    /** Distinct days with at least one message. */
    activeDays: number;
    label: string;
  };

  perDay: number;

  /**
   * How finely this export records time: 1 000 ms when any message carries a
   * seconds field, 60 000 ms when it does not.
   *
   * Most Android exports are written to the minute, which makes every
   * same-minute reply a gap of exactly zero — so a fast replier's median
   * reply time is honestly `0`, and printing it as "0s" claims a precision the
   * file never had. Anything rendering `medianResponseMs` needs this to know
   * which of the two it is looking at.
   */
  timestampPrecisionMs: number;

  people: PersonStats[];

  hourHistogram: number[];
  weekdayHistogram: number[];
  monthly: { key: MonthKey; year: number; month: number; count: number }[];
  daily: DayActivity[];

  busiestDay: DayActivity | null;
  busiestMonth: { key: MonthKey; count: number } | null;
  busiestHour: { hour: number; count: number } | null;

  topEmoji: Counted[];
  topWords: Counted[];
  longestMessage: QuotedMessage | null;
  firstMessage: QuotedMessage | null;
  lastMessage: QuotedMessage | null;

  /** Longest run of consecutive days with at least one message. */
  longestStreak: { days: number; from: DayKey; to: DayKey } | null;
  explosions: Explosion[];
  silences: Silence[];

  awards: Awards;
}

export interface StatsOptions {
  /**
   * A reply counts only if it lands within this window; beyond it the "reply"
   * is really just the next morning. Defaults to 2 hours.
   */
  replyWindowMs?: number;
  /**
   * A message this long after the previous one starts a new conversation.
   * Defaults to 3 hours.
   */
  conversationGapMs?: number;
  /** Filename of the export, used to recover the group name. */
  fileName?: string;
  /** Skip detection and force a language, e.g. from a user-facing toggle. */
  language?: ChatLanguage;
}
