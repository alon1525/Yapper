import type { Message } from '../types';

/**
 * Pseudonymisation layer.
 *
 * Product position: the free tier never leaves the browser at all. When the
 * user explicitly consents to AI analysis, what leaves is an anonymised copy —
 * real names are replaced with tokens here, and mapped back in the browser on
 * the way out, so the model never sees who anyone actually is.
 *
 * The non-obvious half is that sender columns are the easy part. People address
 * each other by name constantly *inside* message text, so redacting only the
 * sender field would leak every real name anyway. This module sweeps bodies too.
 *
 * Scope limit, stated honestly because the landing copy depends on it: only
 * WhatsApp display names are derivable from an export. Freeform nicknames the
 * group invented are not, and are not caught.
 */

export interface Pseudonymizer {
  /** Real display name → token, e.g. `Alon` → `Person A`. */
  readonly forward: ReadonlyMap<string, string>;
  /** Token → real display name. Never leaves the browser. */
  readonly reverse: ReadonlyMap<string, string>;
  /** Token for a sender; falls back to a stable unknown token. */
  tokenFor(name: string | null): string;
  /** Redact names, phone numbers and emails from free text. */
  scrub(text: string): string;
  /** Put the real names back once a model has replied. */
  restore(text: string): string;
}

/** A, B, ... Z, AA, AB, ... so groups larger than 26 still get stable labels. */
function label(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Name variants worth redacting for one participant: the full display name and
 * its individual word-parts, so "Sarah Levi" also catches a bare "Sarah".
 * Parts shorter than 3 characters are skipped — redacting "Al" would shred
 * ordinary words.
 */
function nameVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  for (const part of name.split(/[\s._-]+/)) {
    if (part.length >= 3) variants.add(part);
  }
  return [...variants];
}

/**
 * Hebrew's one-letter prepositions and conjunctions (ו ה ב ל מ ש כ), which
 * attach directly to the following word with no space.
 */
const HEBREW_PREFIXES = '[\\u05D5\\u05D4\\u05D1\\u05DC\\u05DE\\u05E9\\u05DB]';

const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const URL_RE = /\bhttps?:\/\/([^\s/]+)(\/[^\s]*)?/gi;

export function createPseudonymizer(participants: readonly string[]): Pseudonymizer {
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();

  participants.forEach((name, i) => {
    const token = `Person ${label(i)}`;
    forward.set(name, token);
    reverse.set(token, name);
  });

  // Longest variants first, so "Sarah Levi" is consumed before a bare "Sarah"
  // can chew off half of it and leave "Person B Levi" behind.
  const variants: { pattern: RegExp; replacement: string }[] = [];
  for (const [name, token] of forward) {
    for (const variant of nameVariants(name)) {
      variants.push({
        // No \b — display names routinely contain emoji and punctuation, where
        // word boundaries do not behave. Lookarounds on letters/digits instead.
        //
        // The optional prefix group exists because Hebrew glues its
        // prepositions straight onto a name — "לנדב" (to Nadav), "ונדב" (and
        // Nadav). A plain letter-boundary lookbehind treats those as one word
        // and leaks the name intact. Found in a real export, not theorised.
        pattern: new RegExp(
          `(?<![\\p{L}\\p{N}])(${HEBREW_PREFIXES}{0,2})${escapeRegExp(variant)}(?![\\p{L}\\p{N}])`,
          'giu',
        ),
        replacement: `$1${token}`,
      });
    }
  }
  variants.sort((a, b) => b.pattern.source.length - a.pattern.source.length);

  const restorePattern = new RegExp(
    `\\bPerson (${[...reverse.keys()].map((t) => t.slice(7)).join('|')})\\b`,
    'g',
  );

  return {
    forward,
    reverse,

    tokenFor(name) {
      if (name === null) return 'System';
      return forward.get(name) ?? 'Person ?';
    },

    scrub(text) {
      // Order matters. Structured identifiers are consumed first, because they
      // frequently *contain* a name — sweeping names first turns
      // `alon@example.com` into `Person A@example.com`, and the email rule then
      // only catches the tail, leaving `Person [email]`.
      let out = text.replace(EMAIL_RE, '[email]');
      // Keep the domain: a link everyone kept resending is often the joke, but
      // the path and query string can carry identity.
      out = out.replace(URL_RE, (_m, host: string) => `[link:${host}]`);
      out = out.replace(PHONE_RE, (m) =>
        (m.match(/\d/g) ?? []).length >= 7 ? '[phone]' : m,
      );
      for (const { pattern, replacement } of variants) out = out.replace(pattern, replacement);
      return out;
    },

    restore(text) {
      if (reverse.size === 0) return text;
      return text.replace(restorePattern, (match) => reverse.get(match) ?? match);
    },
  };
}

export interface AnonymizedMessage {
  /**
   * `Message.id` — the index into the parse's message array, carried verbatim.
   *
   * This is what makes every downstream claim checkable. A model that says
   * something funny happened has to say *which messages*, and the browser still
   * holds the real ones, so the citation can be resolved back to a body, a
   * sender and a date and compared against what was actually claimed. Without an
   * id here there is no way to tell a real quote from an invented one.
   *
   * Safe to expose: an index into an array the model never sees is not
   * identifying. It is only meaningful to the browser that produced it.
   *
   * Stable across the roster step — `applyAliases` rewrites the sender field of
   * each message in place and preserves both order and id, so an id collected
   * before the reader renamed anybody still points at the same message after.
   */
  id: number;
  sender: string;
  /** `HH:MM`, enough for the model to feel pacing without leaking a calendar. */
  time: string;
  /** `YYYY-MM-DD`, so the model can date a memory instead of guessing at one. */
  date: string;
  text: string;
  /** Present only when true, matching `Message.edited`. */
  edited?: boolean;
}

export function anonymizeMessages(
  messages: readonly Message[],
  p: Pseudonymizer,
): AnonymizedMessage[] {
  return messages.map((m) => ({
    id: m.id,
    sender: p.tokenFor(m.sender),
    time: `${String(m.localHour).padStart(2, '0')}:${String(m.localMinute).padStart(2, '0')}`,
    date: `${m.localYear}-${String(m.localMonth).padStart(2, '0')}-${String(m.localDay).padStart(2, '0')}`,
    text:
      m.kind === 'attachment'
        ? `<${m.attachmentType ?? 'media'}>`
        : m.kind === 'deleted'
          ? '<deleted>'
          : p.scrub(m.body),
    ...(m.edited ? { edited: true } : {}),
  }));
}

/**
 * The same transcript shape with nothing taken out: real senders, real bodies.
 *
 * Deliberately adjacent to `anonymizeMessages` rather than off in the route
 * that uses it, because the failure mode is silent. These two must produce the
 * same fields forever — `transcriptLine` renders both, and a field added to one
 * and forgotten in the other is a prompt that quietly loses a column on one
 * path only.
 *
 * Exactly one caller is allowed to reach for this: the paid report, which the
 * reader unlocks knowing their group's names go with it. Every free path —
 * the preview, the detective, the writer — goes through the pseudonymiser, and
 * the privacy policy says so per-route. If you are adding a second caller, the
 * question to answer first is which paragraph of `/privacy` covers it.
 */
export function identifyMessages(messages: readonly Message[]): AnonymizedMessage[] {
  return messages.map((m) => ({
    id: m.id,
    sender: m.sender ?? 'system',
    time: `${String(m.localHour).padStart(2, '0')}:${String(m.localMinute).padStart(2, '0')}`,
    date: `${m.localYear}-${String(m.localMonth).padStart(2, '0')}-${String(m.localDay).padStart(2, '0')}`,
    text:
      m.kind === 'attachment'
        ? `<${m.attachmentType ?? 'media'}>`
        : m.kind === 'deleted'
          ? '<deleted>'
          : m.body,
    ...(m.edited ? { edited: true } : {}),
  }));
}

/**
 * How a message is addressed in a prompt and cited back in a model's reply.
 *
 * One shared helper rather than a format string in each prompt: the writer's
 * citations are parsed with `parseEvidenceId`, and a prompt that renders ids one
 * way while the parser reads another is a silent, total failure of the evidence
 * chain — every citation unresolvable, every finding rejected, no error anywhere.
 */
export function evidenceId(id: number): string {
  return `m${id}`;
}

/** Inverse of {@link evidenceId}. Returns null for anything malformed. */
export function parseEvidenceId(token: string): number | null {
  const m = /^m(\d+)$/.exec(token.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * One transcript line as the model sees it:
 * `m1234 [2023-03-14 10:42] Person A: tomorrow we start seriously`
 *
 * The id leads because a model copying a citation reads left to right, and
 * burying it after the text made both models drop it on long windows.
 */
export function transcriptLine(m: AnonymizedMessage): string {
  return `${evidenceId(m.id)} [${m.date} ${m.time}] ${m.sender}:${m.edited ? ' (edited)' : ''} ${m.text}`;
}

/**
 * Walks any string field of a model's structured reply and puts real names
 * back. Runs in the browser — the mapping never goes near the server.
 */
export function restoreDeep<T>(value: T, p: Pseudonymizer): T {
  if (typeof value === 'string') return p.restore(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, p)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = restoreDeep(v, p);
    return out as T;
  }
  return value;
}
