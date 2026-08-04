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

export type ChatLanguage = 'en' | 'he' | 'other';

const HEBREW_RANGE = new RegExp('[\\u0590-\\u05FF]');
const LATIN_RANGE = /[A-Za-z]/;

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
  let seen = 0;

  const step = Math.max(1, Math.floor(messages.length / sampleSize));
  for (let i = 0; i < messages.length && seen < sampleSize; i += step) {
    const m = messages[i]!;
    if (m.kind !== 'text' || !m.sender) continue;
    seen++;
    for (const ch of m.body) {
      if (HEBREW_RANGE.test(ch)) hebrew++;
      else if (LATIN_RANGE.test(ch)) latin++;
    }
  }

  const total = hebrew + latin;
  if (total < 50) return 'other';
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

const STOPWORDS: Record<ChatLanguage, Set<string>> = {
  en: new Set(EN_STOPWORDS),
  he: new Set(HE_STOPWORDS),
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
 * the interesting words.
 */
export function minWordLength(language: ChatLanguage): number {
  return language === 'he' ? 2 : 3;
}
