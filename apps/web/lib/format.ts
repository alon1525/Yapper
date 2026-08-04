import type { ChatLanguage } from '@wrapped/core';

export const localeFor = (language: ChatLanguage): string =>
  language === 'he' ? 'he-IL' : 'en-GB';

export function formatNumber(value: number, language: ChatLanguage = 'en'): string {
  return new Intl.NumberFormat(localeFor(language)).format(Math.round(value));
}

/** `2023-01-15` → `15 January 2023`, localised. */
export function formatDay(day: string, language: ChatLanguage = 'en'): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** `2023-01` → `January 2023`, localised. */
export function formatMonth(key: string, language: ChatLanguage = 'en'): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(localeFor(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Human reply times. Precision below a minute is what makes them funny. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatDays(days: number): string {
  if (days < 1) return `${Math.round(days * 24)} hours`;
  if (days < 60) return `${Math.round(days)} days`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/** `14` → `2 PM`, `0` → `midnight`. */
export function formatHour(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** First name only — full display names blow out the big type on a card. */
export function shortName(name: string | null): string {
  if (!name) return 'Someone';
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
