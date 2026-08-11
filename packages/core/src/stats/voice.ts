import type { Counted } from './types';
import type { ParseResult } from '../types';
import type { ChatLanguage } from '../lang/language';
import { minWordLength, stopwordsFor, wordSegmenterFor } from '../lang/language';
import { extractWords, increment } from './text';

/**
 * What makes one person in a group sound like themselves.
 *
 * "Top words" per person is nearly useless for this: in any group the loudest
 * words are the same for everyone, so every profile comes out identical. What
 * distinguishes a person is the word they use far more than the rest of the
 * group does — the verbal tic the others would recognise instantly and could
 * not name. That is a ratio, not a count.
 *
 * Deterministic and local, like everything else in this package. No AI sees a
 * chat to produce this; it only ever receives the result.
 */

export interface VoiceProfile {
  name: string;
  /** Words this person uses disproportionately, most distinctive first. */
  distinctive: Counted[];
  /** Mean characters per message — the essayist/one-word-reply axis. */
  meanLength: number;
  /** Share of this person's messages that ask something. */
  questionShare: number;
  /** Share that are a single word — the "ok" reflex. */
  oneWordShare: number;
}

/**
 * A word must clear this many uses by one person before its ratio means
 * anything. Without a floor, every profile is built from typos: a word said
 * once by one person has an infinite ratio and zero significance.
 */
const MIN_USES = 4;

export function computeVoiceProfiles(
  parsed: ParseResult,
  language: ChatLanguage,
  limit = 6,
): VoiceProfile[] {
  const stopwords = stopwordsFor(language);
  const floor = minWordLength(language);
  const segmenter = wordSegmenterFor(language);

  const perPerson = new Map<string, Map<string, number>>();
  const groupCounts = new Map<string, number>();
  let groupTotal = 0;

  const meta = new Map<string, { messages: number; chars: number; questions: number; oneWord: number }>();

  for (const message of parsed.messages) {
    if (message.kind !== 'text' || message.sender === null) continue;

    const words = extractWords(message.body, stopwords, floor, segmenter);

    let counts = perPerson.get(message.sender);
    if (!counts) perPerson.set(message.sender, (counts = new Map()));

    for (const word of words) {
      increment(counts, word);
      increment(groupCounts, word);
      groupTotal++;
    }

    let m = meta.get(message.sender);
    if (!m) meta.set(message.sender, (m = { messages: 0, chars: 0, questions: 0, oneWord: 0 }));
    m.messages++;
    m.chars += message.body.length;
    if (message.body.includes('?')) m.questions++;
    if (message.body.trim().split(/\s+/).length === 1) m.oneWord++;
  }

  return parsed.participants.map((name) => {
    const counts = perPerson.get(name) ?? new Map<string, number>();
    const own = [...counts.values()].reduce((a, b) => a + b, 0);
    const m = meta.get(name) ?? { messages: 0, chars: 0, questions: 0, oneWord: 0 };

    const distinctive: Counted[] = [...counts.entries()]
      .filter(([, count]) => count >= MIN_USES)
      .map(([value, count]) => {
        // How much more of this person's vocabulary the word occupies than it
        // occupies of the group's. Both sides are shares, so a prolific talker
        // does not automatically win every word.
        const mine = count / Math.max(1, own);
        const theirs = (groupCounts.get(value) ?? 0) / Math.max(1, groupTotal);
        return { value, count, ratio: mine / Math.max(theirs, 1e-9) };
      })
      .sort((a, b) => b.ratio - a.ratio || b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, limit)
      .map(({ value, count }) => ({ value, count }));

    return {
      name,
      distinctive,
      meanLength: m.messages > 0 ? m.chars / m.messages : 0,
      questionShare: m.messages > 0 ? m.questions / m.messages : 0,
      oneWordShare: m.messages > 0 ? m.oneWord / m.messages : 0,
    };
  });
}
