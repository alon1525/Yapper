import type { ChatLanguage } from '../lang/language';
import { dayKey } from '../stats/stats';
import { increment } from '../stats/text';
import type { Message, ParseResult } from '../types';

/**
 * Promises, recurring questions, and plans that never happened.
 *
 * This is the module that produces "A Complete History of I'm Five Minutes
 * Away". It is deliberately lexical rather than clever: a small set of patterns
 * per language, matched against message bodies, counted per person, with every
 * hit carrying its message id so the resulting claim can be cited.
 *
 * The honest limit, stated here because a caller will otherwise assume more:
 * **this detects the promise, not the outcome.** Nothing in a text export says
 * whether somebody actually arrived. What `contradictions` below reports is a
 * much narrower and genuinely checkable thing — the same person saying the same
 * imminent-arrival phrase repeatedly across one evening, which means the first
 * one was not true. Anything beyond that is left for the model to argue from
 * evidence, not asserted here as fact.
 */

const MINUTE = 60_000;

export type CommitmentKind =
  /** "five minutes", "on my way", "almost there". */
  | 'arriving'
  /** "tomorrow", "next week", "soon" — a deferral. */
  | 'deferral'
  /** "I'll do it", "I'm in", "count me in". */
  | 'undertaking';

export type QuestionKind = 'when' | 'where' | 'who' | 'what_plan' | 'confirm';

export interface Hit {
  messageId: number;
  sender: string;
  day: string;
  /** The matched phrase as written, for quoting. */
  phrase: string;
}

export interface CommitmentProfile {
  sender: string;
  counts: Record<CommitmentKind, number>;
  total: number;
  /** Commitments per hundred messages — comparable between loud and quiet people. */
  rate: number;
  examples: Hit[];
}

export interface RepeatedArrival {
  sender: string;
  day: string;
  /** Times they announced imminent arrival within one evening. */
  claims: number;
  /** Minutes from the first claim to the last. */
  spanMinutes: number;
  messageIds: number[];
}

export interface QuestionProfile {
  kind: QuestionKind;
  count: number;
  /** Who asks this one most. */
  topAsker: string | null;
  examples: Hit[];
}

export interface CommitmentReport {
  people: CommitmentProfile[];
  /** Same person, same evening, arriving repeatedly. Self-contradicting. */
  repeatedArrivals: RepeatedArrival[];
  questions: QuestionProfile[];
  /** Total messages scanned, so a caller can express any of this as a share. */
  scanned: number;
}

/*
  Patterns are anchored loosely on purpose. "5 min" appears as "5 min", "5min",
  "5 minutes", "בעוד 5 דקות" and "עוד דקה" in the same chat, and a pattern set
  tight enough to be elegant matches one of them.
*/

/**
 * A Hebrew word pattern.
 *
 * JavaScript's `\b` is defined on `[A-Za-z0-9_]`, so it never fires between two
 * Hebrew letters: `/\bמתי\b/` is not a stricter match, it is a match that can
 * never succeed. Written as a plain literal, every Hebrew pattern in this file
 * silently found nothing — no error, no warning, just a Hebrew group getting an
 * empty commitments report. Letter/digit lookarounds instead, exactly as the
 * pseudonymiser does it, with the optional single-letter prefixes Hebrew glues
 * onto the front of a word.
 */
const HEBREW_PREFIX = '[\\u05D5\\u05D4\\u05D1\\u05DC\\u05DE\\u05E9\\u05DB]';
const he = (body: string, flags = ''): RegExp =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${HEBREW_PREFIX}{0,2}(?:${body})(?![\\p{L}\\p{N}])`,
    `u${flags}`,
  );
const COMMITMENTS: Record<ChatLanguage, Record<CommitmentKind, readonly RegExp[]>> = {
  en: {
    arriving: [
      /\b\d{1,2}\s*(?:min|mins|minutes)\b/i,
      /\bon (?:my|the) way\b/i,
      /\balmost (?:there|here)\b/i,
      /\b(?:omw|otw)\b/i,
      /\bleaving (?:now|in a)\b/i,
      /\bjust (?:parking|parked|outside|arrived)\b/i,
      /\btwo minutes\b/i,
      /\bcoming now\b/i,
    ],
    deferral: [
      /\btomorrow\b/i,
      /\bnext (?:week|month|time)\b/i,
      /\bsoon\b/i,
      /\blater\b/i,
      /\bafter the\b/i,
      /\bfrom (?:monday|sunday|the first)\b/i,
    ],
    undertaking: [
      /\bi'?ll (?:do|handle|sort|book|call|send|bring|organi[sz]e)\b/i,
      /\b(?:i'?m in|count me in|i'?ll be there|im coming|i'?m coming)\b/i,
      /\bi promise\b/i,
      /\bleave it (?:to|with) me\b/i,
      /\bon it\b/i,
    ],
  },
  he: {
    arriving: [
      /(?<![\p{L}\p{N}])\d{1,2}\s*דק(?:ות)?(?![\p{L}\p{N}])/u,
      he('בדרך'),
      he('כמעט'),
      he('יוצא|יוצאת') ,
      he('רגע'),
      he('תכף|תיכף'),
      he('מגיע|מגיעה'),
    ],
    deferral: [he('מחר'), he('בקרוב'), he('הבא'), he('כך'), he('ראשון')],
    undertaking: [
      he('מטפל|מטפלת'),
      he('מזמין|מזמינה'),
      he('בעניין'),
      he('סמכו|סמוך'),
      he('מבטיח|מבטיחה'),
    ],
  },
  other: { arriving: [], deferral: [], undertaking: [] },
};

const QUESTIONS: Record<ChatLanguage, Record<QuestionKind, readonly RegExp[]>> = {
  en: {
    when: [/\bwhen\b.*\?/i, /\bwhat time\b/i],
    where: [/\bwhere\b.*\?/i, /\bwhich place\b/i],
    who: [/\bwho(?:'s| is)? (?:coming|in|joining|around)\b/i, /\bwho else\b/i],
    what_plan: [/\bwhat(?:'s| is) the plan\b/i, /\bwhat are we doing\b/i, /\bany plans\b/i],
    confirm: [/\bare we (?:still|on|doing)\b/i, /\bis (?:it|this) still (?:on|happening)\b/i],
  },
  he: {
    when: [he('מתי'), /מ?באיזו? שעה/u, he('שעה')],
    where: [he('איפה'), he('לאן'), he('היכן')],
    who: [/מי (?:בא|באה|מגיע|מגיעה|בפנים|איתנו|עוד)/u],
    what_plan: [/מה (?:ה)?תוכנית/u, /מה עושים/u, /מה קורה עם/u, /מה הסיפור/u],
    confirm: [/(?:זה|אנחנו) עדיין/u, /זה קורה/u, /נשאר בתוקף/u],
  },
  other: { when: [], where: [], who: [], what_plan: [], confirm: [] },
};

/** How close together two "I'm arriving" claims must be to contradict. */
const ARRIVAL_WINDOW_MS = 4 * 60 * MINUTE;
/** And how many it takes before it is a pattern rather than a correction. */
const MIN_REPEATED_ARRIVALS = 3;

function firstMatch(body: string, patterns: readonly RegExp[]): string | null {
  for (const re of patterns) {
    const hit = re.exec(body);
    if (hit) return hit[0];
  }
  return null;
}

export function analyzeCommitments(
  parsed: ParseResult,
  language: ChatLanguage,
  options: { examplesPerPerson?: number } = {},
): CommitmentReport {
  const { examplesPerPerson = 5 } = options;

  const commitments = COMMITMENTS[language];
  const questions = QUESTIONS[language];

  const counts = new Map<string, Record<CommitmentKind, number>>();
  const examples = new Map<string, Hit[]>();
  const messageCounts = new Map<string, number>();

  const questionHits = new Map<QuestionKind, Hit[]>();
  const questionAskers = new Map<QuestionKind, Map<string, number>>();

  /** Arrival claims in order, so repeats within an evening can be found. */
  const arrivals: Hit[] = [];
  const arrivalTimes = new Map<number, number>();

  let scanned = 0;

  for (const m of parsed.messages) {
    if (m.kind !== 'text' || m.sender === null) continue;
    scanned++;
    increment(messageCounts, m.sender);
    const day = dayKey(m);

    for (const kind of ['arriving', 'deferral', 'undertaking'] as CommitmentKind[]) {
      const phrase = firstMatch(m.body, commitments[kind]);
      if (!phrase) continue;

      let row = counts.get(m.sender);
      if (!row) counts.set(m.sender, (row = { arriving: 0, deferral: 0, undertaking: 0 }));
      row[kind]++;

      const hit: Hit = { messageId: m.id, sender: m.sender, day, phrase };
      let ex = examples.get(m.sender);
      if (!ex) examples.set(m.sender, (ex = []));
      if (ex.length < examplesPerPerson) ex.push(hit);

      if (kind === 'arriving') {
        arrivals.push(hit);
        arrivalTimes.set(m.id, m.ts.getTime());
      }
    }

    if (m.body.includes('?') || language === 'he') {
      for (const kind of Object.keys(questions) as QuestionKind[]) {
        const phrase = firstMatch(m.body, questions[kind]);
        if (!phrase) continue;

        let hits = questionHits.get(kind);
        if (!hits) questionHits.set(kind, (hits = []));
        if (hits.length < 6) hits.push({ messageId: m.id, sender: m.sender, day, phrase });

        let askers = questionAskers.get(kind);
        if (!askers) questionAskers.set(kind, (askers = new Map()));
        increment(askers, m.sender);
      }
    }
  }

  /* --- the same person arriving several times in one evening -------- */
  const repeatedArrivals: RepeatedArrival[] = [];
  const bySenderDay = new Map<string, Hit[]>();
  for (const hit of arrivals) {
    const key = `${hit.sender} ${hit.day}`;
    let list = bySenderDay.get(key);
    if (!list) bySenderDay.set(key, (list = []));
    list.push(hit);
  }

  for (const [key, hits] of bySenderDay) {
    if (hits.length < MIN_REPEATED_ARRIVALS) continue;
    const [sender, day] = key.split(' ') as [string, string];

    // Cluster within the window: three arrivals at breakfast, lunch and dinner
    // are three journeys, not one lie.
    let run: Hit[] = [];
    const flush = () => {
      if (run.length < MIN_REPEATED_ARRIVALS) return;
      const first = arrivalTimes.get(run[0]!.messageId)!;
      const last = arrivalTimes.get(run[run.length - 1]!.messageId)!;
      repeatedArrivals.push({
        sender,
        day,
        claims: run.length,
        spanMinutes: Math.round((last - first) / MINUTE),
        messageIds: run.map((h) => h.messageId),
      });
    };

    for (const hit of hits) {
      const t = arrivalTimes.get(hit.messageId)!;
      if (run.length === 0 || t - arrivalTimes.get(run[run.length - 1]!.messageId)! <= ARRIVAL_WINDOW_MS) {
        run.push(hit);
      } else {
        flush();
        run = [hit];
      }
    }
    flush();
  }

  const people: CommitmentProfile[] = [...counts.entries()]
    .map(([sender, row]) => {
      const total = row.arriving + row.deferral + row.undertaking;
      const messages = messageCounts.get(sender) ?? 0;
      return {
        sender,
        counts: row,
        total,
        // Per hundred messages, so the quiet member who only ever says "on my
        // way" is not buried under whoever talks most.
        rate: messages === 0 ? 0 : (total / messages) * 100,
        examples: examples.get(sender) ?? [],
      };
    })
    .sort((a, b) => b.total - a.total);

  const questionProfiles: QuestionProfile[] = [...questionHits.entries()]
    .map(([kind, hits]) => {
      const askers = questionAskers.get(kind) ?? new Map<string, number>();
      const total = [...askers.values()].reduce((a, b) => a + b, 0);
      const top = [...askers.entries()].sort((a, b) => b[1] - a[1])[0];
      return { kind, count: total, topAsker: top?.[0] ?? null, examples: hits };
    })
    .sort((a, b) => b.count - a.count);

  return {
    people,
    repeatedArrivals: repeatedArrivals
      .sort((a, b) => b.claims - a.claims || a.day.localeCompare(b.day))
      .slice(0, 12),
    questions: questionProfiles,
    scanned,
  };
}

/**
 * Plans that kept being raised and kept not happening.
 *
 * A "plan word" — trip, booking, dinner, a named destination — that the group
 * returns to across many months without the vocabulary ever changing is the
 * shape of a plan that never got made. When something actually happens, the
 * language moves on with it: "should we book" becomes "who is driving" becomes
 * photographs.
 *
 * Reported as a *candidate*, with its evidence, for the model to argue about.
 * The determinism here is in finding the topic and proving it recurred; whether
 * it ever happened is a judgement, and this file does not pretend to make it.
 */
export type PlanCategory = 'travel' | 'gathering' | 'logistics';

export interface StalledPlan {
  /**
   * What kind of plan this is. Grouped rather than keyed on the matched word:
   * "trip", "hotel", "flights" and "spreadsheet" are one plan that never
   * happened, and reporting them separately produces four almost identical
   * slides about the same holiday.
   */
  category: PlanCategory;
  /** The words that actually appeared, most frequent first. Useful for copy. */
  topic: string;
  topics: string[];
  /** Months in which it came up. */
  months: string[];
  mentions: number;
  participants: string[];
  firstMessageId: number;
  lastMessageId: number;
  firstDay: string;
  lastDay: string;
  exampleMessageIds: number[];
  /** 0..1 — how much this looks stalled rather than merely discussed. */
  stallScore: number;
}

const PLAN_WORDS: Record<ChatLanguage, Record<PlanCategory, RegExp>> = {
  en: {
    travel: /\b(?:trips?|holidays?|vacations?|weekend away|airbnb|flights?|hotels?|bookings?|book it)\b/gi,
    gathering: /\b(?:dinner|barbecue|bbq|party|reunion|meetups?|picnic)\b/gi,
    logistics: /\b(?:spreadsheets?|polls?|doodle|group ?buy)\b/gi,
  },
  he: {
    travel: he('טיול|טיולים|חופשה|נופש|סופש|טיסה|טיסות|מלון|צימר|הזמנה', 'g'),
    gathering: he('ארוחה|מנגל|מסיבה|מפגש|פיקניק', 'g'),
    logistics: he('אקסל|סקר|טבלה', 'g'),
  },
  other: {
    travel: /(?!)/g,
    gathering: /(?!)/g,
    logistics: /(?!)/g,
  },
};

/**
 * Logistics words never form a plan on their own — a spreadsheet is evidence of
 * a plan, not one. They are folded into whichever real plan they co-occur with,
 * and dropped if there is none.
 */
const SUPPORTING: ReadonlySet<PlanCategory> = new Set<PlanCategory>(['logistics']);

export function findStalledPlans(
  parsed: ParseResult,
  language: ChatLanguage,
  options: { minMonths?: number; minMentions?: number; limit?: number } = {},
): StalledPlan[] {
  const { minMonths = 3, minMentions = 6, limit = 8 } = options;
  const patterns = PLAN_WORDS[language];

  interface Row {
    ids: number[];
    months: Set<string>;
    people: Set<string>;
    days: string[];
    words: Map<string, number>;
  }
  const rows = new Map<PlanCategory, Row>();
  /** Messages that mentioned a supporting word, so they can be folded in. */
  const supporting: { id: number; month: string; day: string; sender: string; word: string }[] = [];

  for (const m of parsed.messages) {
    if (m.kind !== 'text' || m.sender === null) continue;
    const month = `${m.localYear}-${String(m.localMonth).padStart(2, '0')}`;
    const day = dayKey(m);

    for (const category of Object.keys(patterns) as PlanCategory[]) {
      // A fresh regex index each time: these are /g and share state otherwise.
      patterns[category].lastIndex = 0;
      const hits = m.body.match(patterns[category]);
      if (!hits) continue;

      if (SUPPORTING.has(category)) {
        supporting.push({ id: m.id, month, day, sender: m.sender, word: hits[0]!.toLocaleLowerCase() });
        continue;
      }

      let row = rows.get(category);
      if (!row) {
        rows.set(
          category,
          (row = { ids: [], months: new Set(), people: new Set(), days: [], words: new Map() }),
        );
      }
      row.ids.push(m.id);
      row.months.add(month);
      row.people.add(m.sender);
      row.days.push(day);
      for (const hit of hits) increment(row.words, hit.toLocaleLowerCase());
    }
  }

  // Fold supporting mentions into a plan that was already running that month.
  // A spreadsheet in a month where the trip was discussed is part of the trip.
  for (const s of supporting) {
    for (const row of rows.values()) {
      if (!row.months.has(s.month)) continue;
      row.ids.push(s.id);
      row.people.add(s.sender);
      row.days.push(s.day);
      increment(row.words, s.word);
      break;
    }
  }

  const out: StalledPlan[] = [];
  for (const [category, row] of rows) {
    if (row.months.size < minMonths || row.ids.length < minMentions) continue;

    const months = [...row.months].sort();
    const days = row.days.slice().sort();
    const ids = [...new Set(row.ids)].sort((a, b) => a - b);
    const words = [...row.words.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([w]) => w);

    // Spread over a long time by few messages each month is the signature. A
    // topic discussed a hundred times in one month is an event, not a stall.
    const perMonth = ids.length / months.length;
    const stallScore = Math.min(
      1,
      Math.min(1, months.length / 12) * 0.6 + Math.min(1, 4 / Math.max(1, perMonth)) * 0.4,
    );

    out.push({
      category,
      topic: words[0] ?? category,
      topics: words.slice(0, 6),
      months,
      mentions: ids.length,
      participants: [...row.people],
      firstMessageId: ids[0]!,
      lastMessageId: ids[ids.length - 1]!,
      firstDay: days[0]!,
      lastDay: days[days.length - 1]!,
      // Spread across the plan's life, so the evidence shows the same
      // conversation happening in 2023 and again in 2026.
      exampleMessageIds: pickSpread(ids, 6),
      stallScore,
    });
  }

  return out.sort((a, b) => b.stallScore * b.mentions - a.stallScore * a.mentions).slice(0, limit);
}

function pickSpread(ids: readonly number[], n: number): number[] {
  if (ids.length <= n) return [...ids];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(ids[Math.floor((i * (ids.length - 1)) / (n - 1))]!);
  return out;
}

/** Every message backing a stalled plan, for the receipts drawer. */
export function planMessages(parsed: ParseResult, plan: StalledPlan): Message[] {
  const wanted = new Set(plan.exampleMessageIds);
  return parsed.messages.filter((m) => wanted.has(m.id));
}
