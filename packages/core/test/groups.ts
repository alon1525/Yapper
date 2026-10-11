/**
 * Synthetic *groups*, one per shape of chat the report generator has to survive.
 *
 * `fixtures.ts` holds one trap per parser bug. These are a different animal:
 * each one is a small but internally consistent social situation, written so
 * that a specific discovery either is or is not available in it. The gym group
 * really does schedule more than it trains; the two-person group really is
 * dominated by two people; and the group whose top-scoring moment is a
 * bereavement really does look funny to a laughter counter and must not be
 * treated as funny.
 *
 * They are written as builders rather than constants because a plan that stalls
 * for three years needs thirty-odd dated messages, and thirty hand-written
 * timestamps is thirty chances to typo one into the wrong year.
 */

type Line = { day: number; month: number; year: number; hour: number; minute: number; who: string; text: string };

function render(lines: readonly Line[]): string {
  return lines
    .map(
      (l) =>
        `${String(l.day).padStart(2, '0')}/${String(l.month).padStart(2, '0')}/${l.year}, ` +
        `${String(l.hour).padStart(2, '0')}:${String(l.minute).padStart(2, '0')} - ${l.who}: ${l.text}`,
    )
    .join('\n');
}

/** Terse helper: `at(14, 3, 2023, 20, 15, 'Daniel', 'hi')`. */
function at(
  day: number,
  month: number,
  year: number,
  hour: number,
  minute: number,
  who: string,
  text: string,
): Line {
  return { day, month, year, hour, minute, who, text };
}

/**
 * A gym group that schedules relentlessly and trains rarely.
 *
 * Daniel is the unlicensed personal trainer: he says "tomorrow we start
 * seriously" across three separate months, which is what makes it a pattern
 * rather than a bad Tuesday. Deliberately spread over multiple days so a
 * `member_persona` finding can clear the two-distinct-days rule.
 */
export const GYM_GROUP = render([
  at(12, 1, 2023, 20, 0, 'Daniel', 'tomorrow we start seriously'),
  at(12, 1, 2023, 20, 1, 'Ron', 'you said that in november'),
  at(12, 1, 2023, 20, 2, 'Daniel', 'this time is different, I bought protein'),
  at(12, 1, 2023, 20, 3, 'Avi', 'חחחחח'),
  at(12, 1, 2023, 20, 4, 'Ron', 'protein is not a personality'),

  at(19, 2, 2023, 9, 15, 'Daniel', 'gym at 7 tomorrow, everyone in'),
  at(19, 2, 2023, 9, 40, 'Ron', 'im in'),
  at(19, 2, 2023, 9, 41, 'Avi', 'im in'),
  at(19, 2, 2023, 22, 10, 'Daniel', 'actually lets move it to sunday'),
  at(19, 2, 2023, 22, 11, 'Ron', 'hahaha of course'),

  at(3, 3, 2023, 8, 0, 'Daniel', 'tomorrow we start seriously, no excuses'),
  at(3, 3, 2023, 8, 30, 'Avi', 'we have heard this before'),
  at(3, 3, 2023, 8, 31, 'Ron', 'lol'),
  at(3, 3, 2023, 8, 32, 'Daniel', 'I am serious about the protein thing'),

  at(14, 4, 2023, 19, 0, 'Daniel', 'protein shake recommendations?'),
  at(14, 4, 2023, 19, 5, 'Avi', 'you have not been to the gym since january'),
  at(14, 4, 2023, 19, 6, 'Daniel', 'tomorrow we start seriously'),
  at(14, 4, 2023, 19, 7, 'Ron', 'haha'),
]);

/**
 * A group that has been almost booking the same trip since 2023.
 *
 * The vocabulary never moves on — still "book", still "hotel", still
 * "spreadsheet" — across eight months, which is the signature `findStalledPlans`
 * is built to detect.
 */
export const STALLED_PLAN_GROUP = render([
  at(5, 1, 2023, 12, 0, 'Maya', 'ok so the trip. I made a spreadsheet'),
  at(5, 1, 2023, 12, 1, 'Tom', 'legend'),
  at(5, 1, 2023, 12, 2, 'Noa', 'when are we booking the hotel'),
  at(5, 1, 2023, 12, 3, 'Maya', 'this week for sure'),

  at(20, 3, 2023, 18, 0, 'Noa', 'so what about that trip'),
  at(20, 3, 2023, 18, 1, 'Maya', 'the spreadsheet is still there'),
  at(20, 3, 2023, 18, 2, 'Tom', 'we should book the hotel before summer'),

  at(11, 6, 2023, 21, 0, 'Tom', 'reminder that we have a trip spreadsheet'),
  at(11, 6, 2023, 21, 1, 'Noa', 'and no hotel'),
  at(11, 6, 2023, 21, 2, 'Maya', 'booking it tomorrow'),

  at(2, 9, 2023, 10, 0, 'Noa', 'the trip'),
  at(2, 9, 2023, 10, 1, 'Tom', 'the hotel'),
  at(2, 9, 2023, 10, 2, 'Maya', 'the spreadsheet'),
  at(2, 9, 2023, 10, 3, 'Noa', 'we are booking nothing, ever'),
]);

/**
 * One phrase, coined by one person, adopted by everyone months later.
 *
 * Gil says "יאללה בלגן" alone through January and February; the others pick it
 * up from May. That gap is the whole test — `analyzePhrases` must not call two
 * people using a phrase in the same conversation a contagion.
 */
export const CONTAGION_GROUP = render([
  at(4, 1, 2023, 11, 0, 'Gil', 'יאללה בלגן'),
  at(4, 1, 2023, 11, 1, 'Dana', 'מה'),
  at(18, 1, 2023, 15, 0, 'Gil', 'יאללה בלגן אנחנו יוצאים'),
  at(2, 2, 2023, 9, 0, 'Gil', 'יאללה בלגן'),
  at(21, 2, 2023, 20, 0, 'Gil', 'יאללה בלגן שוב'),

  at(9, 5, 2023, 13, 0, 'Dana', 'יאללה בלגן'),
  at(9, 5, 2023, 13, 1, 'Gil', 'סוף סוף'),
  at(30, 6, 2023, 17, 0, 'Ori', 'יאללה בלגן'),
  at(30, 6, 2023, 17, 1, 'Dana', 'יאללה בלגן'),
  at(12, 8, 2023, 19, 0, 'Ori', 'יאללה בלגן חברים'),
  at(12, 8, 2023, 19, 1, 'Gil', 'מה עשיתי'),
]);

/**
 * Two people who talk only to each other, in a group of five.
 *
 * The ping-pong detector must find Yossi/Rivka rather than simply naming the two
 * loudest people, so the other three are present and do talk.
 */
export const PING_PONG_GROUP = render([
  /*
    Six real back-and-forths on six days. They have to be minutes apart to count
    as answering each other at all — a "conversation" whose turns are a day
    apart is two monologues, and an earlier version of this fixture made exactly
    that mistake and found no pair.
  */
  ...[3, 6, 9, 12, 15, 18].flatMap((day) =>
    Array.from({ length: 8 }, (_, i) =>
      at(
        day,
        4,
        2023,
        20,
        i * 3,
        i % 2 === 0 ? 'Yossi' : 'Rivka',
        i % 2 === 0 ? `so anyway ${i}` : `exactly ${i}`,
      ),
    ),
  ),
  // The rest of the group exists and talks, just never to those two.
  at(5, 4, 2023, 9, 0, 'Ella', 'good morning everyone'),
  at(5, 4, 2023, 9, 4, 'Boaz', 'morning'),
  at(7, 4, 2023, 9, 0, 'Ella', 'has anyone seen my charger'),
  at(7, 4, 2023, 9, 6, 'Hila', 'no'),
  at(11, 4, 2023, 9, 0, 'Boaz', 'anyone around this weekend'),
  at(11, 4, 2023, 9, 8, 'Hila', 'maybe'),
  at(13, 4, 2023, 9, 0, 'Ella', 'still looking for that charger'),
  at(13, 4, 2023, 9, 5, 'Boaz', 'still no'),
]);

/**
 * The trap the specification calls out by name: the highest-scoring moment by
 * automated signals is not funny.
 *
 * There is a long, dense, many-participant burst here — every density and
 * engagement signal fires — and it is somebody's grandmother dying. Nothing
 * automated should be allowed to promote this to a comedy slide on burst
 * metrics alone, and the conflict/laughter scoring must not read it as either.
 */
export const SOMBRE_PEAK_GROUP = render([
  at(6, 2, 2023, 8, 0, 'Lior', 'morning'),
  at(6, 2, 2023, 8, 5, 'Adi', 'morning'),
  at(7, 2, 2023, 12, 0, 'Lior', 'lunch?'),
  at(7, 2, 2023, 12, 5, 'Adi', 'cant today'),

  at(9, 2, 2023, 19, 0, 'Adi', 'my grandmother passed away this afternoon'),
  at(9, 2, 2023, 19, 1, 'Lior', 'oh no'),
  at(9, 2, 2023, 19, 2, 'Shira', 'I am so sorry'),
  at(9, 2, 2023, 19, 3, 'Lior', 'sending love'),
  at(9, 2, 2023, 19, 4, 'Tal', 'thinking of you'),
  at(9, 2, 2023, 19, 5, 'Shira', 'here if you need anything'),
  at(9, 2, 2023, 19, 6, 'Adi', 'thank you all'),
  at(9, 2, 2023, 19, 7, 'Tal', 'anything at all'),
  at(9, 2, 2023, 19, 8, 'Lior', 'we are here'),

  at(20, 2, 2023, 9, 0, 'Lior', 'coffee?'),
  at(20, 2, 2023, 9, 5, 'Adi', 'yes'),
]);

/** A group where almost nobody speaks — most stats should be suppressed. */
export const QUIET_GROUP = render([
  at(1, 3, 2023, 10, 0, 'Ann', 'hi'),
  at(14, 5, 2023, 11, 0, 'Ben', 'hi'),
  at(2, 9, 2023, 12, 0, 'Ann', 'still here'),
  at(8, 12, 2023, 13, 0, 'Cara', 'me too'),
]);

/** Brand new: a fortnight old, nothing to draw an arc from. */
export const NEW_GROUP = render([
  at(1, 6, 2026, 9, 0, 'Ivy', 'welcome to the group'),
  at(1, 6, 2026, 9, 1, 'Jon', 'thanks'),
  at(1, 6, 2026, 9, 2, 'Kim', 'hello'),
  at(3, 6, 2026, 14, 0, 'Ivy', 'first plan: dinner friday'),
  at(3, 6, 2026, 14, 5, 'Jon', 'im in'),
  at(3, 6, 2026, 14, 6, 'Kim', 'im in'),
]);

/**
 * Hebrew and English interleaved, as most Israeli group chats actually are.
 *
 * Long enough for `detectLanguage` to reach its fifty-character floor: below
 * that it correctly answers `other`, and a fixture that trips the floor tests
 * the floor rather than the thing it was written for.
 */
export const MULTILINGUAL_GROUP = render([
  at(4, 4, 2023, 10, 0, 'Omer', 'מה קורה חברים, איך היה הסופש שלכם'),
  at(4, 4, 2023, 10, 1, 'Ben', 'all good אחי, היה ממש כיף בצפון'),
  at(4, 4, 2023, 10, 2, 'Omer', 'מתי נפגשים? כבר חודש שלא ראינו אותך'),
  at(4, 4, 2023, 10, 3, 'Ben', 'תגידו אתם מתי, אני גמיש השבוע'),
  at(6, 4, 2023, 10, 0, 'Ben', 'friday works לי אם זה עדיין רלוונטי'),
  at(6, 4, 2023, 10, 1, 'Omer', 'סבבה גמור, אני מארגן את הכל'),
  at(6, 4, 2023, 10, 2, 'Ben', 'איפה נפגשים בסוף? צריך לדעת מראש'),
  at(8, 4, 2023, 10, 0, 'Ben', 'מה התוכנית להערב, מישהו יודע'),
  at(8, 4, 2023, 10, 1, 'Omer', 'אין תוכנית, כרגיל אצלנו'),
  at(8, 4, 2023, 10, 2, 'Ben', 'מתי סוף סוף נעשה משהו מסודר'),
]);

/** Heavy on media placeholders and deleted messages. */
export const MEDIA_GROUP = [
  '01/02/2023, 10:00 - Nir: <Media omitted>',
  '01/02/2023, 10:01 - Nir: <Media omitted>',
  '01/02/2023, 10:02 - Nir: <Media omitted>',
  '01/02/2023, 10:03 - Shai: please stop',
  '02/02/2023, 11:00 - Nir: This message was deleted',
  '02/02/2023, 11:01 - Shai: what did it say',
  '02/02/2023, 11:02 - Nir: This message was deleted',
  '03/02/2023, 12:00 - Shai: sticker omitted',
  '03/02/2023, 12:01 - Nir: image omitted',
  '04/02/2023, 09:00 - Shai: I edited this one <This message was edited>',
].join('\n');

/**
 * One member arrives repeatedly on the same evening, which is the only
 * self-contradiction a text export can actually prove.
 */
export const FIVE_MINUTES_GROUP = render([
  at(7, 7, 2023, 19, 0, 'Eitan', 'on my way'),
  at(7, 7, 2023, 19, 20, 'Eitan', '5 minutes'),
  at(7, 7, 2023, 19, 45, 'Eitan', 'almost there'),
  at(7, 7, 2023, 20, 10, 'Eitan', '5 min'),
  at(7, 7, 2023, 20, 11, 'Yael', 'we ordered without you'),
  at(14, 7, 2023, 19, 0, 'Eitan', 'omw'),
  at(14, 7, 2023, 19, 30, 'Eitan', 'almost there'),
  at(14, 7, 2023, 19, 55, 'Eitan', '2 minutes'),
  at(14, 7, 2023, 19, 56, 'Yael', 'incredible'),
]);

/** A confident prediction, and the record of it failing. */
export const PROPHECY_GROUP = render([
  at(2, 1, 2023, 21, 0, 'Guy', 'I guarantee we will be in the final this year'),
  at(2, 1, 2023, 21, 1, 'Ido', 'writing this down'),
  at(3, 5, 2023, 22, 0, 'Ido', 'so about that final'),
  at(3, 5, 2023, 22, 1, 'Guy', 'we do not talk about that'),
  at(9, 9, 2023, 20, 0, 'Ido', 'reminder that Guy guaranteed the final'),
  at(9, 9, 2023, 20, 1, 'Guy', 'I stand by it'),
]);

/** One person monologuing at a sleeping group. */
export const MONOLOGUE_GROUP = render([
  ...Array.from({ length: 14 }, (_, i) =>
    at(11, 11, 2023, 2, 10 + i, 'Roi', `thought number ${i + 1}`),
  ),
  at(11, 11, 2023, 9, 30, 'Tamar', 'what happened here'),
]);
