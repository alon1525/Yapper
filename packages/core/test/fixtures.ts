/**
 * Synthetic exports, one per trap in the parser spec.
 *
 * Invisible characters are built with String.fromCharCode rather than written
 * as escapes so that nothing in the toolchain can quietly normalise them away —
 * the whole point of these fixtures is that the bytes are exactly right.
 */

/** U+200E LEFT-TO-RIGHT MARK — iOS sprinkles these around timestamps. */
export const LRM = String.fromCharCode(0x200e);
/** U+202F NARROW NO-BREAK SPACE — precedes AM/PM in newer iOS exports. */
export const NNBSP = String.fromCharCode(0x202f);
/** U+FEFF BYTE ORDER MARK. */
export const BOM = String.fromCharCode(0xfeff);

/** Android, 24h, unambiguous DMY (a day of 15 and 22 rules out MDY). */
export const ANDROID_BASIC = [
  '12/01/2023, 09:05 - Messages and calls are end-to-end encrypted. Tap to learn more.',
  '12/01/2023, 09:05 - Alon created group "Test Group"',
  '12/01/2023, 09:06 - Alon: good morning',
  '15/01/2023, 23:47 - Sarah Levi: why are you awake',
  '22/03/2023, 00:12 - Alon: I could ask you the same thing',
].join('\n');

/** iOS, 12h with narrow no-break space, LRM around the bracketed stamp. */
export const IOS_BASIC = [
  `${BOM}${LRM}[12/01/2023, 9:05:11${NNBSP}AM] Alon: good morning`,
  `${LRM}[15/01/2023, 11:47:02${NNBSP}PM] Sarah Levi: why are you awake`,
  `${LRM}[15/01/2023, 11:48:00${NNBSP}PM] Alon: same reason as you`,
  `${LRM}[16/01/2023, 12:00:00${NNBSP}AM] Sarah Levi: it is literally midnight`,
  `${LRM}[16/01/2023, 12:00:30${NNBSP}PM] Alon: and now it is literally noon`,
].join('\n');

/**
 * Multi-line message with a blank line inside it. If continuation handling is
 * wrong this silently corrupts longest-message, word frequency and per-person
 * counts — and nothing throws.
 */
export const MULTILINE = [
  '12/01/2023, 09:06 - Alon: here is my manifesto',
  'point one: everything is fine',
  '',
  'point two: nothing is fine',
  '15/01/2023, 09:07 - Sarah Levi: ok',
].join('\n');

/** System notices, including the ones that contain a colon. */
export const SYSTEM_LINES = [
  '12/01/2023, 09:00 - Messages and calls are end-to-end encrypted. Tap to learn more.',
  '12/01/2023, 09:01 - Alon created group "Test Group"',
  '12/01/2023, 09:02 - Alon added Sarah Levi',
  '12/01/2023, 09:03 - Sarah Levi joined using this group\'s invite link',
  '12/01/2023, 09:04 - Alon changed the subject to: Weekend Plans',
  '15/01/2023, 09:05 - Alon: an actual message',
  '15/01/2023, 09:06 - Sarah Levi left',
].join('\n');

export const ATTACHMENTS = [
  '12/01/2023, 09:00 - Alon: <Media omitted>',
  '12/01/2023, 09:01 - Alon: image omitted',
  '12/01/2023, 09:02 - Sarah Levi: video omitted',
  '12/01/2023, 09:03 - Sarah Levi: audio omitted',
  '12/01/2023, 09:04 - Alon: sticker omitted',
  '15/01/2023, 09:05 - Alon: IMG-20230115-WA0001.jpg (file attached)',
  '15/01/2023, 09:06 - Sarah Levi: This message was deleted',
  '15/01/2023, 09:07 - Alon: a normal message',
].join('\n');

/**
 * Every day-part is <= 12, so ordering is undecidable from the values alone.
 * Read as DMY the sequence jumps backwards (01/02 then 03/01 then 05/02);
 * read as MDY it is monotonic. The monotonicity tiebreak must pick MDY.
 */
export const AMBIGUOUS_MDY = [
  '01/02/2023, 09:00 - Alon: first',
  '03/01/2023, 09:00 - Alon: second',
  '05/02/2023, 09:00 - Alon: third',
  '07/03/2023, 09:00 - Alon: fourth',
].join('\n');

/** Same shape but monotonic under DMY and not under MDY. */
export const AMBIGUOUS_DMY = [
  '01/02/2023, 09:00 - Alon: first',
  '03/02/2023, 09:00 - Alon: second',
  '01/03/2023, 09:00 - Alon: third',
  '02/03/2023, 09:00 - Alon: fourth',
].join('\n');

/** Windows line endings and a trailing newline. */
export const CRLF = '12/01/2023, 09:06 - Alon: hello\r\n15/01/2023, 09:07 - Sarah Levi: hi\r\n';
