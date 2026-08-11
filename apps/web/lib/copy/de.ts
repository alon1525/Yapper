import type { Copy } from './en';

/** Deutsch. Duzen throughout, and a 24-hour clock. */
export const DE: Partial<Copy> = {
  'deck.next': 'Weiter',
  'deck.prev': 'Zurück',
  'deck.restart': 'Zurück zum Anfang',
  'deck.mute': 'Ton aus',
  'deck.unmute': 'Ton an',

  'welcome.fallbackName': 'Euer Chat',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'Reg hat alle {messages} Nachrichten gelesen, damit ihr das nicht müsst. {days} davon. Weitertippen. Ton aufdrehen.',

  'total.eyebrow': 'Gesamtschaden',
  'total.unit': 'Nachrichten · {people} Leute',
  'total.punchline':
    'Das sind {perDay} am Tag, jeden Tag, {days} lang. Inklusive der Jahre, in denen ihr angeblich „keine Zeit“ hattet.',
  'total.words': 'Wörter',
  'total.emoji': 'Emojis',
  'total.media': 'Medien',

  'talker.eyebrow': 'Die Quasselrangliste',
  'talker.punchline': '{share} aller Nachrichten in diesem Chat kamen von einer einzigen Person.',
  'talker.punchlineRunnerUp': 'Das ist {times}-mal so viel wie {name}, und das ist nicht einmal knapp.',

  'hours.eyebrow': 'Wann ihr redet',
  'hours.peak': 'Stoßzeit: {hour}',
  'hours.punchline':
    '{count} Nachrichten zwischen Mitternacht und 5 Uhr morgens. Niemand hat darum gebeten. Sie kamen trotzdem.',
  'hours.tag': 'Nachtschicht: {name} · {count} nach Mitternacht',

  'fastest.eyebrow': 'Der schnellste Finger',
  'fastest.punchline':
    'Über {count} Antworten hinweg war diese Person fertig, bevor die anderen zu Ende gelesen hatten.',
  'fastest.fastest': 'Am schnellsten',
  'fastest.slowest': 'Am langsamsten · {name}',

  'ghost.eyebrow': 'Zertifiziertes Gespenst',
  'ghost.punchline': 'So lange weg, ohne eine einzige Nachricht.',
  'ghost.stillGone': 'Und ist nie zurückgekommen. Die Gruppe hat ohne diese Person weitergemacht.',
  'ghost.returned': 'Und kam dann zurück, als wäre nichts gewesen.',
  'ghost.lastSeen': 'Zuletzt gesehen',
  'ghost.stillGoneLabel': 'Immer noch weg',
  'ghost.resurfaced': 'Wieder aufgetaucht',

  'emoji.eyebrow': 'Emoji-Treppchen',
  'emoji.punchline':
    '{emoji} wurde {count}-mal benutzt. Kein ernstes Gespräch hat hier je lange genug gehalten, um ein zweites zu brauchen.',
  'emoji.punchlineRunnerUp':
    '{emoji} wurde {count}-mal benutzt — {times}-mal so oft wie {other}. Kein ernstes Gespräch hat hier je lange genug gehalten, um ein zweites zu brauchen.',

  'chaos.eyebrow': 'Maximales Chaos',
  'chaos.unit': '{count} Nachrichten an einem Tag',
  'chaos.punchline':
    '{times}-mal ein normaler Tag hier. Irgendetwas ist passiert. Alle erinnern sich, was.',

  'streak.eyebrow': 'Längste Serie',
  'streak.days': 'Tage',
  'streak.punchline': 'Kein einziger stiller Tag zwischen {from} und {to}.',
  'streak.silence':
    'Das andere Extrem: {days} völlige Stille, endlich gebrochen von „{quote}“.',
  'streak.tag': 'Hier hat noch nie jemand einen Chat ungelesen gelassen',

  'final.eyebrow': 'Urteil der Gruppe',
  'final.headline': 'Schick es in die Gruppe',
  'final.punchline':
    '{messages} Nachrichten, {span}, und trotzdem ist noch niemand gegangen. Das ist Liebe, rein technisch.',
  'final.privacy': 'Euer Chat wurde nie hochgeladen. Tab zu, und er ist weg.',
  'final.restart': 'Anderen Chat ausprobieren',

  'share.open': 'Karte erstellen',
  'share.title': 'Wähl aus, was du postest',
  'share.lede':
    'Jede ist eine 9:16-Karte, gebaut auf deinem Gerät. Nichts wird hochgeladen — das Bild entsteht hier und geht direkt an die App, die du auswählst.',
  'share.count': '{n} ausgewählt',
  'share.none': 'Wähl mindestens eine aus',
  'share.share': 'Teilen',
  'share.sharing': 'Wird geöffnet…',
  'share.save': 'In Fotos sichern',
  'share.saveDesktop': 'Herunterladen',
  'share.saving': 'Wird gesichert…',
  'share.copyCaption': 'Bildtext kopieren',
  'share.captionCopied': 'Bildtext kopiert',
  'share.caption': '{messages} Nachrichten von uns. Yapped hat sie alle gelesen.',
  'share.hint':
    'Im Teilen-Menü sitzen WhatsApp, Instagram und TikTok. Bei Instagram und TikTok wählst du die Karte aus deinen Fotos und postest sie als Story.',
  'share.hintDesktop':
    'Desktop-Browser können das Teilen-Menü nicht öffnen, also werden die Karten heruntergeladen. Schick sie aufs Handy oder poste sie von hier.',
  'share.failed': 'Das hat nicht geklappt. Die Karten sind trotzdem auf deinem Gerät gesichert.',
  'share.close': 'Schließen',
  'share.watermark': 'yapped',

  'card.total.label': 'NACHRICHTEN',
  'card.total.caption': '{days} Gequassel. Noch ist niemand gegangen.',
  'card.talker.label': 'QUASSELKÖNIG',
  'card.talker.caption': '{share} von allem, was hier gesagt wurde',
  'card.leaderboard.label': 'DIE RANGLISTE',
  'card.hours.label': 'STOSSZEIT',
  'card.hours.caption': '{count} Nachrichten nach Mitternacht',
  'card.ghost.label': 'ZERTIFIZIERTES GESPENST',
  'card.ghost.caption': '{days} ohne ein Wort',
  'card.emoji.label': 'AM MEISTEN BENUTZT',
  'card.emoji.caption': '{count}-mal benutzt',
  'card.chaos.label': 'MAXIMALES CHAOS',
  'card.chaos.caption': '{count} Nachrichten an einem Tag',
  'card.fastest.label': 'SCHNELLSTE ANTWORT',
  'card.fastest.caption': 'Median aus {count} Antworten',
  'card.verdict.label': 'DAS URTEIL',
  'card.verdict.caption': '{people} Leute · {span}',

  'time.midnight': 'Mitternacht',
  'time.noon': 'Mittag',
  // 24-hour clock, so both take the hour as written.
  'time.am': '{h24} Uhr',
  'time.pm': '{h24} Uhr',
  'duration.underMinute': 'unter einer Minute',
  'duration.underSecond': 'unter einer Sekunde',
  'duration.seconds': '{n} s',
  'duration.minutes': '{n} Min.',
  'duration.hours': '{n} Std.',
  'duration.hoursMinutes': '{n} Std. {m} Min.',
  'span.hours': '{n} Stunden',
  'span.days': '{n} Tage',
  'span.months': '{n} Monate',
  'span.years': '{n} Jahre',

  'ai.eyebrow': 'Noch eine Sache',
  'ai.headline': 'Regs Bericht \u00fcber diesen Abend',
  'ai.run': 'Schreib mir die Geschichte \u2726',
  'ai.running': 'Eure besten Momente werden gelesen\u2026',
  'ai.inspect': 'Zeig mir genau, was gesendet wird',
  'wall.eyebrow': 'Das war die Vorschau',
  'wall.free': 'Eine Geschichte gab es gratis',
  'wall.unlock': 'Den ganzen Bericht freischalten',
  'wall.unlocking': 'Wird freigeschaltet\u2026',
  'wall.checking': 'Belege werden gepr\u00fcft\u2026',
  'wall.reading': 'Der ganze Chat wird gelesen\u2026',
  'wall.writing': 'Euer Bericht wird geschrieben\u2026',
  'wall.sellStories': 'F\u00fcnf weitere Momente, geschrieben wie der, den ihr gerade gelesen habt',
  'wall.sellAwards': 'Die komplette Preisverleihung, ein Gewinner pro Preis',
  'wall.sellEras': 'Eure Jahre, eine Zeile nach der anderen',
  'wall.privacy': 'Datenschutz',
  'wall.refunds': 'R\u00fcckerstattungen',
  'report.breaking': 'Eilmeldung',
  'report.fieldNotes': 'Feldnotizen',
  'report.findings': 'Befunde',
  'report.glossary': 'Glossar',
  'report.memoriam': 'In liebevoller Erinnerung',
  'report.matterOf': 'In der Sache',
  'report.itemised': 'Einzelaufstellung',
  'report.orgChart': 'Organigramm',
  'report.standings': 'Die Tabelle',
  'report.insideWords': 'W\u00f6rter, die au\u00dferhalb dieses Chats nichts bedeuten',
  'report.howItWent': 'Wie es ausging',
};
