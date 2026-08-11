/**
 * Everything the report says that Reg did not write himself.
 *
 * The deck used to be English no matter which language was picked on the first
 * question, because only the model-written lines went through the language
 * instruction — the eyebrows, the punchlines around the numbers, the buttons
 * and the awards were all typed straight into the JSX in English. A report that
 * says "Certified ghost" over a paragraph of Japanese is not a report in
 * Japanese.
 *
 * English is the source of truth: the `Copy` type is derived from this object,
 * so every other language is checked against it, and a key nobody has
 * translated yet falls back here rather than rendering as a raw key.
 *
 * Placeholders are `{name}`, filled by `t`. They are never concatenated in the
 * caller — word order is not the same in eight languages, and a sentence built
 * by joining fragments can only be correct in the one it was built for.
 */
export const EN = {
  // ── The deck's chrome ──────────────────────────────────────────────────
  'deck.next': 'Next slide',
  'deck.prev': 'Previous slide',
  'deck.restart': 'Back to the first slide',
  'deck.mute': 'Mute the soundtrack',
  'deck.unmute': 'Play the soundtrack',

  // ── Free slides ────────────────────────────────────────────────────────
  'welcome.fallbackName': 'Your chat',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'Reg read all {messages} messages so you never have to. {days} of it. Tap through. Volume up.',

  'total.eyebrow': 'Total damage',
  'total.unit': 'messages · {people} people',
  'total.punchline':
    'That is {perDay} a day, every day, for {days}. Including the years you claim you were "busy".',
  'total.words': 'Words',
  'total.emoji': 'Emoji',
  'total.media': 'Media',

  'talker.eyebrow': 'The yap leaderboard',
  'talker.punchline': '{share} of every message in this chat came from one person.',
  'talker.punchlineRunnerUp': 'That is {times}× more than {name}, who is not even close.',

  'hours.eyebrow': 'When you yap',
  'hours.peak': 'Peak hour: {hour}',
  'hours.punchline':
    '{count} messages sent between midnight and 5 AM. Nobody asked for them. They arrived anyway.',
  'hours.tag': 'Night shift: {name} · {count} after midnight',

  'fastest.eyebrow': 'Fastest trigger finger',
  'fastest.punchline':
    'Across {count} replies, they somehow got there before anyone else had finished reading.',
  'fastest.fastest': 'Fastest',
  'fastest.slowest': 'Slowest · {name}',

  'ghost.eyebrow': 'Certified ghost',
  'ghost.punchline': 'Gone that long without a single message.',
  'ghost.stillGone': 'And has not come back. The group carried on without them.',
  'ghost.returned': 'Then returned as if nothing had happened.',
  'ghost.lastSeen': 'Last seen',
  'ghost.stillGoneLabel': 'Still gone',
  'ghost.resurfaced': 'Resurfaced',

  'emoji.eyebrow': 'Emoji podium',
  'emoji.punchline':
    '{emoji} was used {count} times. No serious conversation here ever survived long enough to need a second one.',
  'emoji.punchlineRunnerUp':
    '{emoji} was used {count} times — {times}× more than {other}. No serious conversation here ever survived long enough to need a second one.',

  'chaos.eyebrow': 'Peak chaos',
  'chaos.unit': '{count} messages in one day',
  'chaos.punchline': '{times}× a normal day here. Something happened. Everyone remembers what.',

  'streak.eyebrow': 'Longest streak',
  'streak.days': 'days',
  'streak.punchline': 'Not one silent day between {from} and {to}.',
  'streak.silence': 'The other extreme: {days} of total silence, finally broken by "{quote}".',
  'streak.tag': 'Nobody here has ever left a chat unread',

  // ── The endings ────────────────────────────────────────────────────────
  'final.eyebrow': 'Group verdict',
  'final.headline': 'Send it to the group',
  'final.punchline':
    '{messages} messages, {span}, and somehow nobody has left yet. That is love, technically.',
  'final.privacy': 'Your chat was never uploaded. Close this tab and it is gone.',
  'final.restart': 'Try another chat',

  // ── Sharing ────────────────────────────────────────────────────────────
  'share.open': 'Make a share card',
  'share.title': 'Pick what to post',
  'share.lede':
    'Each one is a 9:16 card, built on your device. Nothing is uploaded — the picture is made here and handed straight to whichever app you choose.',
  'share.count': '{n} selected',
  'share.none': 'Pick at least one',
  'share.share': 'Share',
  'share.sharing': 'Opening…',
  'share.save': 'Save to photos',
  'share.saveDesktop': 'Download',
  'share.saving': 'Saving…',
  'share.copyCaption': 'Copy caption',
  'share.captionCopied': 'Caption copied',
  'share.caption': '{messages} messages of us. Yapped read all of them.',
  'share.hint':
    'The share sheet is where WhatsApp, Instagram and TikTok live. On Instagram and TikTok, pick the card from your photos and post it as a story.',
  'share.hintDesktop':
    'Desktop browsers cannot open the share sheet, so the cards download instead. Send them to your phone, or post them from here.',
  'share.failed': 'That did not work. The cards are still saved to your device.',
  'share.close': 'Close',
  'share.watermark': 'yapped',

  // ── Card faces ─────────────────────────────────────────────────────────
  'card.total.label': 'MESSAGES',
  'card.total.caption': '{days} of yapping. Nobody has left yet.',
  'card.talker.label': 'CHIEF YAPPER',
  'card.talker.caption': '{share} of everything said here',
  'card.leaderboard.label': 'THE LEADERBOARD',
  'card.hours.label': 'PEAK HOUR',
  'card.hours.caption': '{count} messages after midnight',
  'card.ghost.label': 'CERTIFIED GHOST',
  'card.ghost.caption': 'Gone {days} without a word',
  'card.emoji.label': 'MOST USED',
  'card.emoji.caption': 'Used {count} times',
  'card.chaos.label': 'PEAK CHAOS',
  'card.chaos.caption': '{count} messages in one day',
  'card.fastest.label': 'FASTEST REPLY',
  'card.fastest.caption': 'Median across {count} replies',
  'card.verdict.label': 'THE VERDICT',
  'card.verdict.caption': '{people} people · {span}',

  // ── Time and duration, which are words as much as numbers ──────────────
  'time.midnight': 'midnight',
  'time.noon': 'noon',
  'time.am': '{h} AM',
  'time.pm': '{h} PM',
  'duration.underMinute': 'under a minute',
  'duration.underSecond': 'under a second',
  'duration.seconds': '{n}s',
  'duration.minutes': '{n} min',
  'duration.hours': '{n}h',
  'duration.hoursMinutes': '{n}h {m}m',
  'span.hours': '{n} hours',
  'span.days': '{n} days',
  'span.months': '{n} months',
  'span.years': '{n} years',

  // -- The AI memory, the wall, and the paid report's scaffolding ---------
  'ai.eyebrow': 'One more thing',
  'ai.headline': 'Reg\u2019s account of that night',
  'ai.run': 'Write my story \u2726',
  'ai.running': 'Reading your best moments\u2026',
  'ai.inspect': 'Show me exactly what gets sent',
  'wall.eyebrow': 'That was the preview',
  'wall.free': 'One story was free',
  'wall.unlock': 'Unlock the full roast',
  'wall.unlocking': 'Unlocking\u2026',
  'wall.checking': 'Checking the receipts\u2026',
  'wall.reading': 'Reading your whole chat\u2026',
  'wall.writing': 'Writing your report\u2026',
  'wall.sellStories': 'Five more moments, written up like the one you just read',
  'wall.sellAwards': 'The full awards ceremony, one winner each',
  'wall.sellEras': 'Your years, one line at a time',
  'wall.privacy': 'Privacy',
  'wall.refunds': 'Refunds',
  'report.breaking': 'Breaking',
  'report.fieldNotes': 'Field notes',
  'report.findings': 'Findings',
  'report.glossary': 'Glossary',
  'report.memoriam': 'In loving memory',
  'report.matterOf': 'In the matter of',
  'report.itemised': 'Itemised',
  'report.orgChart': 'Org chart',
  'report.standings': 'The standings',
  'report.insideWords': 'Words that mean nothing outside this chat',
  'report.howItWent': 'How it went',
} as const;

export type CopyKey = keyof typeof EN;
export type Copy = Record<CopyKey, string>;
