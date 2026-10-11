/**
 * The handful of facts every legal page repeats.
 *
 * They live here rather than in each page because a contact address that is
 * right on three pages and stale on the fourth is the specific failure that
 * makes a privacy policy worse than not having one — a reader who writes to a
 * dead address and gets no reply has been refused their rights, whatever the
 * other three pages say.
 *
 * `TO_FILL` is the checklist of everything still blank. Each entry renders as a
 * highlighted marker in the page, so a reader can see it is a blank rather than
 * a name, and `grep TO_FILL` finds them all when the answers arrive.
 */

/** Where privacy, support and refund mail goes. One address, on purpose. */
export const CONTACT_EMAIL = 'alon1525@gmail.com';

/** The name the service trades under. Not necessarily the operator's legal name. */
export const SERVICE_NAME = 'Yapped';

/**
 * The date to show as "last updated". Hard-coded rather than `new Date()`:
 * a policy whose date follows the clock claims to have been reviewed on a day
 * nobody reviewed it, and the date is the reader's only signal that the terms
 * they agreed to are the terms on the screen. Bump it by hand when the text
 * changes, and only then.
 */
export const LAST_UPDATED = '11 August 2026';

/**
 * Everything the operator still has to decide or supply. Rendered inline via
 * `<Fill>`; listed here so the set is enumerable rather than scattered.
 */
export const TO_FILL = {
  operator: 'LEGAL NAME OF OPERATOR',
  address: 'REGISTERED ADDRESS',
  price: 'PRICE',
  provider: 'PAYMENT PROVIDER',
  jurisdiction: 'COUNTRY',
  courts: 'CITY',
} as const;

export type FillKey = keyof typeof TO_FILL;
