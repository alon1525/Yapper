/**
 * What the reader tells Reg before he starts writing.
 *
 * The onboarding asks three questions and offers photos; this is the answer,
 * carried from the flow into the deck and into the two prompts. It is a plain
 * value with no methods so that the same object can be handed to a payload
 * builder, a slide, and a test without any of them needing the others.
 *
 * Photos are object URLs, not data URLs. A group of eighteen at 3 MB a face is
 * 54 MB of base64 in React state, and the point of an object URL is that the
 * bytes stay where the browser already put them. They are alive only as long as
 * the tab is: nothing here is uploaded, persisted, or sent anywhere — including
 * to the model, which never receives an image.
 */

/* The languages themselves live in `languages.ts`, which is also where the
   prompts and the request schemas read them from. Re-exported here because the
   brief is what everything else imports. */
export { REPORT_LANGUAGES as LANGUAGES } from './languages';
export type { ReportLanguage } from './languages';

import type { ReportLanguage } from './languages';

/** The four slides the design gives a full-bleed photo. */
export const GROUP_SLOTS = ['opener', 'chaos', 'verdict', 'paywall'] as const;
export type GroupSlot = (typeof GROUP_SLOTS)[number];

export interface Brief {
  /** The language Reg writes in — independent of the language the chat is in. */
  language: ReportLanguage;
  /** One of `CHAT_KINDS`, or whatever the reader picked. */
  kind: string;
  /** Free text, capped by the textarea. Scrubbed before it can reach a model. */
  notes: string;
  /** Person's display name → object URL. */
  photos: Record<string, string>;
  /** Slide slot → object URL. */
  groupPhotos: Partial<Record<GroupSlot, string>>;
}

export const NOTES_LIMIT = 600;

/**
 * The icon each card carries, as a key rather than a component — this module is
 * plain data with no React in it, so that a payload builder, a test and the
 * onboarding can all read it without pulling in the icon set.
 */
export type KindIcon = 'partner' | 'bestFriend' | 'friends' | 'family' | 'work' | 'other';

export const CHAT_KINDS: { name: string; icon: KindIcon; note: string }[] = [
  { name: 'Partner', icon: 'partner', note: 'Romance, fights, who says goodnight first' },
  { name: 'Best friend', icon: 'bestFriend', note: 'One-on-one, zero filter' },
  { name: 'Friends group', icon: 'friends', note: 'The classic. Chaos rankings.' },
  { name: 'Family', icon: 'family', note: 'Gentler roast. Mostly.' },
  { name: 'Work', icon: 'work', note: 'Kept clean enough to share' },
  { name: 'Other', icon: 'other', note: 'Reg will figure it out' },
];

export function emptyBrief(): Brief {
  return { language: 'en', kind: '', notes: '', photos: {}, groupPhotos: {} };
}

/**
 * Hands every object URL back to the browser.
 *
 * Called when the reader starts over. Without it each restart leaks the whole
 * previous set of photos for the lifetime of the document, which on a group of
 * eighteen is the kind of leak you can watch in the memory graph.
 */
export function releasePhotos(brief: Brief): void {
  for (const url of Object.values(brief.photos)) URL.revokeObjectURL(url);
  for (const url of Object.values(brief.groupPhotos)) {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * The brief as the model sees it: no photos, and the notes redacted with the
 * same sweep every message body goes through.
 *
 * The notes box is the one place in the product where the reader types names
 * themselves — "תמיר never replies because he works nights" — so it is also the
 * one place where a name could walk straight past the pseudonymiser into a
 * prompt. Scrubbing it here means the tokens in the notes match the tokens in
 * the excerpts, which is both the private answer and the useful one: Reg reads
 * "Person C never replies because he works nights" and it restores correctly on
 * the way back.
 */
export interface BriefDigest {
  language: ReportLanguage;
  kind: string;
  notes: string;
}

export function briefDigest(
  brief: Brief | undefined,
  scrub: (text: string) => string,
): BriefDigest | undefined {
  if (!brief) return undefined;
  const notes = brief.notes.trim();
  return {
    language: brief.language,
    kind: brief.kind,
    notes: notes ? scrub(notes).slice(0, NOTES_LIMIT) : '',
  };
}
