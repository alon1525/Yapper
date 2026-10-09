import type { Message, ParseResult } from '../types';

/**
 * Who WhatsApp could not name for you.
 *
 * An export writes whatever the exporting phone's address book knew at the
 * time. For anyone not saved as a contact that is the raw number, and the
 * `~push name` WhatsApp shows inside the app is nowhere in the file — it is
 * profile data fetched live from WhatsApp's servers, not exported text.
 * Checked against a real export: the only system notices naming an unsaved
 * member read `+972 58-666-8048 left`, which is no name at all.
 *
 * So it cannot be recovered, only asked for. These helpers find the people
 * worth asking about and apply the answer.
 */

/**
 * True when a display name is really just a phone number. Deliberately strict:
 * a real name containing digits ("Yanku2") must not be mistaken for an unsaved
 * contact, so a single letter anywhere disqualifies it.
 */
export function isUnsavedSender(name: string): boolean {
  if (/\p{L}/u.test(name)) return false;
  return (name.match(/\d/g) ?? []).length >= 7;
}

export function unsavedParticipants(parsed: ParseResult): string[] {
  return parsed.participants.filter(isUnsavedSender);
}

/** One row of the "who is who" step: enough to recognise somebody, no stats. */
export interface RosterEntry {
  name: string;
  messages: number;
  /** `YYYY-MM-DD` of their first and last message, from the local fields. */
  firstDay: string;
  lastDay: string;
  /** True when WhatsApp only had a phone number for them. */
  unsaved: boolean;
}

const dayKey = (m: { localYear: number; localMonth: number; localDay: number }) =>
  `${m.localYear}-${String(m.localMonth).padStart(2, '0')}-${String(m.localDay).padStart(2, '0')}`;

/**
 * The participant list with just enough context to identify someone.
 *
 * Built straight off the parse rather than off statistics, because the naming
 * step happens *before* stats are computed — renaming somebody afterwards would
 * mean recomputing everything, and merging two people afterwards would mean
 * recomputing everything twice.
 */
export function roster(parsed: ParseResult): RosterEntry[] {
  const seen = new Map<string, { messages: number; first: string; last: string }>();

  for (const message of parsed.messages) {
    if (message.sender === null) continue;
    const day = dayKey(message);
    const row = seen.get(message.sender);
    if (row) {
      row.messages++;
      // Real exports are not sorted — the encryption notice carries the export
      // date, and same-minute messages from different devices land in delivery
      // order — so the range is taken by comparison, never by position.
      if (day < row.first) row.first = day;
      if (day > row.last) row.last = day;
    } else {
      seen.set(message.sender, { messages: 1, first: day, last: day });
    }
  }

  return parsed.participants.map((name) => {
    const row = seen.get(name);
    return {
      name,
      messages: row?.messages ?? 0,
      firstDay: row?.first ?? '',
      lastDay: row?.last ?? '',
      unsaved: isUnsavedSender(name),
    };
  });
}

export interface MergeSuggestion {
  /** The name with fewer messages — the one that would be folded into `into`. */
  from: string;
  into: string;
  /** Short, human, shown next to the pair: why we think it is one person. */
  why: string;
}

/** Strips what a contact rename typically adds: punctuation, spacing, case. */
function normalise(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}

/**
 * Pairs that are probably one person who was renamed in somebody's address book.
 *
 * This is the common case in a long-running group, and it is invisible in the
 * statistics: "תמיר" and "תמיר הגבר" are two rows on the leaderboard, half the
 * messages each, and neither wins anything they should have won. The export
 * cannot prove they are the same person — WhatsApp writes the display name at
 * the time of export, not a stable id — so this only ever *suggests*, and the
 * reader decides.
 *
 * Two numbers are never suggested: different numbers really are different
 * people, and merging them is the one mistake with no evidence to undo it.
 */
export function suggestMerges(parsed: ParseResult): MergeSuggestion[] {
  const rows = roster(parsed).filter((r) => !r.unsaved && normalise(r.name).length >= 2);
  const out: MergeSuggestion[] = [];
  const spoken = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      // Participants are ordered by message count, so `a` is always the larger.
      if (spoken.has(a.name) || spoken.has(b.name)) continue;

      const na = normalise(a.name);
      const nb = normalise(b.name);

      const contained =
        na === nb ||
        na.startsWith(`${nb} `) ||
        na.endsWith(` ${nb}`) ||
        nb.startsWith(`${na} `) ||
        nb.endsWith(` ${na}`);
      if (!contained) continue;

      // Disjoint active windows are the signature of a rename: the old name
      // stops the day the new one starts. Overlapping ones are weaker evidence
      // — two people can genuinely share a first name — so the reason says so
      // rather than pretending to more certainty than there is.
      const disjoint = a.lastDay < b.firstDay || b.lastDay < a.firstDay;
      const renamedIn = (a.firstDay < b.firstDay ? b.firstDay : a.firstDay).slice(0, 4);

      out.push({
        from: b.name,
        into: a.name,
        why: disjoint ? `renamed ${renamedIn}` : 'overlapping activity',
      });
      spoken.add(a.name);
      spoken.add(b.name);
    }
  }

  return out;
}

/**
 * Rewrites senders to the names the user supplied.
 *
 * Applied to the parsed messages rather than at render time, so that every
 * downstream consumer — statistics, moment excerpts, the pseudonymiser's scrub
 * list — sees one consistent set of names. Renaming at the last moment would
 * leave the new name unredacted in message bodies, which is the opposite of
 * what the user was promised.
 *
 * Participant order is preserved: it is by message count, and renaming somebody
 * does not change how much they said.
 *
 * Two names may map to one, which is how a merge is expressed — there is no
 * separate merge path, because "these two rows are the same person" and "this
 * row is called something else" are the same edit as far as the messages are
 * concerned. The participant list is deduplicated on the way out: leaving the
 * duplicate in would give the merged person two character cards, two rows on
 * the leaderboard, and two different pseudonyms in the AI payload.
 */
export function applyAliases(
  parsed: ParseResult,
  aliases: Readonly<Record<string, string>>,
): ParseResult {
  const clean = new Map<string, string>();
  for (const [from, to] of Object.entries(aliases)) {
    const trimmed = to.trim();
    // An empty box means "leave it as the number", not "rename to nothing".
    if (trimmed.length > 0 && trimmed !== from) clean.set(from, trimmed);
  }
  if (clean.size === 0) return parsed;

  const rename = (name: string | null) => (name === null ? null : (clean.get(name) ?? name));

  const messages: Message[] = parsed.messages.map((message) =>
    message.sender !== null && clean.has(message.sender)
      ? { ...message, sender: rename(message.sender) }
      : message,
  );

  return {
    ...parsed,
    messages,
    participants: [...new Set(parsed.participants.map((name) => clean.get(name) ?? name))],
  };
}
