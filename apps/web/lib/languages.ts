/**
 * The languages Reg writes in.
 *
 * One table, because the same fact was previously spelled out in five places:
 * the list of cards on the first question, a `=== 'he'` ternary at the top of
 * each of the three prompts, the locale numbers and dates are formatted in, and
 * a zod enum in every route that forwards a brief. Adding a language meant
 * finding all of them, and the failure mode of missing one is silent — the card
 * appears, the reader picks it, and the model is told to write English.
 *
 * This is the language of the *report*, which is not the language of the chat.
 * A Japanese group asking for English is asking for something they can send to
 * someone who does not read Japanese, and detection does not get a vote.
 */

export type ReportLanguage = 'en' | 'he' | 'ja' | 'es' | 'pt' | 'fr' | 'de' | 'ru';

/**
 * What every non-English report is told about the pseudonyms.
 *
 * Names are swapped for `Person A`-style tokens before anything is sent and
 * swapped back before anything is read, so a token that comes home altered
 * comes home broken. The risk is different in each language and the same
 * sentence covers all of them: Russian declines it, Japanese transliterates it
 * into katakana, German glues it to a compound. Naming what must NOT happen is
 * what makes it stick — told only "keep the tokens", models still wrote
 * "Person Aさん" and "Персона A".
 */
const KEEP_TOKENS =
  'The Person tokens are placeholders that are swapped for real names before anyone reads ' +
  'your output. Copy each one exactly as written, in Latin letters: never translate it, ' +
  'transliterate it, decline it, or add a case ending, suffix or honorific to it.';

export interface ReportLanguageSpec {
  code: ReportLanguage;
  /** Set in the language itself — a reader scanning for theirs is scanning for their own word for it. */
  name: string;
  /**
   * The line under the name on the card. The name itself is in the language,
   * so this is where the English name goes — a reader scanning eight cards in
   * five scripts for a friend's language needs one of the two to be legible to
   * them.
   */
  note: string;
  /** Locale for numbers and dates written inside this report. */
  locale: string;
  rtl: boolean;
  /** The first line of every prompt, and the only thing that decides the output language. */
  instruction: string;
  /**
   * How the paid report should sound in this language: the register, and the
   * tics a model reaches for in it when it has nothing to say. Writer only —
   * the detective is told to be flat, and the free preview has its own voice.
   */
  writerNote: string;
}

export const REPORT_LANGUAGES: readonly ReportLanguageSpec[] = [
  {
    code: 'en',
    name: 'English',
    note: 'Ready now',
    locale: 'en-GB',
    rtl: false,
    instruction: 'Write your output in English.',
    writerNote:
      'English register: the way the funniest person in the group texts, not the way a brand posts. Contractions, fragments, no corporate verbs, no "notably".',
  },
  {
    code: 'he',
    name: 'עברית',
    note: 'Ready now · RTL',
    locale: 'he-IL',
    rtl: true,
    /*
      Hebrew gets its own rule rather than the shared one, and it is longer for
      a reason found in a real export: the tokens are Latin, so Hebrew written
      around them attracts a hyphen — "ו-Person A" — and that hyphen survives
      the swap back as "ו-עומר", which is not how the language is written.
      "One-letter prefixes" alone was not precise enough either: both models
      generalised it to multi-letter prepositions and wrote "שלPerson G", which
      restores to "שלגבוה" instead of "של גבוה". The rule has to name what must
      not attach as well as what must.
    */
    instruction: [
      'Write your output in Hebrew.',
      'Treat each Person token as a Hebrew word. Attach ONLY the seven single-letter prefixes (ו ה ל ב מ ש כ) directly to it, with no hyphen and no space: write "וPerson A", "לPerson B", never "ו-Person A". Every separate word keeps its normal space — write "של Person A", "את Person B", "עם Person C", never "שלPerson A".',
    ].join(' '),
    writerNote: [
      'Hebrew register: write the way an Israeli friend roasts the group inside the group — spoken, short, dry, direct.',
      'Not newspaper Hebrew, not literary Hebrew, not an English joke translated.',
      'Never write, as the narrator: אכן, כפי שניתן לראות, הנתונים מראים, מעניין לציין, ראוי לציין, לא פחות מ-, באופן מפתיע, בסופו של יום, יותר מסתם קבוצה.',
      "Slang only when it appears in the group's own messages.",
      "Every verb and adjective agrees with the gender of the person it describes — use the gender notes below; where a person's gender is not given, use forms that do not mark it (address the group in the plural, use noun sentences) rather than guess.",
      'Digits are always 0-9. Quotation marks are ״…״ or "…", never «…». No English words inside a Hebrew sentence unless the group itself wrote them.',
    ].join(' '),
  },
  {
    code: 'ja',
    name: '日本語',
    note: 'Ready now · Japanese',
    locale: 'ja-JP',
    rtl: false,
    instruction: [
      'Write your output in Japanese.',
      KEEP_TOKENS,
      // Particles bind straight onto the token with no space, which restores
      // cleanly — it is katakana and さん that do not.
      'Particles may follow a token directly, as in "Person Aは" — but write the token itself in Latin letters every time.',
    ].join(' '),
    writerNote:
      'Japanese register: the casual tone the group itself uses — no です/ます unless they use them. Deadpan works best in short sentences; never explain the joke.',
  },
  {
    code: 'es',
    name: 'Español',
    note: 'Ready now · Spanish',
    locale: 'es-ES',
    rtl: false,
    instruction: ['Write your output in Spanish.', KEEP_TOKENS].join(' '),
    writerNote:
      "Spanish register: spoken, in the group's own variety — tú, vos or usted as they use it, their vocabulary, not neutral textbook Spanish. Agree every adjective with the person it describes; where a person's gender is unclear from their messages, write around it.",
  },
  {
    code: 'pt',
    name: 'Português',
    note: 'Ready now · Portuguese',
    locale: 'pt-BR',
    rtl: false,
    instruction: ['Write your output in Portuguese.', KEEP_TOKENS].join(' '),
    writerNote:
      "Portuguese register: spoken, in the group's own variety (Brazilian or European, as they write it). Agree every adjective with the person it describes; where unclear, write around it.",
  },
  {
    code: 'fr',
    name: 'Français',
    note: 'Ready now · French',
    locale: 'fr-FR',
    rtl: false,
    instruction: ['Write your output in French.', KEEP_TOKENS].join(' '),
    writerNote:
      'French register: spoken French, tutoiement as the group uses it, none of the written connectors (en effet, par ailleurs, force est de constater). Agree adjectives and participles with the person; where unclear, write around it.',
  },
  {
    code: 'de',
    name: 'Deutsch',
    note: 'Ready now · German',
    locale: 'de-DE',
    rtl: false,
    instruction: [
      'Write your output in German.',
      KEEP_TOKENS,
      // German is the one language where the token can end up inside a word
      // rather than beside it, and "Person-A-Nachricht" restores to a name with
      // hyphens hanging off it.
      'Never join a token into a compound: write "die Nachricht von Person A", never "Person-A-Nachricht".',
    ].join(' '),
    writerNote:
      'German register: spoken German, du, short sentences. No Beamtendeutsch, no nominal style, no "es lässt sich festhalten".',
  },
  {
    code: 'ru',
    name: 'Русский',
    note: 'Ready now · Russian',
    locale: 'ru-RU',
    rtl: false,
    instruction: ['Write your output in Russian.', KEEP_TOKENS].join(' '),
    writerNote:
      "Russian register: spoken, ты, short. No bureaucratic register (следует отметить, данные показывают). Past-tense verbs and adjectives agree with the person's gender; where unclear from their messages, write around it.",
  },
];

const BY_CODE = new Map(REPORT_LANGUAGES.map((l) => [l.code, l]));

/**
 * The codes as a tuple, for the request schemas.
 *
 * Built from the table rather than written out again: a language that reaches
 * the cards but not the schema is one the reader can pick and the route then
 * rejects, and nothing in the types would have said so.
 */
export const REPORT_LANGUAGE_CODES = REPORT_LANGUAGES.map((l) => l.code) as unknown as [
  ReportLanguage,
  ...ReportLanguage[],
];

export function reportLanguage(code: ReportLanguage | undefined): ReportLanguageSpec {
  return BY_CODE.get(code ?? 'en') ?? BY_CODE.get('en')!;
}

/** What the model is told about the language it is writing in. */
export function languageInstruction(code: ReportLanguage | undefined): string {
  return reportLanguage(code).instruction;
}

/** What the writer is told about how the report should sound in this language. */
export function writerNote(code: ReportLanguage | undefined): string {
  return reportLanguage(code).writerNote;
}
