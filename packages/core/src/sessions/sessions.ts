import type { ChatLanguage } from '../lang/language';
import { minWordLength, stopwordsFor } from '../lang/language';
import { dayKey } from '../stats/stats';
import { countLaughter, extractWords, increment, topEntries } from '../stats/text';
import type { Message, ParseResult } from '../types';

/**
 * Conversation segmentation.
 *
 * `moments/moments.ts` already splits the chat into bursts on a fixed ten-minute
 * gap and scores them for "was this funny". This is a different job: cutting the
 * chat into the units a *reader* would call conversations, so that every later
 * stage — candidate extraction, the detective's excerpts, a nostalgia slide —
 * addresses something coherent rather than an arbitrary window.
 *
 * Two things make this more than a gap threshold:
 *
 *  1. **The threshold is the chat's own.** Ninety minutes of silence is a break
 *     in a group that talks all day and is nothing at all in a group that
 *     exchanges four messages a week. The cut is taken from a high percentile of
 *     the chat's own inter-message gaps, so both behave sensibly.
 *
 *  2. **A long burst can contain two conversations.** Groups pivot without
 *     pausing — the restaurant argument ends and the football argument starts in
 *     the same minute. Sessions are therefore split again wherever the
 *     vocabulary turns over almost completely across a short lull.
 *
 * Deterministic, local, and free of any model. Nothing here leaves the device.
 */

const MINUTE = 60_000;

export interface Conversation {
  /**
   * `c<first message id>`. Stable across re-parses and across the roster step,
   * because message ids are, which is what lets a finding cite a conversation
   * and still mean the same one later.
   */
  id: string;
  /** Inclusive ids into `ParseResult.messages`. */
  startId: number;
  endId: number;
  startDay: string;
  endDay: string;
  startHour: number;
  messageCount: number;
  /** Everyone who said something, most talkative first. */
  participants: string[];
  /** Content words that characterise this conversation. */
  keywords: string[];
  /** Minutes from first message to last. */
  durationMinutes: number;

  /* --- scores, all 0..1 unless noted --- */
  /** Messages per minute against the chat's own typical pace. Unbounded. */
  intensity: number;
  /** How much of the group showed up, against how many usually do. */
  engagement: number;
  laughter: number;
  /** Rapid short exchanges, negation, shouting — an argument, not a chat. */
  conflict: number;
  /** How much later material refers back to this. Filled by `scoreRecall`. */
  recall: number;
  /** Composite: what to hand a model first. */
  comedy: number;
  /** Neutral one-liner. No names — participants are a separate field. */
  summary: string;
}

export interface SessionOptions {
  /**
   * Percentile of the chat's own gap distribution used as the session break.
   * Defaults to 0.9 — the slowest tenth of gaps are treated as breaks.
   */
  gapPercentile?: number;
  /** Floor and ceiling on the derived threshold, in minutes. */
  minGapMinutes?: number;
  maxGapMinutes?: number;
  /** Sessions shorter than this are folded into neighbours for scoring. */
  minMessages?: number;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx]!;
}

/**
 * Words that mark an argument rather than a conversation.
 *
 * Not sentiment analysis — a lexicon this size cannot do sentiment, and one that
 * tried would mostly detect swearing, which in most group chats is punctuation.
 * These are disagreement markers specifically: contradiction, accusation and
 * the second person singular showing up where it usually does not.
 */
const CONFLICT_MARKERS: Record<ChatLanguage, readonly RegExp[]> = {
  en: [
    /\b(?:no|nope|not true|wrong|nonsense|bullshit|rubbish)\b/i,
    /\b(?:you (?:always|never|said|promised)|didn'?t|won'?t|can'?t)\b/i,
    /\b(?:seriously|are you kidding|what the|come on)\b/i,
    /\b(?:actually|literally|whatever|fine\.)\b/i,
  ],
  /*
    No `\b` anywhere here. JavaScript defines it on [A-Za-z0-9_], so it cannot
    fire between two Hebrew letters — a Hebrew pattern written with word
    boundaries matches nothing at all, silently, and the group simply never
    registers an argument. Multi-word phrases are matched as written; single
    words use explicit letter lookarounds.
  */
  he: [
    /לא נכון|שטויות|בולשיט|מה פתאום/u,
    /(?:אתה|את) (?:תמיד|אף פעם)|הבטחת|אמרת ש/u,
    /ברצינות|נו באמת/u,
  ],
  other: [],
};

function conflictScore(window: readonly Message[], language: ChatLanguage): number {
  const markers = CONFLICT_MARKERS[language];
  if (window.length < 4) return 0;

  let hits = 0;
  let shouting = 0;
  let laughs = 0;
  let text = 0;

  for (const m of window) {
    if (m.kind !== 'text') continue;
    text++;
    for (const re of markers) {
      if (re.test(m.body)) {
        hits++;
        break;
      }
    }
    // Sustained capitals, not a stray acronym. Latin only — Hebrew has no case,
    // so a Hebrew argument is detected by its markers alone.
    const letters = m.body.match(/[A-Za-z]/g)?.length ?? 0;
    const upper = m.body.match(/[A-Z]/g)?.length ?? 0;
    if (letters >= 8 && upper / letters > 0.7) shouting++;
    laughs += countLaughter(m.body);
  }

  if (text === 0) return 0;

  const marked = hits / text;
  const shouted = shouting / text;
  // Laughter is the strongest evidence *against* a fight. A row that everybody
  // found funny was a bit, and putting it on a slide as an argument misreads
  // the room — which is the exact failure the specification warns about when it
  // says not to confuse joking statements with serious ones.
  const amusement = Math.min(1, laughs / text);

  return Math.max(0, Math.min(1, (marked * 1.6 + shouted * 1.2) * (1 - amusement)));
}

/**
 * Where the subject changed.
 *
 * Compares the vocabulary of the messages either side of each candidate point.
 * A near-total turnover means the group moved on; overlap means they did not.
 * Only consulted at points that already have *some* lull, because groups
 * interleave two topics constantly and cutting on vocabulary alone shreds a
 * normal conversation into confetti.
 */
function topicShift(before: readonly string[], after: readonly string[]): number {
  if (before.length < 4 || after.length < 4) return 0;
  const a = new Set(before);
  const b = new Set(after);
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : 1 - shared / union;
}

export function segmentConversations(
  parsed: ParseResult,
  language: ChatLanguage,
  options: SessionOptions = {},
): Conversation[] {
  const {
    gapPercentile = 0.9,
    minGapMinutes = 20,
    maxGapMinutes = 12 * 60,
    minMessages = 3,
  } = options;

  // System notices are not conversation. Left in, "X was added to the group"
  // opens a session of its own and every silence statistic shifts.
  const msgs = parsed.messages.filter((m) => m.kind !== 'system');
  if (msgs.length === 0) return [];

  const stopwords = stopwordsFor(language);
  const floor = minWordLength(language);

  /* --- the chat's own idea of a pause ------------------------------- */
  const gaps: number[] = [];
  for (let i = 1; i < msgs.length; i++) {
    // Real exports are not sorted; a backwards step is not a gap.
    gaps.push(Math.max(0, msgs[i]!.ts.getTime() - msgs[i - 1]!.ts.getTime()));
  }
  gaps.sort((a, b) => a - b);

  const derived = percentile(gaps, gapPercentile) / MINUTE;
  const breakMinutes = Math.min(maxGapMinutes, Math.max(minGapMinutes, derived));
  const breakMs = breakMinutes * MINUTE;

  /* --- pass 1: cut on silence --------------------------------------- */
  const cuts: number[] = [0];
  for (let i = 1; i < msgs.length; i++) {
    const gap = msgs[i]!.ts.getTime() - msgs[i - 1]!.ts.getTime();
    if (gap >= breakMs) cuts.push(i);
  }
  cuts.push(msgs.length);

  /* --- pass 2: cut long stretches again where the subject turned over */
  const words: string[][] = msgs.map((m) =>
    m.kind === 'text' ? extractWords(m.body, stopwords, floor) : [],
  );

  const LOOKAROUND = 8;
  const SHIFT_THRESHOLD = 0.92;
  /** A pivot is only credible if the group at least drew breath. */
  const PIVOT_LULL_MS = Math.max(3 * MINUTE, breakMs * 0.25);

  const refined: number[] = [];
  for (let c = 0; c < cuts.length - 1; c++) {
    const start = cuts[c]!;
    const end = cuts[c + 1]!;
    refined.push(start);
    if (end - start < LOOKAROUND * 3) continue;

    for (let i = start + LOOKAROUND; i < end - LOOKAROUND; i++) {
      const lull = msgs[i]!.ts.getTime() - msgs[i - 1]!.ts.getTime();
      if (lull < PIVOT_LULL_MS) continue;

      const before = words.slice(i - LOOKAROUND, i).flat();
      const after = words.slice(i, i + LOOKAROUND).flat();
      if (topicShift(before, after) >= SHIFT_THRESHOLD) {
        refined.push(i);
        i += LOOKAROUND; // do not cut twice inside one pivot
      }
    }
  }
  refined.push(msgs.length);

  /* --- build --------------------------------------------------------- */
  // The chat's own baselines, so a score means "loud for this group".
  const typicalPeople =
    msgs.length > 0 ? Math.max(1, Math.min(parsed.participants.length, 3)) : 1;

  const out: Conversation[] = [];
  for (let c = 0; c < refined.length - 1; c++) {
    const start = refined[c]!;
    const end = refined[c + 1]!;
    if (end - start < minMessages) continue;

    const window = msgs.slice(start, end);
    const first = window[0]!;
    const last = window[window.length - 1]!;

    const perPerson = new Map<string, number>();
    const wordCounts = new Map<string, number>();
    let laughs = 0;
    let textCount = 0;

    for (let i = start; i < end; i++) {
      const m = msgs[i]!;
      if (m.sender) increment(perPerson, m.sender);
      if (m.kind === 'text') {
        textCount++;
        laughs += countLaughter(m.body);
        for (const w of words[i]!) increment(wordCounts, w);
      }
    }

    const durationMs = Math.max(0, last.ts.getTime() - first.ts.getTime());
    const durationMinutes = durationMs / MINUTE;
    const density = window.length / Math.max(1, durationMinutes);

    const participants = [...perPerson.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    const keywords = topEntries(wordCounts, 8).map((e) => e.value);
    const laughter = textCount === 0 ? 0 : Math.min(1, laughs / textCount);
    const engagement = Math.min(1, participants.length / typicalPeople);
    const conflict = conflictScore(window, language);

    out.push({
      id: `c${first.id}`,
      startId: first.id,
      endId: last.id,
      startDay: dayKey(first),
      endDay: dayKey(last),
      startHour: first.localHour,
      messageCount: window.length,
      participants,
      keywords,
      durationMinutes: Math.round(durationMinutes),
      intensity: density,
      engagement,
      laughter,
      conflict,
      recall: 0,
      // Weighted towards laughter because it is the only signal here that is
      // direct evidence rather than a proxy: everything else says "something
      // was happening", laughter says "they enjoyed it".
      comedy: Math.min(
        1,
        laughter * 0.55 +
          engagement * 0.2 +
          Math.min(1, Math.log2(1 + window.length) / 6) * 0.15 +
          Math.min(1, density / 4) * 0.1,
      ),
      summary:
        `${window.length} messages over ${Math.max(1, Math.round(durationMinutes))} min` +
        `, ${participants.length} ${participants.length === 1 ? 'person' : 'people'}` +
        (keywords.length > 0 ? `, about: ${keywords.slice(0, 5).join(', ')}` : ''),
    });
  }

  return out;
}

/**
 * How often a conversation's own vocabulary comes back later.
 *
 * This is the closest a text export gets to "the group still references this".
 * A phrase coined on one night and repeated for two years is the definition of
 * an inside joke, and it is the one nostalgia signal that does not reduce to
 * "this happened a long time ago" — which is true of every old message and
 * therefore worth nothing.
 *
 * Mutates `recall` in place and returns the same array, because every caller
 * wants the scored version and a second parallel array is one more thing to keep
 * aligned.
 */
export function scoreRecall(conversations: Conversation[], parsed: ParseResult): Conversation[] {
  if (conversations.length === 0) return conversations;

  // Where each word is first used, and how often it is used overall.
  const total = new Map<string, number>();
  for (const c of conversations) for (const k of c.keywords) increment(total, k);

  for (const c of conversations) {
    // Only words that are *distinctive* to this conversation can be evidence
    // that it is being recalled. A conversation whose keywords are the group's
    // everyday vocabulary is not being referenced; it is just made of words.
    let echoed = 0;
    let distinctive = 0;
    for (const k of c.keywords) {
      const uses = total.get(k) ?? 1;
      if (uses <= 1) continue; // never came back at all
      // "Everyday word" needs a floor as well as a share. In a chat with five
      // conversations, a fifth of them is one — which would classify every word
      // used twice as vocabulary rather than as a callback, and score every
      // short chat's recall at exactly zero.
      if (uses > Math.max(3, conversations.length * 0.2)) continue;
      distinctive++;
      echoed += Math.min(4, uses - 1);
    }
    c.recall = distinctive === 0 ? 0 : Math.min(1, echoed / (distinctive * 3));
  }

  return conversations;
}

/** The messages inside one conversation, capped head-and-tail like a moment. */
export function conversationMessages(
  parsed: ParseResult,
  conversation: Conversation,
  maxMessages = 40,
): Message[] {
  const slice = parsed.messages.filter(
    (m) => m.id >= conversation.startId && m.id <= conversation.endId && m.kind !== 'system',
  );
  if (slice.length <= maxMessages) return slice;

  // Setup and payoff both matter; the middle of a long pile-on rarely does.
  const head = Math.ceil(maxMessages / 2);
  return [...slice.slice(0, head), ...slice.slice(slice.length - (maxMessages - head))];
}
