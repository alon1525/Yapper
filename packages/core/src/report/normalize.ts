import { SlideFormat } from './schema';

/**
 * The two repairs that need to know what a deck *is*.
 *
 * `coerceToSchema` handles every budget generically, by reading the limit out
 * of the validation failure. Two failures carry no limit to read:
 *
 * A format the writer invented — `meme_format`, `group_chat_receipt` — is not
 * too long, it is not one of the thirteen. The planner already chose one for
 * this slide and the writer was free to pick a better one; inventing a
 * fourteenth is not picking a better one, so the slide falls back to what the
 * planner asked for. `plain` only when there is no brief to fall back to,
 * because a court case that loses its costume is a worse slide than one that
 * never wore one.
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

/**
 * @param plannedFormats The format the planner chose, by slide id. A slide that
 * invents a format falls back to its own brief rather than to `plain`.
 */
export function normalizeWrittenDeck(
  raw: unknown,
  plannedFormats?: ReadonlyMap<string, string>,
): unknown {
  if (!isRecord(raw)) return raw;

  if (Array.isArray(raw.slides)) {
    for (const slide of raw.slides) {
      if (!isRecord(slide)) continue;
      if (typeof slide.format === 'string' && !FORMATS.has(slide.format)) {
        const planned = typeof slide.id === 'string' ? plannedFormats?.get(slide.id) : undefined;
        slide.format = planned && FORMATS.has(planned) ? planned : 'plain';
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
