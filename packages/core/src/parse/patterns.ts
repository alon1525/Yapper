import type { AttachmentType } from '../types';

/**
 * Zero-width and bidirectional control characters. iOS exports sprinkle U+200E
 * around timestamps and attachment markers; if these survive into the regex
 * input the header pattern fails on *some* exports and not others, which is the
 * worst possible failure mode. Stripped before anything else looks at a line.
 *
 * Built via the RegExp constructor so the escapes stay visible as text — a
 * literal `/[...]/` here would contain real invisible characters that any
 * formatter or careless edit could silently drop.
 *
 * U+200D ZERO WIDTH JOINER is deliberately EXCLUDED. It sits in the middle of
 * this block but is load-bearing: it is what binds 👨‍💻, 👩‍❤️‍👨 and family
 * emoji into single glyphs. Stripping it shatters them into their components
 * and quietly inflates every emoji statistic.
 */
export const INVISIBLE_CHARS = new RegExp(
  '[\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]',
  'g',
);

export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE_CHARS, '');
}

/**
 * Narrow no-break space (U+202F) and NBSP both appear before AM/PM in newer
 * iOS exports, so whitespace classes must be explicit rather than plain `\s`.
 */
const SP = '[\\s\\u00A0\\u202F]';

/**
 * Android: `12/01/2023, 22:14 - Alon: hey`
 * Also    `1/2/23, 10:14 pm - Alon: hey`
 * Date separator varies by locale (`/`, `.`, `-`).
 */
export const ANDROID_HEADER = new RegExp(
  '^(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-](\\d{2,4}),' +
    SP +
    '*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?' +
    SP +
    '*([AaPp]\\.?[Mm]\\.?)?' +
    SP +
    '*-' +
    SP +
    '(.*)$',
);

/** iOS: `[12/01/2023, 22:14:03] Alon: hey` */
export const IOS_HEADER = new RegExp(
  '^\\[(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-](\\d{2,4}),' +
    SP +
    '*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?' +
    SP +
    '*([AaPp]\\.?[Mm]\\.?)?\\]' +
    SP +
    '*(.*)$',
);

/**
 * Attachment placeholders, matched against the full message body.
 *
 * Table-driven on purpose: adding Hebrew (the named next phase) is a data
 * change here, not a rewrite of the parser. Order matters — the specific
 * extension rules must precede the catch-alls.
 */
export const ATTACHMENT_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  type: AttachmentType;
}> = [
  // Android, media excluded from the export
  { pattern: /^<Media omitted>$/i, type: 'unknown' },
  { pattern: /^image omitted$/i, type: 'image' },
  { pattern: /^video omitted$/i, type: 'video' },
  { pattern: /^audio omitted$/i, type: 'audio' },
  { pattern: /^sticker omitted$/i, type: 'sticker' },
  { pattern: /^GIF omitted$/i, type: 'gif' },
  { pattern: /^document omitted$/i, type: 'document' },
  { pattern: /^Contact card omitted$/i, type: 'contact' },
  // iOS, media included: `<attached: 00000042-PHOTO-2023-01-12-10-00-00.jpg>`
  { pattern: /^<attached:\s*.*\.webp>$/i, type: 'sticker' },
  { pattern: /^<attached:\s*.*\.(jpe?g|png|heic)>$/i, type: 'image' },
  { pattern: /^<attached:\s*.*\.(mp4|mov|3gp|avi)>$/i, type: 'video' },
  { pattern: /^<attached:\s*.*\.(opus|m4a|mp3|aac|ogg|wav)>$/i, type: 'audio' },
  { pattern: /^<attached:\s*.*>$/i, type: 'unknown' },
  // Android, media included: `IMG-20230112-WA0001.jpg (file attached)`
  { pattern: /\.webp\s*\(file attached\)$/i, type: 'sticker' },
  { pattern: /\.(jpe?g|png|heic)\s*\(file attached\)$/i, type: 'image' },
  { pattern: /\.(mp4|mov|3gp|avi)\s*\(file attached\)$/i, type: 'video' },
  { pattern: /\.(opus|m4a|mp3|aac|ogg|wav)\s*\(file attached\)$/i, type: 'audio' },
  { pattern: /\(file attached\)$/i, type: 'unknown' },
  // Hebrew-UI phones. Note this is independent of the chat's own language: a
  // Hebrew group on an English phone emits the English placeholders above.
  { pattern: /^<המדיה לא נכללה>$/, type: 'unknown' },
  { pattern: /^תמונה הושמטה$/, type: 'image' },
  { pattern: /^סרטון הושמט$/, type: 'video' },
  { pattern: /^אודיו הושמט$/, type: 'audio' },
  { pattern: /^מדבקה הושמטה$/, type: 'sticker' },
  { pattern: /^GIF הושמט$/, type: 'gif' },
  { pattern: /^מסמך הושמט$/, type: 'document' },
  { pattern: /^כרטיס איש קשר הושמט$/, type: 'contact' },
  { pattern: /\(קובץ מצורף\)$/, type: 'unknown' },
];

/**
 * The marker WhatsApp appends to a message that was edited after sending.
 *
 * It is a *suffix on the body*, not a message of its own, which is why it has to
 * be stripped rather than classified: left in place it lands in the word counts,
 * wins "longest message" for anyone who edits, and — because it is written in
 * the phone's UI language — turns "edited" into one of the group's top words.
 *
 * The `‎` around it in real exports is U+200E, already gone by the time any of
 * this runs. Kept anchored to the end so a message that merely quotes the phrase
 * is not mistaken for one.
 */
export const EDITED_PATTERNS: readonly RegExp[] = [
  /\s*<This message was edited>\s*$/i,
  /\s*<הודעה זו נערכה>\s*$/,
];

export const DELETED_PATTERNS: readonly RegExp[] = [
  /^This message was deleted\.?$/i,
  /^You deleted this message\.?$/i,
  /^This message was deleted by the admin\.?$/i,
  /^הודעה זו נמחקה\.?$/,
  /^מחקת הודעה זו\.?$/,
];

/**
 * System notices that DO contain a `: ` and would otherwise be mis-split into a
 * bogus sender. Checked before the sender split.
 *
 * The general discriminator is the absence of `: ` — system lines almost never
 * contain one. This list covers the handful that do.
 */
export const SYSTEM_WITH_COLON_PATTERNS: readonly RegExp[] = [
  /^.{1,80} changed the (subject|group description) to:/i,
  /^You changed the (subject|group description) to:/i,
  /^Your security code with .{1,80} changed\./i,
];

/**
 * Recognised system notices without a colon. Not needed for classification (no
 * `: ` already implies system) — used to flag anything unexpected, which is how
 * we learn an export dialect exists that we do not handle yet.
 */
export const KNOWN_SYSTEM_PATTERNS: readonly RegExp[] = [
  /end-to-end encrypted/i,
  /\bcreated (this )?group\b/i,
  /\badded\b/i,
  /\bremoved\b/i,
  /\bleft$/i,
  /\bjoined\b/i,
  /\bchanged (the subject|their phone number|this group's icon|the group description|to)\b/i,
  /\b(is now an admin|no longer an admin)\b/i,
  /\bdisappearing messages\b/i,
  /\bmissed (voice|video|group) call\b/i,
  /\b(blocked|unblocked)\b/i,
  /\bdeleted this group\b/i,
  /\bpinned a message\b/i,
  // Both found in a real 173k-message export that the synthetic fixtures missed.
  /\bdeleted the group description\b/i,
  /\bstarted a (video|voice) call\b/i,
  /\bwaiting for this message\b/i,
  /\bsecurity code\b/i,
  /\bnow an admin\b/i,
  // Hebrew-UI phones. Independent of the chat's own language: a Hebrew group
  // on an English phone emits the English notices above.
  /מוצפנות מקצה לקצה/,
  /יצר.? את הקבוצה|יצרה את הקבוצה/,
  /הוסיף.? את|הוסיפה את/,
  /הסיר.? את|הסירה את/,
  /עזב.? את הקבוצה|עזבה את הקבוצה/,
  /הצטרף.? באמצעות|הצטרפה באמצעות/,
  /שינה את הנושא|שינתה את הנושא|שינה את תיאור הקבוצה/,
  /מנהל.? הקבוצה|הפך.? למנהל/,
  /הודעות שנעלמות/,
  /שיחה שלא נענתה|התחיל.? שיחת/,
  /שינה את מספר הטלפון|שינתה את מספר הטלפון/,
  /קוד האבטחה/,
];

/** Upper bound on a plausible WhatsApp display name, used as a split guard. */
export const MAX_SENDER_LENGTH = 80;
