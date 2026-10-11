import type { ChatStats } from '@wrapped/core';
import type { Localised } from './copy';

/**
 * Numbers, dates and durations in the language of the report.
 *
 * `format.ts` formats for the *chat's* language, which is what the analysis
 * screens want — it is describing the file. Everything in the deck is the
 * opposite: it is the report talking, so it follows the language the reader
 * asked the report to be written in, down to the thousands separator.
 *
 * The duration and hour helpers live here rather than there because they do not
 * merely format a number, they choose a word — "under a minute", "midnight",
 * "3 months" — and a word belongs in the copy table.
 */

export function num(l: Localised, value: number): string {
  return new Intl.NumberFormat(l.locale).format(Math.round(value));
}

/** `2023-01-15` → `15 January 2023`, in the report's language. */
export function day(l: Localised, isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  if (!y || !m || !d) return isoDay;
  return new Intl.DateTimeFormat(l.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** `2023-01` → `January 2023`. */
export function month(l: Localised, key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(l.locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * `Aug 2016 – Aug 2025`, localised.
 *
 * The core computes this string too, but in English month names, because it has
 * no idea what language anyone will ask to read it in. Rebuilt here from the
 * two dates rather than translated from the label — a string is not a date and
 * cannot be re-formatted once it has become one.
 */
export function spanLabel(l: Localised, stats: ChatStats): string {
  const from = stats.span.first.slice(0, 7);
  const to = stats.span.last.slice(0, 7);
  if (!from || !to) return stats.span.label;
  const a = month(l, from);
  const b = month(l, to);
  return a === b ? a : `${a} – ${b}`;
}

/**
 * Human reply times.
 *
 * `precisionMs` is the chat's own resolution: a gap shorter than one tick of it
 * is not "0s", it is a reply the file cannot time. On the minute-granularity
 * exports that most of them are, a median of zero means half their replies
 * landed inside the same minute, and that is what gets said.
 */
export function duration(l: Localised, ms: number | null, precisionMs = 1000): string {
  if (ms === null) return '—';
  if (ms < precisionMs) {
    return l.t(precisionMs >= 60_000 ? 'duration.underMinute' : 'duration.underSecond');
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return l.t('duration.seconds', { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return l.t('duration.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? l.t('duration.hours', { n: hours })
    : l.t('duration.hoursMinutes', { n: hours, m: rest });
}

/** A stretch of the calendar: hours, days, months or years, whichever fits. */
export function span(l: Localised, days: number): string {
  if (days < 1) return l.t('span.hours', { n: Math.round(days * 24) });
  if (days < 60) return l.t('span.days', { n: Math.round(days) });
  const months = Math.round(days / 30.44);
  if (months < 24) return l.t('span.months', { n: months });
  return l.t('span.years', { n: (days / 365.25).toFixed(1) });
}

/**
 * `14` → `2 PM` in English, `14 Uhr` in German, `午後2時` in Japanese.
 *
 * Both forms of the hour go to the template because the split between them is
 * not ours to make: half these languages are on a 24-hour clock and take the
 * hour as written, and the other half need it folded into twelve with a word
 * attached. Passing only one of the two would decide that in this file.
 */
export function hour(l: Localised, h: number): string {
  if (h === 0) return l.t('time.midnight');
  if (h === 12) return l.t('time.noon');
  return h < 12 ? l.t('time.am', { h, h24: h }) : l.t('time.pm', { h: h - 12, h24: h });
}

/** Language-neutral, but kept here so a slide imports one module, not two. */
export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** First name only — full display names blow out the big type on a card. */
export function shortName(name: string | null): string {
  if (!name) return '—';
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}
