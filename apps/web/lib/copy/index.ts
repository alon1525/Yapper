'use client';

import { createContext, useContext } from 'react';
import type { ReportLanguage } from '@/lib/languages';
import { reportLanguage } from '@/lib/languages';
import { EN, type Copy, type CopyKey } from './en';
import { DE } from './de';
import { ES } from './es';
import { FR } from './fr';
import { HE } from './he';
import { JA } from './ja';
import { PT } from './pt';
import { RU } from './ru';

/**
 * The report in the reader's language.
 *
 * Every language other than English is a `Partial<Copy>`: a key nobody has
 * written yet falls through to English rather than showing a raw key or
 * throwing. That is the difference between a translation being incomplete and
 * a report being broken, and it is what makes adding a language a pull request
 * of one file rather than a rewrite.
 */
const TABLES: Record<ReportLanguage, Partial<Copy>> = {
  en: EN,
  he: HE,
  ja: JA,
  es: ES,
  pt: PT,
  fr: FR,
  de: DE,
  ru: RU,
};

export type Translate = (key: CopyKey, params?: Record<string, string | number>) => string;

/**
 * What a component needs to write a sentence: the words, the locale its
 * numbers and dates are formatted in, and which way the page runs.
 */
export interface Localised {
  language: ReportLanguage;
  locale: string;
  rtl: boolean;
  t: Translate;
}

const FILL = /\{(\w+)\}/g;

export function localise(language: ReportLanguage): Localised {
  const spec = reportLanguage(language);
  const table = TABLES[spec.code] ?? EN;

  const t: Translate = (key, params) => {
    const template = table[key] ?? EN[key];
    if (!params) return template;
    // A placeholder with nothing to fill it is left as written rather than
    // replaced with "undefined" — a visible {name} is a bug report, and
    // "undefined messages" is a bug that ships.
    return template.replace(FILL, (whole, name: string) =>
      name in params ? String(params[name]) : whole,
    );
  };

  return { language: spec.code, locale: spec.locale, rtl: spec.rtl, t };
}

/**
 * The deck is a tree of slides that all need the same three facts, and passing
 * them down by hand meant every new slide had a chance to forget. The default
 * is English so a component rendered outside the provider — a test, a preview —
 * still renders words.
 */
export const CopyContext = createContext<Localised>(localise('en'));

export function useCopy(): Localised {
  return useContext(CopyContext);
}

export type { Copy, CopyKey };
export { EN };
