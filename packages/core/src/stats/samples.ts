import type { Message, ParseResult } from '../types';
import { countLaughter, stripLaughter } from './text';

/**
 * Which messages are worth showing a model, and which of a person's own lines
 * to show it.
 *
 * The paid report kept coming back generic, and the reason was upstream of the
 * prompt: the model was handed percentages and one "longest message" per
 * person, and on a real export three of four longest messages turned out to be
 * forwarded chain letters and packing lists. A character card written from that
 * is a horoscope, because a horoscope is the only thing that material supports.
 *
 * So this module answers two questions in plain TypeScript, before anything is
 * sent anywhere:
 *
 *   - Does this message contain anything to read? (`isSubstantive`)
 *   - Which two dozen of this person's messages sound most like them?
 *     (`pickVoiceSamples`)
 *
 * Both are deterministic and local. Nothing here calls a model.
 */

/**
 * Characters of actual content a message needs before it counts as readable.
 *
 * Measured after laughter, emoji, links and punctuation come out, so this is a
 * floor on letters rather than on length. Deliberately low: `בא לי` is four
 * characters and is a real thing somebody said, while `חחחחחחח` is seven and is
 * not. Kept low enough that a CJK sentence — which says as much in six
 * characters as English does in twenty — is never mistaken for noise.
 */
const MIN_SUBSTANCE = 5;

const LINK_RE = /\bhttps?:\/\/\S+/gi;
const PICTOGRAPH_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/gu;
const NON_CONTENT_RE = /[\p{P}\p{S}\p{Z}\s]+/gu;

/** Content characters left once laughter, emoji, links and punctuation go. */
export function substanceOf(body: string): number {
  const bare = stripLaughter(body)
    .replace(LINK_RE, ' ')
    .replace(PICTOGRAPH_RE, ' ')
    .replace(NON_CONTENT_RE, '');
  return [...bare].length;
}

/**
 * True when a message carries readable text.
 *
 * False for attachments and deletions — `<image>` in a transcript tells a model
 * that something was sent and nothing about what it was — and false for the
 * pure-reaction messages that make up most of a fast group chat.
 */
export function isSubstantive(message: Message): boolean {
  if (message.kind !== 'text') return false;
  return substanceOf(message.body) >= MIN_SUBSTANCE;
}

/**
 * True for text that was pasted rather than written.
 *
 * Forwarded chain letters, trip packing lists and the group's own logistics
 * spreadsheets are all long, and length is what "their longest message" selects
 * for — which is how a character card ends up built from a pre-military academy
 * recruitment letter somebody forwarded once.
 *
 * The test is shape, not length alone. A four-hundred-word rant typed in one
 * breath has no line breaks and is the single most characteristic thing a
 * person ever sent; a list of what to bring has bullets. Only the second one
 * is thrown away.
 */
export function looksPasted(body: string): boolean {
  const lines = body.split(/\r?\n/);
  const bulleted = lines.filter((line) => /^\s*(?:[•*\-–—▪◦]|\d+[.)])\s/u.test(line)).length;
  if (bulleted >= 3) return true;
  return body.length > 450 && lines.length >= 4;
}

export interface VoiceSampleOptions {
  /** Messages to keep per person. */
  perPerson?: number;
  /** Shortest sample worth carrying, in raw characters. */
  minChars?: number;
  /** Longest. Above this a single message crowds out a whole person. */
  maxChars?: number;
}

/**
 * How far ahead a laugh still counts as a reaction to what was just said.
 * Beyond this it is a reaction to something else.
 */
const REACTION_LOOKAHEAD = 6;
const REACTION_WINDOW_MS = 10 * 60_000;

/** How many of a person's slots go to their best lines rather than a spread. */
const HIGHLIGHT_SHARE = 0.35;

/**
 * How many laughs each message drew out of *other people* just after it.
 *
 * Self-laughter is excluded deliberately. Someone who ends every message with
 * `חחח` would otherwise be scored as the funniest person in the chat, when what
 * that actually measures is a verbal tic — one already visible in their
 * distinctive words.
 */
function laughterDrawn(messages: readonly Message[]): Map<number, number> {
  const drawn = new Map<number, number>();

  for (let i = 0; i < messages.length; i++) {
    const source = messages[i]!;
    if (source.kind !== 'text' || source.sender === null) continue;

    let laughs = 0;
    for (let j = i + 1; j < messages.length && j <= i + REACTION_LOOKAHEAD; j++) {
      const reply = messages[j]!;
      if (reply.ts.getTime() - source.ts.getTime() > REACTION_WINDOW_MS) break;
      if (reply.sender === null || reply.sender === source.sender) continue;
      laughs += countLaughter(reply.body);
    }
    if (laughs > 0) drawn.set(source.id, laughs);
  }

  return drawn;
}

/**
 * A spread of each person's own messages, in their own words.
 *
 * Two kinds of line, mixed on purpose. Most slots go to an even spread across
 * everything they ever sent, so the sample shows the register they write in
 * rather than a highlight reel — the same reasoning the free writer's sample
 * uses. The rest go to the lines that actually made other people laugh, because
 * a report that never sees anybody's best material cannot mention it.
 *
 * Returned keyed by the real sender name. Anonymising, if the caller needs it,
 * is the caller's job — the free path pseudonymises these, the paid path does
 * not.
 */
export function pickVoiceSamples(
  parsed: ParseResult,
  options: VoiceSampleOptions = {},
): Map<string, Message[]> {
  const { perPerson = 24, minChars = 12, maxChars = 500 } = options;

  const drawn = laughterDrawn(parsed.messages);

  const eligible = new Map<string, Message[]>();
  for (const message of parsed.messages) {
    if (message.sender === null) continue;
    if (!isSubstantive(message)) continue;

    const body = message.body.trim();
    if (body.length < minChars || body.length > maxChars) continue;
    if (looksPasted(body)) continue;

    const bucket = eligible.get(message.sender);
    if (bucket) bucket.push(message);
    else eligible.set(message.sender, [message]);
  }

  const out = new Map<string, Message[]>();

  for (const [sender, messages] of eligible) {
    const chosen = new Map<number, Message>();

    // The lines that landed. Ties break on id so the result is stable across
    // runs, which matters because two identical exports must produce two
    // identical prompts.
    const highlightSlots = Math.round(perPerson * HIGHLIGHT_SHARE);
    const highlights = messages
      .filter((m) => drawn.has(m.id))
      .sort((a, b) => (drawn.get(b.id) ?? 0) - (drawn.get(a.id) ?? 0) || a.id - b.id)
      .slice(0, highlightSlots);
    for (const m of highlights) chosen.set(m.id, m);

    // Then the ordinary register, spread evenly over their whole history. The
    // step is computed against the slots still open, so a person whose
    // highlights filled half the quota still gets a spread across the rest of
    // what they said rather than a spread across the first half of it.
    const remaining = perPerson - chosen.size;
    if (remaining > 0) {
      const step = Math.max(1, Math.floor(messages.length / remaining));
      for (let i = 0; i < messages.length && chosen.size < perPerson; i += step) {
        const m = messages[i]!;
        if (!chosen.has(m.id)) chosen.set(m.id, m);
      }
      // An even step can fall short when it collides with highlights it already
      // holds. Top up from whatever is left rather than returning a short list.
      for (let i = 0; i < messages.length && chosen.size < perPerson; i++) {
        const m = messages[i]!;
        if (!chosen.has(m.id)) chosen.set(m.id, m);
      }
    }

    out.set(
      sender,
      [...chosen.values()].sort((a, b) => a.id - b.id),
    );
  }

  return out;
}
