import { SlideFormat } from './schema';

/**
 * The two repairs that need to know what a deck *is*.
 *
 * `coerceToSchema` handles every budget generically, by reading the limit out
 * of the validation failure. Two failures carry no limit to read:
 *
 * A format the writer invented — `meme_format`, `group_chat_receipt` — is not
 * too long, it is not one of the thirteen. The schema already names the answer:
 * `plain` is the format for a finding that does not want a costume, so a slide
 * wearing one that does not exist takes it off rather than being thrown away.
 *
 * A date arrives as `2024-03-05 14:22` where the schema wants `2024-03-05`,
 * and truncating it to the field's twelve characters would leave `2024-03-05 1`
 * — which then fails verification against the real message and loses the quote.
 * Cutting at the day boundary keeps a date that can still be checked.
 *
 * Both only ever discard information the deck cannot use. Neither invents a
 * value, and neither touches anything `verifySlideCopy` reads to decide whether
 * a claim is true.
 */

const FORMATS = new Set<string>(SlideFormat.options);
const DAY = /^(\d{4}-\d{2}-\d{2})/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Trims each quote's date back to the day, where it carries more than one. */
function normalizeQuotes(holder: Record<string, unknown>): void {
  if (!Array.isArray(holder.quotes)) return;
  for (const quote of holder.quotes) {
    if (!isRecord(quote) || typeof quote.date !== 'string') continue;
    const day = DAY.exec(quote.date);
    if (day) quote.date = day[1];
  }
}

export function normalizeWrittenDeck(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  if (Array.isArray(raw.slides)) {
    for (const slide of raw.slides) {
      if (!isRecord(slide)) continue;
      if (typeof slide.format === 'string' && !FORMATS.has(slide.format)) {
        slide.format = 'plain';
      }
      normalizeQuotes(slide);
    }
  }

  if (Array.isArray(raw.dictionary)) {
    for (const entry of raw.dictionary) {
      if (isRecord(entry)) normalizeQuotes(entry);
    }
  }

  return raw;
}
