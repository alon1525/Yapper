import type { Message, ParseResult } from '../types';
import { countLaughter } from '../stats/text';
import { isSubstantive } from '../stats/samples';

/**
 * Deterministic candidate-moment detection.
 *
 * The point of this module is cost control. Chunking an 18k-message export and
 * asking a model "find the funny parts" burns tokens on thousands of messages
 * that were never interesting. Instead we score conversation bursts in plain
 * TypeScript and hand the model only the top few dozen windows.
 *
 * Nothing here calls an AI, and nothing here leaves the device.
 */

const MINUTE = 60_000;

/** Messages closer together than this belong to the same burst. */
const BURST_GAP_MS = 10 * MINUTE;
/** A burst below this size is not a moment, it is two people saying "ok". */
const MIN_BURST_MESSAGES = 6;

export interface MomentSignals {
  /** Messages per minute across the burst. */
  density: number;
  /** How many times the burst's density exceeds the chat's typical burst. */
  densityRatio: number;
  laughs: number;
  laughRate: number;
  participants: number;
  /** Hours of silence immediately before the burst. */
  silenceBeforeHours: number;
  /** Median gap between messages, in seconds — low means rapid-fire. */
  medianGapSeconds: number;
  /** Mean message length; high suggests a rant or a serious exchange. */
  meanLength: number;
  questions: number;
  /** Fraction of messages sent between midnight and 05:00. */
  nightShare: number;
  /** Fraction of messages that carry readable text rather than a reaction. */
  readableShare: number;
}

export interface MomentWindow {
  id: string;
  /** Inclusive indices into `ParseResult.messages`. */
  startId: number;
  endId: number;
  day: string;
  startHour: number;
  messageCount: number;
  participants: string[];
  score: number;
  signals: MomentSignals;
  /** Human-readable reasons this window scored, for debugging and UI. */
  reasons: string[];
}

export interface MomentOptions {
  /** How many windows to keep. Defaults to 30. */
  limit?: number;
  /** Cap on messages carried in one window when handed to a model. */
  maxMessagesPerWindow?: number;
  /**
   * Least share of a window that must be readable text for it to be a
   * candidate at all, from 0 (any window) to 1 (every message).
   *
   * Defaults to 0, which is the behaviour every caller had before this option
   * existed. It is not the right default so much as the safe one: the free
   * preview and the detective both rank against these scores, and quietly
   * moving the floor under them would reshape decks nobody asked to change.
   *
   * The reason it exists: this scorer rewards laughter and density, which is
   * precisely the signature of a sticker landing. On a real 25,812-message
   * export the top-scoring window was six media placeholders and one word, and
   * 42% of everything the model was shown was `<unknown>` or a bare `חחחח`.
   * Those windows score highest and say least. The paid report passes a floor
   * here; nothing else does yet.
   */
  minReadableShare?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Split the conversation into bursts of closely-spaced messages. */
function findBursts(msgs: Message[]): { start: number; end: number }[] {
  const bursts: { start: number; end: number }[] = [];
  if (msgs.length === 0) return bursts;

  let start = 0;
  for (let i = 1; i < msgs.length; i++) {
    const gap = msgs[i]!.ts.getTime() - msgs[i - 1]!.ts.getTime();
    if (gap > BURST_GAP_MS) {
      bursts.push({ start, end: i - 1 });
      start = i;
    }
  }
  bursts.push({ start, end: msgs.length - 1 });
  return bursts;
}

export function findCandidateMoments(
  parsed: ParseResult,
  options: MomentOptions = {},
): MomentWindow[] {
  const { limit = 30, minReadableShare = 0 } = options;

  // System messages would distort density and never carry a moment.
  const msgs = parsed.messages.filter((m) => m.kind !== 'system');
  if (msgs.length < MIN_BURST_MESSAGES) return [];

  const bursts = findBursts(msgs).filter((b) => b.end - b.start + 1 >= MIN_BURST_MESSAGES);
  if (bursts.length === 0) return [];

  // Baseline is the chat's own typical burst, not an absolute number — 40
  // messages in an hour is chaos in a quiet group and a slow Tuesday in a loud
  // one, and only the relative version is ever funny.
  const rawDensities = bursts.map((b) => {
    const span = msgs[b.end]!.ts.getTime() - msgs[b.start]!.ts.getTime();
    return (b.end - b.start + 1) / Math.max(1, span / MINUTE);
  });
  const baselineDensity = median(rawDensities) || 1;

  const scored: MomentWindow[] = bursts.map((b, idx) => {
    const window = msgs.slice(b.start, b.end + 1);
    const count = window.length;
    const spanMs = msgs[b.end]!.ts.getTime() - msgs[b.start]!.ts.getTime();
    const density = count / Math.max(1, spanMs / MINUTE);

    let laughs = 0;
    let questions = 0;
    let lengthSum = 0;
    let nightCount = 0;
    let readable = 0;
    const people = new Set<string>();
    const gaps: number[] = [];

    for (let i = 0; i < window.length; i++) {
      const m = window[i]!;
      if (m.sender) people.add(m.sender);
      if (isSubstantive(m)) readable++;
      if (m.kind === 'text') {
        laughs += countLaughter(m.body);
        if (m.body.includes('?')) questions++;
        lengthSum += m.body.length;
      }
      if (m.localHour < 5) nightCount++;
      if (i > 0) gaps.push((m.ts.getTime() - window[i - 1]!.ts.getTime()) / 1000);
    }

    const prevIdx = b.start - 1;
    const silenceBeforeHours =
      prevIdx >= 0
        ? (msgs[b.start]!.ts.getTime() - msgs[prevIdx]!.ts.getTime()) / (60 * MINUTE)
        : 0;

    const signals: MomentSignals = {
      density,
      densityRatio: density / baselineDensity,
      laughs,
      laughRate: laughs / count,
      participants: people.size,
      silenceBeforeHours,
      medianGapSeconds: median(gaps),
      meanLength: lengthSum / count,
      questions,
      nightShare: nightCount / count,
      readableShare: readable / count,
    };

    const reasons: string[] = [];
    let score = 0;

    // Laughter is the single strongest cheap signal that something was funny.
    if (signals.laughs > 0) {
      const s = Math.min(3, signals.laughRate * 6) + Math.min(2, signals.laughs / 5);
      score += s * 2.5;
      reasons.push(`${signals.laughs} bursts of laughter`);
    }

    if (signals.densityRatio > 1.5) {
      score += Math.min(3, Math.log2(signals.densityRatio)) * 1.5;
      reasons.push(`${signals.densityRatio.toFixed(1)}x the usual pace`);
    }

    // A long silence broken by a sudden burst is almost always a story.
    if (signals.silenceBeforeHours > 24) {
      score += Math.min(3, Math.log2(signals.silenceBeforeHours / 12));
      reasons.push(`erupted after ${Math.round(signals.silenceBeforeHours / 24)} quiet days`);
    }

    if (signals.participants >= 3) {
      score += Math.min(2, (signals.participants - 2) * 0.75);
      reasons.push(`${signals.participants} people involved`);
    }

    // Rapid-fire short messages read as an argument or a pile-on.
    if (signals.medianGapSeconds < 30 && signals.meanLength < 60 && count >= 15) {
      score += 2;
      reasons.push('rapid-fire exchange');
    }

    // Long messages in a busy window read as a rant or a serious moment.
    if (signals.meanLength > 180) {
      score += 1.5;
      reasons.push('unusually long messages');
    }

    if (signals.questions >= 5) {
      score += 1;
      reasons.push(`${signals.questions} questions flying around`);
    }

    if (signals.nightShare > 0.6 && count >= 10) {
      score += 1.5;
      reasons.push('happened in the middle of the night');
    }

    // Mild preference for larger windows — more material for the model to work
    // with — but sub-linear so one endless day cannot dominate the ranking.
    score += Math.log2(count) * 0.5;

    return {
      id: `w${idx}`,
      startId: msgs[b.start]!.id,
      endId: msgs[b.end]!.id,
      day: `${msgs[b.start]!.localYear}-${String(msgs[b.start]!.localMonth).padStart(2, '0')}-${String(
        msgs[b.start]!.localDay,
      ).padStart(2, '0')}`,
      startHour: msgs[b.start]!.localHour,
      messageCount: count,
      participants: [...people],
      score,
      signals,
      reasons,
    };
  });

  return scored
    .filter((w) => w.signals.readableShare >= minReadableShare)
    .sort((a, b) => b.score - a.score || a.startId - b.startId)
    .slice(0, limit);
}

/**
 * The messages inside a window, ready to be shown or (after anonymisation)
 * handed to a model. Capped so one enormous burst cannot blow up a prompt.
 */
export function getWindowMessages(
  parsed: ParseResult,
  window: MomentWindow,
  maxMessages = 60,
): Message[] {
  const slice = parsed.messages.filter(
    (m) => m.id >= window.startId && m.id <= window.endId && m.kind !== 'system',
  );
  if (slice.length <= maxMessages) return slice;

  // Keep the head and tail: the setup and the payoff both matter, the middle
  // of a long pile-on usually does not.
  const head = Math.ceil(maxMessages / 2);
  const tail = maxMessages - head;
  return [...slice.slice(0, head), ...slice.slice(slice.length - tail)];
}
