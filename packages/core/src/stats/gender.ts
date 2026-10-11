import type { ParseResult } from '../types';

/**
 * Grammatical gender, read off how each person writes about themselves and
 * how the others write about them.
 *
 * Hebrew conjugates the present tense for gender, and so does every verdict,
 * epithet and beat the writer puts on a card. The writer never sees a name —
 * only `Person H` — so it cannot read the gender off one, and a card that calls
 * a woman "הוא" and "כותב" is the single most noticed mistake a Hebrew report
 * can make: every member of the group sees it in the first second, and it
 * tells them nobody who knows them wrote this.
 *
 * Two signals. First-person predicates — "אני יכולה", "אני מגיעה", "אני
 * עייפה" are said by women; "אני יכול", "אני מגיע", "אני עייף" by men — which
 * is the strong one, and which somebody with a few hundred messages produces
 * dozens of. And the predicates other people attach to this person's name —
 * "ליאת באה?", "ליאת אמרה", "ליאת את" — which is weaker per hit but is the
 * only signal there is for the quiet member everyone talks about and who
 * rarely talks. The quiet member is exactly who the first deck got wrong.
 *
 * The threshold is deliberately strict — three points and a three-to-one
 * majority — because the cost of a wrong guess is the mistake this exists to
 * prevent, and the cost of no guess is a writer told to phrase around it.
 *
 * Hebrew only, by construction: the forms below are Hebrew. On any other chat
 * the map comes back empty, which is the honest answer rather than a wrong
 * one. Romance and Slavic output languages mark gender too, but there the
 * writer can read it off the person's own messages directly.
 */

export type GrammaticalGender = 'm' | 'f';

/** Common first-person predicates, masculine then feminine. */
const SELF_PAIRS: readonly (readonly [string, string])[] = [
  ['יכול', 'יכולה'],
  ['צריך', 'צריכה'],
  ['חושב', 'חושבת'],
  ['מגיע', 'מגיעה'],
  ['בא', 'באה'],
  ['הולך', 'הולכת'],
  ['עובד', 'עובדת'],
  ['מבין', 'מבינה'],
  ['יודע', 'יודעת'],
  ['אוהב', 'אוהבת'],
  ['נוסע', 'נוסעת'],
  ['יושב', 'יושבת'],
  ['חוזר', 'חוזרת'],
  ['נמצא', 'נמצאת'],
  ['אומר', 'אומרת'],
  ['מרגיש', 'מרגישה'],
  ['עייף', 'עייפה'],
  ['רעב', 'רעבה'],
  ['מוכן', 'מוכנה'],
  ['בטוח', 'בטוחה'],
  ['מסכים', 'מסכימה'],
  ['זוכר', 'זוכרת'],
  ['שמח', 'שמחה'],
  ['מצטער', 'מצטערת'],
  ['לוקח', 'לוקחת'],
  ['יוצא', 'יוצאת'],
  ['נכנס', 'נכנסת'],
  ['שולח', 'שולחת'],
  ['קורא', 'קוראת'],
  ['שומע', 'שומעת'],
  ['מדבר', 'מדברת'],
  ['כותב', 'כותבת'],
  ['מתכוון', 'מתכוונת'],
  ['מסתדר', 'מסתדרת'],
  ['מעדיף', 'מעדיפה'],
  ['מת', 'מתה'],
  ['חייב', 'חייבת'],
  ['גר', 'גרה'],
  ['לומד', 'לומדת'],
  ['ישן', 'ישנה'],
  ['קם', 'קמה'],
  ['אוכל', 'אוכלת'],
  ['עסוק', 'עסוקה'],
  ['מתגעגע', 'מתגעגעת'],
  ['מקבל', 'מקבלת'],
  ['נותן', 'נותנת'],
  ['מביא', 'מביאה'],
  ['מכיר', 'מכירה'],
  ['מאמין', 'מאמינה'],
  ['מתחיל', 'מתחילה'],
  ['מסיים', 'מסיימת'],
  ['גומר', 'גומרת'],
  ['תקוע', 'תקועה'],
  ['מאחר', 'מאחרת'],
  ['ממהר', 'ממהרת'],
  ['אמור', 'אמורה'],
  ['צודק', 'צודקת'],
  ['סגור', 'סגורה'],
  ['ער', 'ערה'],
  ['מוכרח', 'מוכרחה'],
  ['משתדל', 'משתדלת'],
  ['מצטרף', 'מצטרפת'],
];

/**
 * What follows somebody's name when the others talk to or about them,
 * masculine then feminine: the second-person pronoun, the third-person pronoun,
 * and the common third-person verbs in present and past.
 */
const NAMED_PAIRS: readonly (readonly [string, string])[] = [
  ['אתה', 'את'],
  ['הוא', 'היא'],
  ['אמר', 'אמרה'],
  ['כתב', 'כתבה'],
  ['שלח', 'שלחה'],
  ['בא', 'באה'],
  ['הלך', 'הלכה'],
  ['מגיע', 'מגיעה'],
  ['יכול', 'יכולה'],
  ['הולך', 'הולכת'],
  ['צריך', 'צריכה'],
  ['חושב', 'חושבת'],
  ['יודע', 'יודעת'],
  ['עובד', 'עובדת'],
  ['נוסע', 'נוסעת'],
  ['חוזר', 'חוזרת'],
  ['נמצא', 'נמצאת'],
  ['אמור', 'אמורה'],
  ['מצטרף', 'מצטרפת'],
  ['ישן', 'ישנה'],
  ['תבוא', 'תבואי'],
  ['תגיד', 'תגידי'],
  ['תשלח', 'תשלחי'],
  ['תענה', 'תעני'],
  ['תביא', 'תביאי'],
  ['תעדכן', 'תעדכני'],
];

/** Small words that sit between the subject and the predicate without changing it. */
const ADVERB = '(?:(?:לא|כבר|עדיין|גם|ממש|די|רק|עוד|קצת|בטח|אולי|אז|נו|רגע|מה|אבל)\\s+)?';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function alternation(forms: readonly string[]): string {
  return forms.filter((f, i, all) => all.indexOf(f) === i).map(escape).join('|');
}

/*
  Only forms that differ between the two columns count: a word that is the
  same for everyone would score a point for both sides on every use, drowning
  the real signal in a tie.
*/
const SELF = SELF_PAIRS.filter(([m, f]) => m !== f);
const SELF_M = new RegExp(`אני\\s+${ADVERB}(?:${alternation(SELF.map(([m]) => m))})(?![\\p{L}])`, 'gu');
const SELF_F = new RegExp(`אני\\s+${ADVERB}(?:${alternation(SELF.map(([, f]) => f))})(?![\\p{L}])`, 'gu');

const NAMED = NAMED_PAIRS.filter(([m, f]) => m !== f);
const NAMED_M = alternation(NAMED.map(([m]) => m));
const NAMED_F = alternation(NAMED.map(([, f]) => f));

/**
 * The word the others actually use for this person: the first Hebrew word of
 * their display name, when it is one. "ליאת🕎" is addressed as ליאת;
 * "+972 58-…" and "Turtle" are not addressed in Hebrew at all, and a two-letter
 * name matches too much of the language to be safe.
 */
function hebrewFirstName(displayName: string): string | null {
  const first = displayName
    .normalize('NFC')
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)[0];
  return first && /^[א-ת]{3,}$/u.test(first) ? first : null;
}

const SELF_WEIGHT = 2;
const NAMED_WEIGHT = 1;
const MIN_SCORE = 3;
const MIN_MAJORITY = 0.75;

/**
 * Who writes — and is written about — in which gender, keyed by display name.
 *
 * Absent from the map means "could not tell" — too little to go on, or a
 * split that does not reach a clear majority. Callers pass the gap on to the
 * writer as a gap, never as a default.
 */
export function inferGenders(parsed: ParseResult): Map<string, GrammaticalGender> {
  const tally = new Map<string, { m: number; f: number }>();
  const bump = (name: string, m: number, f: number) => {
    if (m === 0 && f === 0) return;
    const count = tally.get(name) ?? { m: 0, f: 0 };
    count.m += m;
    count.f += f;
    tally.set(name, count);
  };

  const named = parsed.participants
    .map((name) => {
      const first = hebrewFirstName(name);
      if (!first) return null;
      const lead = `(?<![\\p{L}])${escape(first)}[,!.]?\\s+${ADVERB}`;
      return {
        name,
        first,
        m: new RegExp(`${lead}(?:${NAMED_M})(?![\\p{L}])`, 'gu'),
        f: new RegExp(`${lead}(?:${NAMED_F})(?![\\p{L}])`, 'gu'),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  for (const message of parsed.messages) {
    if (message.kind !== 'text' || !message.sender) continue;
    const body = message.body;

    // Cheap pre-checks: the patterns need the pronoun or the name, and most
    // messages in any chat contain neither.
    if (body.includes('אני')) {
      bump(
        message.sender,
        (body.match(SELF_M)?.length ?? 0) * SELF_WEIGHT,
        (body.match(SELF_F)?.length ?? 0) * SELF_WEIGHT,
      );
    }
    for (const person of named) {
      if (person.name === message.sender || !body.includes(person.first)) continue;
      bump(
        person.name,
        (body.match(person.m)?.length ?? 0) * NAMED_WEIGHT,
        (body.match(person.f)?.length ?? 0) * NAMED_WEIGHT,
      );
    }
  }

  const out = new Map<string, GrammaticalGender>();
  for (const [name, { m, f }] of tally) {
    const total = m + f;
    if (total < MIN_SCORE) continue;
    if (m / total >= MIN_MAJORITY) out.set(name, 'm');
    else if (f / total >= MIN_MAJORITY) out.set(name, 'f');
  }
  return out;
}
