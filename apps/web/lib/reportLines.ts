/**
 * Reading the writer's `body` back into the pieces a slide draws.
 *
 * Several formats are written as short labelled lines — "Charge: …", "CEO: …",
 * "- fixed the thing". The writer returns them newline-separated inside one
 * `body` rather than as a structured array, because a schema with a different
 * shape per format is a schema a model gets wrong on the fourth slide. Parsing
 * back out here is the cheaper half of that trade, and it is pure so it can be
 * tested without a renderer.
 */

/** Splits a body into its non-empty lines. */
export function lines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** A line without the bullet a writer sometimes puts in front of it anyway. */
export function unbullet(line: string): string {
  return line.replace(/^[-•*·]\s*/, '');
}

/**
 * The first colon that separates rather than tells the time. "18:02: someone's
 * work schedule" is a timeline beat whose label is the time, and the colon
 * inside the time has a digit on both sides.
 */
function separator(text: string, from = 0): number {
  for (let i = text.indexOf(':', from); i >= 0; i = text.indexOf(':', i + 1)) {
    const between = /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '');
    if (!between) return i;
  }
  return -1;
}

/** `Label: value` when a line has one, otherwise the whole line as the value. */
export function splitLabel(line: string, maxLabel = 24): { label: string | null; value: string } {
  const clean = unbullet(line);
  const idx = separator(clean);
  // A colon late in a long line is punctuation, not a label.
  if (idx > 0 && idx <= maxLabel) {
    return { label: clean.slice(0, idx).trim(), value: clean.slice(idx + 1).trim() };
  }
  return { label: null, value: clean };
}

/**
 * The part of a title that gets the colour.
 *
 * The design sets a headline in two voices — "Functional? / Absolutely not." —
 * and a model-written title has no markup saying where the turn is. So: a
 * sentence break somewhere in the middle third is the turn; failing that, the
 * last word is (the last two, when the last is too short to carry a colour on
 * its own). Either half may be empty, and a caller draws whatever it gets.
 */
export function splitTitle(title: string): { head: string; tail: string } {
  const text = title.trim();
  if (!text) return { head: '', tail: '' };

  const breaks = [...text.matchAll(/[.?!…]+\s+/g)];
  for (const hit of breaks) {
    const at = hit.index + hit[0].length;
    const share = at / text.length;
    if (share >= 0.25 && share <= 0.75) {
      return { head: text.slice(0, at).trimEnd(), tail: text.slice(at) };
    }
  }

  const words = text.split(/\s+/);
  if (words.length < 2) return { head: '', tail: text };
  const take = words[words.length - 1]!.replace(/[^\p{L}\p{N}]/gu, '').length <= 2 && words.length > 2 ? 2 : 1;
  return {
    head: words.slice(0, -take).join(' '),
    tail: words.slice(-take).join(' '),
  };
}

/**
 * A court case, by position. The writer is briefed to return the charge, the
 * evidence, the verdict and the sentence in that order, each opening with its
 * label; the labels are in the output language, so the order is the only thing
 * this can rely on. Fewer lines degrade from the end: a three-line case has no
 * sentence, a two-line one no verdict.
 */
export interface Labelled {
  label: string | null;
  value: string;
}

export interface CourtCase {
  charge: Labelled | null;
  evidence: Labelled | null;
  verdict: Labelled | null;
  sentence: Labelled | null;
}

export function courtLines(body: string): CourtCase {
  const [charge, evidence, verdict, sentence] = lines(body).map((l) => splitLabel(l));
  return {
    charge: charge ?? null,
    evidence: evidence ?? null,
    verdict: verdict ?? null,
    sentence: sentence ?? null,
  };
}

/**
 * One line of an itemised bill: the item, and the quantity if it ends with one
 * ("Voice notes nobody opened × 31", "x3", "— 12"). A line with no quantity is
 * drawn whole, and the last line is always the total whatever it says.
 */
export function receiptLine(line: string): { item: string; qty: string | null } {
  const clean = unbullet(line);
  const trailing = /^(.*?)\s*(?:[×x✕]\s*(\d[\d,.]*)|(\d[\d,.]*)\s*[×x✕]|[·–—-]\s*(\d[\d,.]*))\s*$/iu.exec(clean);
  if (trailing) {
    const qty = trailing[2] ?? trailing[3] ?? trailing[4] ?? null;
    return { item: trailing[1]!.trim(), qty };
  }
  const labelled = splitLabel(clean);
  if (labelled.label && /^\d[\d,.]*$/.test(labelled.value)) {
    return { item: labelled.label, qty: labelled.value };
  }
  return { item: clean, qty: null };
}

/**
 * An org chart: `Role: person` rows, and the one unlabelled line as the closer.
 *
 * Split at the last colon rather than the first, and with no cap on the role:
 * a job title this chat would invent — "Minister of foreign affairs", "Most
 * likely to derail pizza into ancient deities" — is routinely longer than a
 * label, and it is the name on the right that is short.
 */
export function orgLines(body: string): { rows: { role: string; name: string }[]; closing: string | null } {
  const rows: { role: string; name: string }[] = [];
  let closing: string | null = null;
  for (const line of lines(body)) {
    const clean = unbullet(line);
    const idx = clean.lastIndexOf(':');
    const name = idx > 0 ? clean.slice(idx + 1).trim() : '';
    if (name && name.length <= 48) rows.push({ role: clean.slice(0, idx).trim(), name });
    else closing = clean;
  }
  return { rows, closing };
}

/**
 * The final rankings: `Person: the line that put them there`, in order. The
 * name is short and comes first, so the first colon is the split; a line with
 * no name is kept as a line about nobody in particular, which the card draws
 * without a face.
 */
export function rankingLines(body: string): { name: string | null; line: string }[] {
  return lines(body).map((line) => {
    const clean = unbullet(line).replace(/^\d+(?:st|nd|rd|th)?[.)]?\s*/i, '');
    const { label, value } = splitLabel(clean, 40);
    return { name: label, line: value };
  });
}

/** Dated beats: the date is the label when the line has one. */
export function timelineLines(body: string): { date: string | null; beat: string }[] {
  return lines(body).map((line) => {
    const { label, value } = splitLabel(line);
    return { date: label, beat: value };
  });
}
