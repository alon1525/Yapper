import type { Message } from '../types';

/**
 * Chat language detection and language-dependent word handling.
 *
 * Kept separate from the parser on purpose. A real export taught us these are
 * two independent axes: WhatsApp writes *system notices* in the phone's UI
 * language while the *conversation* is in whatever the group speaks. A Hebrew
 * group on an English phone produces English "Messages and calls are
 * end-to-end encrypted" wrapped around Hebrew messages, so detecting one tells
 * you nothing about the other.
 */

export type ChatLanguage = 'en' | 'he' | 'ja' | 'other';

const HEBREW_RANGE = new RegExp('[\\u0590-\\u05FF]');
const LATIN_RANGE = /[A-Za-z]/;
/**
 * Hiragana, katakana and the CJK ideographs.
 *
 * A Chinese chat lands here too, and is called `ja`. That is a deliberate
 * approximation rather than a mistake we have not noticed: what this flag
 * actually selects is "a language that does not put spaces between its words",
 * and everything that depends on it — the segmenter, the length floor — is
 * right for both. The stopword list is the one thing that is not, and a wrong
 * stopword list only leaves a few extra function words in a ranking.
 */
const CJK_RANGE = new RegExp('[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF]');

/** True when the deck should be laid out right-to-left. */
export function isRtl(language: ChatLanguage): boolean {
  return language === 'he';
}

/**
 * Samples message text and picks the script that dominates. Sampling rather
 * than scanning: on a six-figure export the answer is obvious after a few
 * thousand messages and the full pass is wasted work.
 */
export function detectLanguage(messages: readonly Message[], sampleSize = 3000): ChatLanguage {
  let hebrew = 0;
  let latin = 0;
  let cjk = 0;
  let seen = 0;

  const step = Math.max(1, Math.floor(messages.length / sampleSize));
  for (let i = 0; i < messages.length && seen < sampleSize; i += step) {
    const m = messages[i]!;
    if (m.kind !== 'text' || !m.sender) continue;
    seen++;
    for (const ch of m.body) {
      if (HEBREW_RANGE.test(ch)) hebrew++;
      else if (CJK_RANGE.test(ch)) cjk++;
      else if (LATIN_RANGE.test(ch)) latin++;
    }
  }

  const total = hebrew + latin + cjk;
  if (total < 50) return 'other';
  // A lower bar than the others on purpose: Japanese is written with Latin
  // letters mixed in constantly — brand names, URLs, "lol" — and a chat that is
  // a quarter kana is not an English chat with decoration.
  if (cjk / total > 0.25) return 'ja';
  if (hebrew / total > 0.35) return 'he';
  if (latin / total > 0.5) return 'en';
  return 'other';
}

const EN_STOPWORDS = [
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
  'off','yes','ok','okay','yeah','yep','nope','im','ive','id','ill','dont',
  'doesnt','didnt','cant','wont','isnt','arent','wasnt','werent','thats','whats',
  'lets','ya','u','ur','oh','ah','eh','hmm','um','uh','like','get','got',
  'go','going','went','one','two','know','think','see','say','said','want','need',
  'good','well','really','back','still','even','make','made','take','look','come',
  'time','way','thing','things','much','many','lot','bit','sure','right','left',
];

/**
 * Hebrew function words. Slang is deliberately NOT filtered — יאללה, סבבה and
 * אחי are exactly the kind of word whose frequency is funny, and stripping them
 * would leave the top-words slide as bland as an English list without "the".
 */
const HE_STOPWORDS = [
  'של','את','לא','זה','אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
  'מה','מי','איפה','מתי','איך','למה','כן','יש','אין','על','עם','אל','כי','גם','רק',
  'אבל','אז','עוד','כל','כמו','אם','או','הזה','זאת','זו','היה','היתה','היו','יהיה',
  'להיות','אמר','אמרה','עושה','לעשות','אני','שלי','שלך','שלו','שלה','שלנו','שלכם',
  'שלהם','לי','לך','לו','לה','לנו','לכם','להם','אותי','אותך','אותו','אותה','אותנו',
  'הרבה','מאוד','ממש','אולי','צריך','צריכה','רוצה','יכול','יכולה','בא','באמת',
  'ככה','פשוט','קצת','טוב','טובה','יותר','הכי','פה','שם','כאן','עכשיו','אחר','אחרי',
  'לפני','בין','תחת','מעל','כדי','אשר','היום','אתמול','מחר','כבר','עדיין','שוב',
  'הזאת','האלה','ואני','שאני','שזה','וזה','כשאני','אנשים','דבר','משהו','מישהו',
  'איזה','איזו','כמה','למי','ממה','בכל','בגלל','למרות','אפילו','בערך','בדיוק',
];

/**
 * Japanese particles, copulas and the handful of words every chat is made of.
 *
 * Longer than it looks because Japanese glues its grammar onto the end of
 * words: です, ます, した and って are not words anybody means, but they are what
 * a segmenter hands back most often. Slang and laughter are left in for the
 * same reason they are left in Hebrew — 草 and めっちゃ are exactly the words
 * whose frequency is the joke.
 */
const JA_STOPWORDS = [
  'の','に','は','を','た','が','で','て','と','し','れ','さ','ある','いる','も','する',
  'から','な','こと','として','い','や','れる','など','なっ','ない','この','ため','その',
  'あっ','よう','また','もの','という','あり','まで','られ','なる','へ','か','だ','これ',
  'によって','により','おり','より','による','ず','なり','られる','において','ば','なかっ',
  'なく','しかし','について','せ','だっ','その後','できる','それ','う','ので','なお','のみ',
  'でき','き','つ','における','および','いう','さらに','でも','ら','たり','その他','に関する',
  'たち','ます','ん','なら','に対して','特に','せる','及び','これら','とき','では','にて',
  'ほか','ながら','うち','そして','とともに','ただし','かつて','それぞれ','または','に対する',
  'です','ました','ください','そう','どう','なに','なん','じゃ','けど','って','ね','よ','わ',
  'あの','その','どの','ここ','そこ','あそこ','いい','やっぱり','ちょっと','みたい','思う',
];

const STOPWORDS: Record<ChatLanguage, Set<string>> = {
  en: new Set(EN_STOPWORDS),
  he: new Set(HE_STOPWORDS),
  ja: new Set(JA_STOPWORDS),
  // For an unrecognised language, filtering with the wrong list is worse than
  // not filtering: it silently deletes real content words.
  other: new Set(),
};

export function stopwordsFor(language: ChatLanguage): ReadonlySet<string> {
  return STOPWORDS[language];
}

/**
 * Minimum token length worth counting. Hebrew packs meaning into shorter
 * tokens than English does — a three-character floor would throw away most of
 * the interesting words — and Japanese packs it shorter still: 猫, 家, 米 are
 * whole words, and the particles that are also one character are filtered by
 * the stopword list instead.
 */
export function minWordLength(language: ChatLanguage): number {
  if (language === 'ja') return 1;
  return language === 'he' ? 2 : 3;
}

/**
 * A word segmenter for languages that do not separate words with spaces.
 *
 * Japanese writes 今日は寿司を食べた as one unbroken run, so the whitespace
 * tokeniser that serves every other language hands back the entire sentence as
 * a single "word" — and the vocabulary slides then show one clause with a count
 * of one, over and over. ICU knows where the boundaries are and ships with the
 * runtime, so this costs nothing to use and needs no dictionary of our own.
 *
 * Null for every other language: for those the existing regex is both correct
 * and considerably faster, and this runs over every message in the export.
 */
export function wordSegmenterFor(language: ChatLanguage): Intl.Segmenter | null {
  if (language !== 'ja') return null;
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
  return new Intl.Segmenter('ja', { granularity: 'word' });
}
