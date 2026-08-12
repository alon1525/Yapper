/**
 * Text analysis helpers: emoji, words, links. Pure and DOM-free.
 */

/**
 * Grapheme-cluster segmenter, so that ZWJ sequences (👨‍👩‍👧), skin-tone
 * modifiers (👍🏽) and flags (🇮🇱) count as one emoji instead of two to five.
 * Available in Node 18+ and every browser we target; the regex path below is a
 * fallback rather than the main road.
 */
const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

// Regional indicators are not Extended_Pictographic, so flags (🇮🇱, 🇺🇸) need
// their own clause or they vanish from the emoji ranking entirely.
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
// Constructed rather than a literal so the variation selectors stay readable as
// escapes instead of becoming invisible characters in the source.
const EMOJI_FALLBACK = new RegExp(
  '\\p{Regional_Indicator}{2}|\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?' +
    '(?:\\u200D\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?)*',
  'gu',
);

/** Every emoji in a string, as whole grapheme clusters, in order. */
export function extractEmoji(text: string): string[] {
  if (!segmenter) return text.match(EMOJI_FALLBACK) ?? [];

  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    if (PICTOGRAPHIC.test(segment)) out.push(segment);
  }
  return out;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

export function extractLinks(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

/**
 * Default English list, used when the caller does not know the chat language.
 * The language-aware sets live in `../lang/language.ts`; without the right one
 * every "top words" result is either `the / and / i` or its Hebrew equivalent.
 */
export const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','than','that','this','these','those',
  'is','are','was','were','be','been','being','am','do','does','did','doing','done',
  'have','has','had','having','will','would','shall','should','can','could','may',
  'might','must','i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','mine','yours','ours','theirs','myself',
  'yourself','himself','herself','itself','ourselves','themselves','what','which',
  'who','whom','whose','where','when','why','how','all','any','both','each','few',
  'more','most','other','some','such','no','nor','not','only','own','same','so',
  'too','very','just','now','also','here','there','out','up','down','in','on','at',
  'to','from','of','for','with','about','into','through','during','before','after',
  'above','below','over','under','again','once','because','as','until','while','by',
  'off','yes','ok','okay','yeah','yep','nope','im','ive','id','ill','its','dont',
  'doesnt','didnt','cant','wont','isnt','arent','wasnt','werent','thats','whats',
  'lets','ya','u','ur','r','k','oh','ah','eh','hmm','um','uh','like','get','got',
  'go','going','went','one','two','know','think','see','say','said','want','need',
  'good','well','really','back','still','even','make','made','take','look','come',
  'time','way','thing','things','much','many','lot','bit','sure','right','left',
]);

const WORD_RE = /[\p{L}\p{N}']+/gu;

/**
 * The words ICU finds in a run of text with no spaces in it.
 *
 * `isWordLike` is what separates 寿司 from 、 and from the space either side of
 * an English brand name — punctuation segments come back with the flag unset,
 * and dropping them here means the caller's length floor and stopword list see
 * only real candidates.
 */
function segmentWords(text: string, segmenter: Intl.Segmenter): string[] {
  const out: string[] = [];
  for (const piece of segmenter.segment(text)) {
    if (piece.isWordLike) out.push(piece.segment);
  }
  return out;
}

/**
 * Lowercased content words, stopwords and very short tokens removed.
 *
 * The stopword set and the length floor both depend on the chat's language —
 * filtering Hebrew with an English list leaves every Hebrew function word in
 * the ranking, and a three-character floor throws away most Hebrew content.
 */
export function extractWords(
  text: string,
  stopwords: ReadonlySet<string> = STOPWORDS,
  minLength = 3,
  /**
   * Supplied only for languages that do not put spaces between words — see
   * `wordSegmenterFor`. Passed in rather than chosen here so this module keeps
   * knowing nothing about languages, and so the segmenter is built once per
   * export instead of once per message.
   */
  segmenter: Intl.Segmenter | null = null,
): string[] {
  const matches = segmenter
    ? segmentWords(text.toLowerCase(), segmenter)
    : text.toLowerCase().match(WORD_RE);
  if (!matches) return [];

  const out: string[] = [];
  for (const raw of matches) {
    const w = raw.replace(/^'+|'+$/g, '');
    if (w.length < minLength) continue;
    if (stopwords.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

/**
 * Rough word count for "who writes essays" — counts everything, no filtering.
 *
 * Takes the segmenter for the same reason `extractWords` does: without it a
 * three-sentence Japanese message counts as three words, and the person who
 * writes the most in the group looks like the one who writes the least.
 */
export function countWords(text: string, segmenter: Intl.Segmenter | null = null): number {
  if (segmenter) return segmentWords(text, segmenter).length;
  return text.match(WORD_RE)?.length ?? 0;
}

/**
 * Laughter in any of its written forms — the strongest cheap signal for a funny
 * moment, and the backbone of candidate-moment scoring.
 */
const LAUGH_RE =
  // `חחח` / `ההה` are Hebrew's equivalent of `hahaha`. Included ahead of full
  // Hebrew support because laughter is what candidate-moment scoring leans on
  // hardest, and without it a Hebrew chat surfaces almost no funny moments.
  /\b(?:a?ha(?:ha)+h?|he(?:he)+h?|lo+l+|lmao+|rofl|xd+|ahahah\w*)\b|[ח]{3,}|[ה]{3,}|😂|🤣|😹/giu;

export function countLaughter(text: string): number {
  return text.match(LAUGH_RE)?.length ?? 0;
}

/**
 * The same text with every laugh removed.
 *
 * Laughter is the one token that is simultaneously the strongest signal a
 * moment was funny and the weakest signal a *message* said anything. Scoring
 * wants to count it; anything asking "is there content here" wants it gone
 * first, or `חחחחח` reads as a five-character contribution.
 */
export function stripLaughter(text: string): string {
  return text.replace(LAUGH_RE, ' ');
}

/** Top-N by count, ties broken alphabetically so results are deterministic. */
export function topEntries<T extends string>(
  counts: Map<T, number>,
  limit: number,
): { value: T; count: number }[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function increment<T>(map: Map<T, number>, key: T, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}
