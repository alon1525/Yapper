import type { Copy } from './en';

/**
 * עברית.
 *
 * Written as an Israeli would say it, not as the English would translate: the
 * group is addressed in the plural, buttons are infinitives ("לשתף", "להמשיך"),
 * and Reg's lines keep their dryness rather than being softened on the way
 * over. Where English leans on "they" to dodge a person's gender, the Hebrew
 * is rebuilt around a noun or a passive so it never has to guess one.
 *
 * Arrows run the other way: a flow written "A → B" in English is "A ← B" here,
 * because the eye reads it right to left. The 24-hour clock is the only clock
 * anyone in Israel uses, so the hour templates take `h24`.
 *
 * The deck and the onboarding sheet set `dir="rtl"` on themselves when this
 * table is in use; this file only supplies the words.
 */
export const HE: Partial<Copy> = {
  // ── The deck's chrome ──────────────────────────────────────────────────
  'deck.next': 'השקופית הבאה',
  'deck.prev': 'השקופית הקודמת',
  'deck.restart': 'חזרה להתחלה',
  'deck.mute': 'להשתיק את הפסקול',
  'deck.unmute': 'להפעיל את הפסקול',
  'deck.tap': 'הקישו ←',
  'deck.end': 'הסוף',

  // ── Free slides ────────────────────────────────────────────────────────
  'welcome.fallbackName': 'הצ׳אט שלכם',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'רג קרא את כל {messages} ההודעות, כדי שאתם לא תצטרכו. {days} של זה. מקישים וממשיכים. ווליום למעלה.',

  'total.eyebrow': 'סך כל הנזק',
  'total.unit': 'הודעות · {people} אנשים',
  'total.punchline':
    'זה {perDay} ביום, כל יום, במשך {days}. כולל השנים שבהן, לטענתכם, ״לא היה לכם זמן״.',
  'total.words': 'מילים',
  'total.emoji': 'אימוג׳י',
  'total.media': 'מדיה',

  'talker.eyebrow': 'דירוג הקשקשנים',
  'talker.punchline': '{share} מכל ההודעות בצ׳אט הזה יצאו מבנאדם אחד.',
  'talker.punchlineRunnerUp': 'פי {times} מ{name}, שבכלל לא בתחרות.',

  'hours.eyebrow': 'מתי אתם מקשקשים',
  'hours.peak': 'שעת השיא: {hour}',
  'hours.punchline':
    '{count} הודעות נשלחו בין חצות לחמש בבוקר. אף אחד לא ביקש אותן. הן הגיעו בכל זאת.',
  'hours.tag': 'משמרת לילה: {name} · {count} אחרי חצות',

  'fastest.eyebrow': 'האצבע הכי מהירה במערב',
  'fastest.punchline':
    'ב‑{count} תגובות, התשובה הגיעה עוד לפני שמישהו בכלל סיים לקרוא.',
  'fastest.fastest': 'הכי מהיר',
  'fastest.slowest': 'הכי איטי · {name}',

  'ghost.eyebrow': 'רוח רפאים מוסמכת',
  'ghost.punchline': 'כל כך הרבה זמן, בלי הודעה אחת.',
  'ghost.stillGone': 'ומאז — שום סימן חיים. הקבוצה המשיכה הלאה.',
  'ghost.returned': 'ואז — חזרה מפוארת, כאילו כלום לא קרה.',
  'ghost.lastSeen': 'נראה לאחרונה',
  'ghost.stillGoneLabel': 'עדיין לא חזר',
  'ghost.resurfaced': 'סימן חיים',

  'emoji.eyebrow': 'פודיום האימוג׳י',
  'emoji.punchline':
    '{emoji} הופיע {count} פעמים. אף שיחה רצינית כאן לא החזיקה מעמד מספיק זמן כדי להצדיק אימוג׳י שני.',
  'emoji.punchlineRunnerUp':
    '{emoji} הופיע {count} פעמים — פי {times} מ{other}. אף שיחה רצינית כאן לא החזיקה מעמד מספיק זמן כדי להצדיק אימוג׳י שני.',

  'chaos.eyebrow': 'שיא הבלגן',
  'chaos.unit': '{count} הודעות ביום אחד',
  'chaos.punchline': 'פי {times} מיום רגיל כאן. משהו קרה. כולם זוכרים מה.',

  'streak.eyebrow': 'הרצף הכי ארוך',
  'streak.days': 'ימים',
  'streak.punchline': 'אפס ימים שקטים בין {from} ל{to}.',
  'streak.silence':
    'ובקצה השני: {days} של דממה מוחלטת, שנשברה סוף סוף ב״{quote}״.',
  'streak.tag': 'כאן לא משאירים הודעות לא נקראות',

  // ── The endings ────────────────────────────────────────────────────────
  'final.eyebrow': 'פסק הדין',
  'final.headline': 'שלחו לקבוצה',
  'final.punchline':
    '{messages} הודעות, {span}, ואיכשהו אף אחד עוד לא עזב. זאת אהבה, טכנית.',
  'final.privacy': 'הצ׳אט שלכם לא הועלה לשום מקום. סוגרים את הטאב — והוא נעלם.',
  'final.privacySaved':
    'הצ׳אט שלכם לא הועלה לשום מקום. הדוח הזה חי רק בדפדפן הזה, ובשום מקום אחר.',
  'final.restart': 'לנסות צ׳אט אחר',
  'final.save': 'לשמור את הדוח במכשיר הזה',
  'final.saveAgain': 'לעדכן את העותק השמור עם הדוח המלא',
  'final.saving': 'שומר…',
  'final.saved': 'נשמר במכשיר הזה. תמצאו אותו בעמוד הראשי, תחת My reports.',
  'final.saveFailed': 'לא הצלחנו לשמור כאן — הדפדפן חוסם אחסון של האתר.',

  // ── Sharing ────────────────────────────────────────────────────────────
  'share.open': 'ליצור כרטיס לשיתוף',
  'share.title': 'בחרו מה לפרסם',
  'share.lede':
    'כל כרטיס הוא תמונה ביחס 9:16 שנבנית במכשיר שלכם. שום דבר לא מועלה — התמונה נוצרת כאן ועוברת ישר לאפליקציה שתבחרו.',
  'share.count': '{n} נבחרו',
  'share.none': 'בחרו לפחות אחד',
  'share.share': 'לשתף',
  'share.sharing': 'פותח…',
  'share.save': 'לשמור לתמונות',
  'share.saveDesktop': 'להוריד',
  'share.saving': 'שומר…',
  'share.copyCaption': 'להעתיק כיתוב',
  'share.captionCopied': 'הכיתוב הועתק',
  'share.caption': '{messages} הודעות שלנו. Yapped קרא את כולן.',
  'share.hint':
    'וואטסאפ, אינסטגרם וטיקטוק נמצאים בתפריט השיתוף. באינסטגרם ובטיקטוק, בחרו את הכרטיס מהגלריה ופרסמו אותו כסטורי.',
  'share.hintDesktop':
    'דפדפן במחשב לא יכול לפתוח את תפריט השיתוף, אז הכרטיסים פשוט יורדים. שלחו אותם לטלפון, או פרסמו ישר מכאן.',
  'share.failed': 'זה לא עבד. הכרטיסים עדיין שמורים במכשיר שלכם.',
  'share.close': 'לסגור',
  'share.watermark': 'yapped',

  // ── Card faces ─────────────────────────────────────────────────────────
  'card.total.label': 'הודעות',
  'card.total.caption': '{days} של קשקושים. אף אחד עוד לא עזב.',
  'card.talker.label': 'הקשקשן הראשי',
  'card.talker.caption': '{share} מכל מה שנאמר כאן',
  'card.leaderboard.label': 'הטבלה',
  'card.hours.label': 'שעת השיא',
  'card.hours.caption': '{count} הודעות אחרי חצות',
  'card.ghost.label': 'רוח רפאים מוסמכת',
  'card.ghost.caption': '{days} בלי מילה',
  'card.emoji.label': 'הכי בשימוש',
  'card.emoji.caption': 'הופיע {count} פעמים',
  'card.chaos.label': 'שיא הבלגן',
  'card.chaos.caption': '{count} הודעות ביום אחד',
  'card.fastest.label': 'התגובה הכי מהירה',
  'card.fastest.caption': 'חציון מתוך {count} תגובות',
  'card.verdict.label': 'פסק הדין',
  'card.verdict.caption': '{people} אנשים · {span}',

  // ── Time and duration ──────────────────────────────────────────────────
  'time.midnight': 'חצות',
  'time.noon': '12:00',
  // Israel runs on a 24-hour clock; "7 בערב" is how you say it, "19:00" is how
  // you write it, and a poster is written.
  'time.am': '{h24}:00',
  'time.pm': '{h24}:00',
  'duration.underMinute': 'פחות מדקה',
  'duration.underSecond': 'פחות משנייה',
  'duration.seconds': '{n} שנ׳',
  'duration.minutes': '{n} דק׳',
  'duration.hours': '{n} שע׳',
  'duration.hoursMinutes': '{n} שע׳ {m} דק׳',
  'span.hours': '{n} שעות',
  'span.days': '{n} ימים',
  'span.months': '{n} חודשים',
  'span.years': '{n} שנים',

  // ── The wall ───────────────────────────────────────────────────────────
  'ai.headline': 'הגרסה של רג לאותו לילה',
  'ai.inspect': 'תראו לי בדיוק מה נשלח',
  'wall.turn': 'התור של רג',
  'wall.pitch': 'עד כאן ספרנו. מכאן רג כותב.',
  'wall.eyebrow': 'זאת הייתה הטעימה',
  'wall.previewLede': 'זה היה סיפור אחד. לרג יש את כל השאר — והפעם הוא יודע איך קוראים לכם.',
  'wall.names':
    'הדוח המלא הוא הבקשה היחידה שיוצאת עם השמות האמיתיים של הקבוצה — בלעדיהם הוא נשאר כללי. בעמוד הפרטיות כתוב בדיוק מה נשלח.',
  'wall.unlock': 'לפתוח את הרוסט המלא',
  'wall.sellStories': 'חמישה רגעים מההיסטוריה שלכם, כתובים עם קבלות',
  'wall.sellCards': 'תיק אישי על כל אחד ואחת בצ׳אט — כולל השקטים',
  'wall.sellAwards': 'טקס הפרסים המלא, זוכה אחד לכל קטגוריה',
  'wall.sellEras': 'השנים שלכם, שורה לכל שנה',
  'wall.cards': '{n} אנשים בצ׳אט. {n} תיקים.',
  'wall.tryFree': 'קודם סיפור אחד, בחינם',
  'wall.freeNote': 'בחינם, וכל שם מוחלף בכינוי לפני שמשהו יוצא מהדפדפן.',
  'wall.noPayment': 'עדיין אין כאן תשלום — הפתיחה חינם כל עוד המוצר בבנייה.',
  'wall.working': 'רג על זה',
  'wall.ready': 'נפתח',
  'wall.readyProse': 'זה כתוב. תמשיכו להקיש.',
  'wall.readyHint': 'עוד {n} שקופיות מחכות.',
  'wall.opened': 'נפתח מהמכשיר הזה. כדי שרג יכתוב את הדוח המלא, צריך לגרור את הייצוא שוב.',
  'wall.terms': 'תנאים',
  'wall.privacy': 'פרטיות',
  'wall.refunds': 'החזרים',

  // ── What Reg says he is doing while the report is written ──────────────
  'progress.stepUnlock': 'פתיחה',
  'progress.stepRead': 'קריאה של כל הצ׳אט',
  'progress.stepCheck': 'בדיקת הקבלות',
  'progress.stepWrite': 'כתיבת הדוח',
  'progress.unlock1': 'בודק את הפתיחה…',
  'progress.read1': 'קורא את כל {n} ההודעות. כן, את כולן.',
  'progress.read2': 'שם לב מי אף פעם לא עונה',
  'progress.read3': 'מחפש את התוכנית שכבר שנים היא ״בשבוע הבא״',
  'progress.read4': 'סופר כמה פעמים מישהו היה ״עוד חמש דקות״',
  'progress.read5': 'קורא את הריבים פעמיים',
  'progress.read6': 'מברר מי באמת מנהל את הקבוצה הזאת',
  'progress.read7': 'אוסף את הביטויים שמובנים רק כאן',
  'progress.read8': 'בוחר את הלילה שבו הכול התפרק',
  'progress.check1': 'בודק כל ציטוט מול הצ׳אט האמיתי',
  'progress.check2': 'זורק כל מה שרג לא יכול להוכיח',
  'progress.check3': 'מוודא שאף אחד לא מואשם במשהו שלא אמר',
  'progress.check4': 'מחליט אילו מספרים באמת מספרים עליכם משהו',
  'progress.write1': 'כותב את הבדיחות',
  'progress.write2': 'מוחק את הבדיחות שלא היו מצחיקות',
  'progress.write3': 'מחלק לכולם תארים שאף אחד לא ביקש',
  'progress.write4': 'בוחר אילו הודעות שלכם לצטט לכם בחזרה',
  'progress.write5': 'פותח תיק על {people} אנשים',
  'progress.write6': 'חותך כל משפט שנשמע כמו כרטיס ברכה',
  'progress.write7': 'מכוון את זה שיכאב בדיוק במידה הנכונה',
  'progress.preview1': 'קורא את הרגעים הכי טובים שלכם',
  'progress.preview2': 'בוחר את זה ששווה לספר',
  'progress.preview3': 'כותב אותו, עם השמות מוחלפים',
  'progress.longWait': 'זה לוקח דקה-שתיים. רג קורא לאט בכוונה.',
  'progress.shortWait': 'בערך חצי דקה.',

  // ── The paid slides' furniture ─────────────────────────────────────────
  'report.caseAgainst': 'התיק נגד {name}',
  'report.officialTitle': 'התואר הרשמי',
  'report.breaking': 'מבזק',
  'report.fieldNotes': 'רשימות מהשטח',
  'report.findings': 'ממצאים',
  'report.glossary': 'מילון מונחים',
  'report.memoriam': 'הספד',
  'report.matterOf': 'בעניין',
  'report.itemised': 'פירוט',
  'report.orgChart': 'מבנה ארגוני',
  'report.standings': 'הטבלה',
  'report.insideWords': 'מילים שלא אומרות כלום מחוץ לצ׳אט הזה',
  'report.howItWent': 'איך זה הלך',
  'report.showReceipts': 'להציג קבלות · {n}',
  'report.hideReceipts': 'להסתיר קבלות',
  'report.exhibit': 'מוצג {n} מתוך {m}',
  'report.exhibitOne': 'מוצג',
  'report.msgs': '{n} הודעות',
  'report.patchNotes': 'הערות גרסה',
  'report.noted': 'נרשם',
  'report.suspects': '{n} חשודים',
  'report.live': 'שידור חי',
  'report.roastedBy': 'נצלה על ידי רג · תייגו את החשודים',

  // ── The onboarding, from the second question onwards ────────────────────
  'ob.header': 'מכינים את הדוח שלכם',
  'ob.step': 'שלב {n} מתוך 7',
  'ob.reading': 'קורא',
  'ob.leave': 'לצאת מההגדרות',
  'ob.back': 'חזרה',
  'ob.skip': 'לדלג',
  'ob.continue': 'להמשיך',
  'ob.waiting': 'מחכים לקובץ שלכם',
  'ob.namesOk': 'השמות נכונים',
  'ob.photosDone': 'סיימנו — לתדרך את רג',
  'ob.optional': 'לא חובה',
  'ob.trail.notes': '{kind} · לא חובה',
  'ob.trail.upload': 'שום דבר לא מועלה — רג קורא את זה בדפדפן שלכם.',
  'ob.trail.people': '{merges} כפילויות אפשריות · {unnamed} בלי שם',
  'ob.trail.photos': '{people} אנשים · {faces} עם פרצוף',

  'ob.kind.q': 'שאלה 2 מתוך 3',
  'ob.kind.title': 'איזה סוג של צ׳אט זה?',
  'ob.kind.lede': 'ככה רג יודע מה הוא קורא. כמה חזק הוא הולך על זה — זאת השאלה הבאה.',
  'kind.partner': 'בן/בת זוג',
  'kind.partner.note': 'רומנטיקה, ריבים, מי אומר לילה טוב ראשון',
  'kind.bestFriend': 'הבסטי',
  'kind.bestFriend.note': 'אחד על אחד, בלי פילטרים',
  'kind.friends': 'קבוצת חברים',
  'kind.friends.note': 'הקלאסיקה. דירוגי בלגן.',
  'kind.family': 'משפחה',
  'kind.family.note': 'רוסט עדין יותר. בדרך כלל.',
  'kind.work': 'עבודה',
  'kind.work.note': 'נקי מספיק כדי לשתף במשרד',
  'kind.other': 'אחר',
  'kind.other.note': 'רג כבר יבין לבד',

  'ob.tone.q': 'וכמה חזק ללכת על זה?',
  'ob.tone.roast': 'בלי רחמים',
  'ob.tone.roast.note': 'בלי נחיתה רכה, ובלי לרחם על אף אחד בסוף.',
  'ob.tone.gentle': 'בעדינות',
  'ob.tone.gentle.note': 'עדיין מצחיק, עדיין מדויק. אף אחד לא נפגע.',

  'ob.notes.q': 'שאלה 3 מתוך 3',
  'ob.notes.title': 'משהו שרג צריך לדעת?',
  'ob.notes.lede':
    'בדיחות פנימיות, כינויים, מי יוצא עם מי, האירוע ההוא שאף אחד לא מדבר עליו. דלגו, ורג ינחש — גרוע, אבל בביטחון מלא.',
  'ob.notes.placeholder':
    'למשל: דני אף פעם לא עונה כי הוא עובד משמרות לילה. לא להזכיר את הטיול לצפון.',
  'ob.notes.hint1': 'כינויים',
  'ob.notes.hint2': 'מי יוצא עם מי',
  'ob.notes.hint3': 'בלי גסויות',
  'ob.notes.privacy':
    'מה שכתוב כאן נשאר כאן, עד שתבקשו מרג לכתוב. השורות החינמיות יוצאות כשכל שם מוחלף בכינוי; הדוח בתשלום הוא היוצא מן הכלל היחיד — הוא יוצא עם השמות האמיתיים של הקבוצה, וזה בדיוק מה שהופך אותו לדוח עליכם.',

  'ob.upload.eyebrow': 'החלק המעצבן היחיד',
  'ob.upload.title': 'מייצאים את הצ׳אט, וגוררים לכאן.',
  'ob.upload.which': 'באיזו אפליקציה הצ׳אט?',
  'ob.upload.wa1': 'פותחים את הצ׳אט ולוחצים על התפריט ⋯',
  'ob.upload.wa1n': 'בפינה העליונה באייפון, שלוש הנקודות באנדרואיד.',
  'ob.upload.wa2': 'ייצוא צ׳אט ← ללא מדיה',
  'ob.upload.wa2n': 'אייפון: עוד ← ייצוא צ׳אט. אנדרואיד: תפריט ← עוד ← ייצוא צ׳אט.',
  'ob.upload.wa3': 'שולחים לעצמכם, ומביאים לכאן',
  'ob.upload.wa3n': 'קבצים, מייל, דרייב — כל מקום שאפשר למשוך ממנו את הקובץ.',
  'ob.upload.line1': 'פותחים את הצ׳אט ולוחצים על התפריט ☰',
  'ob.upload.line1n': 'בפינה העליונה של הצ׳אט, ליד זכוכית המגדלת.',
  'ob.upload.line2': 'הגדרות ⚙ ← ייצוא היסטוריית צ׳אט',
  'ob.upload.line2n': 'LINE שומרת את כל הצ׳אט כקובץ txt. אין שם מה לבחור לגבי מדיה.',
  'ob.upload.line3': 'שולחים לעצמכם, ומביאים לכאן',
  'ob.upload.line3n': 'Keep, מייל, קבצים — כל מקום שאפשר להוציא ממנו את ה‑txt.',
  'ob.upload.drop': 'גררו לכאן את {file} או את ה‑zip',
  'ob.upload.browse': 'או לחצו כדי לבחור קובץ — שום דבר לא מועלה',
  'ob.upload.waHint': 'בחרו ״ללא מדיה״ — זה מהיר יותר, ורג ממילא קורא רק טקסט.',
  'ob.upload.lineHint':
    'LINE מייצאת רק את הטקסט, וזה בדיוק מה שרג רצה. גררו את ה‑txt כמו שהוא.',

  'ob.scan.eyebrow': 'קורא במכשיר שלכם',
  'ob.scan.counting': 'הודעות, וממשיך לספור…',
  'ob.scan.all': 'הודעות. כולן.',
  'ob.scan.local': 'נקרא מקומית',
  'ob.scan.peopleValue': '{n} אנשים',
  'ob.scan.open': 'פותח את הייצוא',
  'ob.scan.read': 'קורא את ההודעות',
  'ob.scan.sort': 'מברר מי אמר מה',
  'ob.scan.emoji': 'סופר כל אימוג׳י ואימוג׳י',
  'ob.scan.moments': 'מחפש את הרגעים ששכחתם',
  'ob.scan.write': 'כותב את הסיפור שלכם',

  'ob.people.found': 'נמצאו {n} אנשים',
  'ob.people.title': 'מי זה מי?',
  'ob.people.ledeWa':
    'אלה השמות שוואטסאפ מסרה לרג. הקישו על שם כדי לערוך — תקנו מה שלא נכון, תנו שם למספרי הטלפון, ואחדו את מי שמופיע פעמיים.',
  'ob.people.ledeLine':
    'אלה השמות ש‑LINE מסרה לרג. הקישו על שם כדי לערוך — תקנו מה שלא נכון, תנו שם למספרי הטלפון, ואחדו את מי שמופיע פעמיים.',
  'ob.people.mergeTitle': 'רג חושב שזה אותו בנאדם',
  'ob.people.different': 'לא אותו אחד',
  'ob.people.merge': 'לאחד',
  // The count is drawn beside these, so each one starts mid-sentence.
  'ob.people.unnamedOne':
    'משתתף הוא עדיין רק מספר טלפון. תנו לו שם, אחרת רג יכתוב את הסיפור סביב מספר. שם שתוסיפו כאן גם נמחק מההודעות לפני שרג רואה אותן.',
  'ob.people.unnamedMany':
    'משתתפים הם עדיין רק מספרי טלפון. תנו להם שמות, אחרת רג יכתוב את הסיפור סביב מספרים. שם שתוסיפו כאן גם נמחק מההודעות לפני שרג רואה אותן.',
  'ob.people.identify': 'לזהות',
  'ob.people.edited': 'נערך',
  'ob.people.chief': 'הקשקשן הראשי',
  'ob.people.ok': 'בסדר',
  'ob.people.count': '{n} הודעות · מאז {month}',
  'ob.people.who': '{name} — מי זה?',
  'ob.people.name': 'שם',
  'ob.people.nameFor': 'שם עבור {name}',

  'ob.people.photosNext':
    'כל אחד מתחיל עם חיה שרג צייר בשבילו. במסך הבא אפשר להחליף אותה בתמונה אמיתית.',

  'ob.photos.eyebrow': 'דבר אחרון',
  'ob.photos.title': 'שימו פרצופים.',
  'ob.photos.lede':
    'תמונות הופכות את השקופיות להרבה יותר מצחיקות. הן נשארות במכשיר שלכם — לא מועלות, ורג לא רואה אותן, הוא עובד מטקסט בלבד. דלגו, וכולם יקבלו חיה מצוירת במקום.',
  'ob.photos.group': 'תמונות קבוצתיות ← רקע לשקופיות',
  'ob.photos.groupNote':
    'ארבע שקופיות מקבלות תמונה על כל המסך, צבועה בגוון השקופית כדי שהטקסט עדיין ינצח. אחת לכל שקופית, או רק לראשונה.',
  'ob.photos.solo': 'תמונות אישיות ← טבלה, קשקשן ראשי, רוח רפאים, פרסים',
  'ob.photos.add': '+ להוסיף',
  'ob.photos.some': 'ל‑{n} מתוך {m} יש פרצוף. רג מאשר.',
  'ob.photos.none': 'הקישו על מישהו כדי להוסיף תמונה. הכול לא חובה.',
  'ob.photos.slotOpener': 'השנים.',
  'ob.photos.slotChaos': 'שיא הבלגן',
  'ob.photos.slotVerdict': 'הסוף',
  'ob.photos.slotPaywall': 'פתיחה',

  'ob.done.accepted': 'התדריך התקבל',
  'ob.done.counting': 'עדיין סופר',
  'ob.done.failed': 'משהו השתבש',
  'ob.done.ready': 'לרג יש כל מה שהוא צריך.',
  'ob.done.finishing': 'רג מסיים לספור את השאריות.',
  'ob.done.error': 'רג לא הצליח לסיים לקרוא את הקובץ הזה.',
  'ob.done.language': 'שפה',
  'ob.done.type': 'סוג הצ׳אט',
  'ob.done.messages': 'הודעות',
  'ob.done.people': 'אנשים',
  'ob.done.peopleValue': '{n} · {m} עם תמונה',
  'ob.done.play': 'שרג יכתוב את הסיפור — עם סאונד ♪',
  'ob.done.wait': 'רגע אחד…',
  'ob.done.retry': 'לנסות ייצוא אחר',
  'ob.done.free':
    '{n} שקופיות בחינם. הרוסט המלא, התיקים האישיים וחבילת השיתוף נפתחים בסוף.',
};
