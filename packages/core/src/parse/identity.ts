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
    participants: parsed.participants.map((name) => clean.get(name) ?? name),
  };
}
