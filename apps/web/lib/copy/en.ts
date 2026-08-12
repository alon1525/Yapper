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
  'wall.names':
    'The full report is the one request that goes out with your group’s real names — without them it stays generic. Privacy says exactly what is sent.',
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

  // ── The onboarding, from the second question onwards ────────────────────
  // The language card itself stays English: it is the question that decides
  // which of these tables the rest of the flow is read from.
  'ob.header': 'Setting up your report',
  'ob.step': 'Step {n} of 7',
  'ob.reading': 'Reading',
  'ob.leave': 'Leave setup',
  'ob.back': 'Back',
  'ob.skip': 'Skip',
  'ob.continue': 'Continue',
  'ob.waiting': 'Waiting for your file',
  'ob.namesOk': 'Names look right',
  'ob.photosDone': 'Done — brief Reg',
  'ob.optional': 'Optional',
  'ob.trail.notes': '{kind} · optional',
  'ob.trail.upload': 'Nothing is uploaded — Reg reads it in your browser.',
  'ob.trail.people': '{merges} possible duplicates · {unnamed} unnamed',
  'ob.trail.photos': '{people} people · {faces} with a face',

  'ob.kind.q': 'Question 2 of 3',
  'ob.kind.title': 'What kind of chat is this?',
  'ob.kind.lede': 'It tells Reg what he is reading. How hard he goes is the next question.',
  'kind.partner': 'Partner',
  'kind.partner.note': 'Romance, fights, who says goodnight first',
  'kind.bestFriend': 'Best friend',
  'kind.bestFriend.note': 'One-on-one, zero filter',
  'kind.friends': 'Friends group',
  'kind.friends.note': 'The classic. Chaos rankings.',
  'kind.family': 'Family',
  'kind.family.note': 'Gentler roast. Mostly.',
  'kind.work': 'Work',
  'kind.work.note': 'Kept clean enough to share',
  'kind.other': 'Other',
  'kind.other.note': 'Reg will figure it out',

  'ob.tone.q': 'And how hard should he go?',
  'ob.tone.roast': 'Roast them',
  'ob.tone.roast.note': 'No soft landing, no letting anyone off at the end.',
  'ob.tone.gentle': 'Go easy',
  'ob.tone.gentle.note': 'Still funny, still specific. Nobody gets hurt.',

  'ob.notes.q': 'Question 3 of 3',
  'ob.notes.title': 'Anything Reg should know?',
  'ob.notes.lede':
    'Inside jokes, nicknames, who is dating who, the incident nobody talks about. Skip it and Reg will guess — badly, but confidently.',
  'ob.notes.placeholder':
    'e.g. Dave never replies because he works nights. Do not mention the camping trip.',
  'ob.notes.hint1': 'Nicknames',
  'ob.notes.hint2': 'Who is dating who',
  'ob.notes.hint3': 'Keep it clean',
  'ob.notes.privacy':
    'Typed here, stays here until you ask Reg to write. The free lines go out with every name swapped for a token; the paid report is the one exception — it goes with your group’s real names, which is what makes it about them.',

  'ob.upload.eyebrow': 'The only fiddly part',
  'ob.upload.title': 'Export the chat, then drop it here.',
  'ob.upload.which': 'Which app is the chat in?',
  'ob.upload.wa1': 'Open the chat, tap the ⋯ menu',
  'ob.upload.wa1n': 'Top right on iPhone, three dots on Android.',
  'ob.upload.wa2': 'Tap Export chat → Without media',
  'ob.upload.wa2n': 'iPhone: More → Export Chat. Android: Menu → More → Export chat.',
  'ob.upload.wa3': 'Send it to yourself, then bring it here',
  'ob.upload.wa3n': 'Save to Files, Mail, Drive — anywhere you can grab the file from.',
  'ob.upload.line1': 'Open the chat, tap the ☰ menu',
  'ob.upload.line1n': 'Top right of the chat, next to the search glass.',
  'ob.upload.line2': 'Settings ⚙ → Export chat history',
  'ob.upload.line2n': 'LINE saves the whole chat as a .txt. There is no media option to choose.',
  'ob.upload.line3': 'Send it to yourself, then bring it here',
  'ob.upload.line3n': 'Keep, Mail, Files — anywhere you can get the .txt back from.',
  'ob.upload.drop': 'Drop {file} or the .zip',
  'ob.upload.browse': 'or click to browse — nothing is uploaded',
  'ob.upload.waHint': 'Choose Without media — it is faster and Reg only reads text anyway.',
  'ob.upload.lineHint':
    'LINE exports the text and nothing else, which is all Reg wanted anyway. Drop the .txt exactly as it came.',

  'ob.scan.eyebrow': 'Reading on your device',
  'ob.scan.counting': 'messages and counting…',
  'ob.scan.all': 'messages. All of them.',
  'ob.scan.local': 'read locally',
  'ob.scan.peopleValue': '{n} people',
  'ob.scan.open': 'Opening your export',
  'ob.scan.read': 'Reading your messages',
  'ob.scan.sort': 'Sorting out who said what',
  'ob.scan.emoji': 'Counting every single emoji',
  'ob.scan.moments': 'Looking for the moments you forgot',
  'ob.scan.write': 'Writing your story',

  'ob.people.found': '{n} people found',
  'ob.people.title': 'Who is who?',
  'ob.people.ledeWa':
    'These are the names WhatsApp gave Reg. Tap any name to edit it — fix the ones that are wrong, name the phone numbers, and merge anyone who shows up twice.',
  'ob.people.ledeLine':
    'These are the names LINE gave Reg. Tap any name to edit it — fix the ones that are wrong, name the phone numbers, and merge anyone who shows up twice.',
  'ob.people.mergeTitle': 'Reg thinks these are the same person',
  'ob.people.different': 'Different',
  'ob.people.merge': 'Merge',
  'ob.people.unnamedOne':
    'person is just a phone number. Name them, or Reg writes the story around a number. A name you add is also scrubbed out of your messages before he sees them.',
  'ob.people.unnamedMany':
    'people are just phone numbers. Name them, or Reg writes the story around a number. A name you add is also scrubbed out of your messages before he sees them.',
  'ob.people.identify': 'Identify',
  'ob.people.edited': 'Edited',
  'ob.people.chief': 'Chief yapper',
  'ob.people.ok': 'OK',
  'ob.people.count': '{n} messages · since {month}',
  'ob.people.who': '{name} — who is this?',
  'ob.people.name': 'Name',
  'ob.people.nameFor': 'Name for {name}',

  'ob.people.photosNext':
    'Everyone starts with an animal Reg drew for them. On the next screen you can swap anyone’s for a real photo.',

  'ob.photos.eyebrow': 'Last thing',
  'ob.photos.title': 'Give it faces.',
  'ob.photos.lede':
    'Photos make the slides much funnier. They stay on your device — never uploaded, and never seen by Reg, who works from text only. Skip it and everyone gets a drawn animal instead.',
  'ob.photos.group': 'Group photos → slide backgrounds',
  'ob.photos.groupNote':
    'Four slides get a full-bleed photo, colour-graded into the slide so the type still wins. Drop one per slide, or fill the first and leave the rest.',
  'ob.photos.solo': 'Solo photos → leaderboard, chief yapper, ghost, awards',
  'ob.photos.add': '+ Add',
  'ob.photos.some': '{n} of {m} have a face. Reg approves.',
  'ob.photos.none': 'Tap anyone to add a photo. All optional.',
  'ob.photos.slotOpener': 'The years.',
  'ob.photos.slotChaos': 'Peak chaos',
  'ob.photos.slotVerdict': 'The end',
  'ob.photos.slotPaywall': 'Unlock',

  'ob.done.accepted': 'Brief accepted',
  'ob.done.counting': 'Still counting',
  'ob.done.failed': 'Something went wrong',
  'ob.done.ready': 'Reg has everything he needs.',
  'ob.done.finishing': 'Reg is finishing the last of the counting.',
  'ob.done.error': 'Reg could not finish reading that one.',
  'ob.done.language': 'Language',
  'ob.done.type': 'Chat type',
  'ob.done.messages': 'Messages',
  'ob.done.people': 'People',
  'ob.done.peopleValue': '{n} · {m} with photos',
  'ob.done.play': 'Write my story — with sound ♪',
  'ob.done.wait': 'One moment…',
  'ob.done.retry': 'Try another export',
  'ob.done.free':
    '{n} slides free. The full roast, per-person reports and the shareable pack unlock at the end.',
} as const;

export type CopyKey = keyof typeof EN;
export type Copy = Record<CopyKey, string>;
