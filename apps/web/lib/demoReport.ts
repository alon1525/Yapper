import type { PremiumPayload, PersonDigest } from './premiumPayload';
import type { PremiumReport } from './premiumPrompt';

/**
 * A premium report with no AI in it.
 *
 * Two jobs. It lets the paid deck be seen and designed against before any key
 * or payment exists — the layout problems in a five-page cast section are not
 * discoverable from a schema. And it is the shape of a fallback: if a real
 * generation fails after someone has paid, returning this beats returning an
 * error, because the numbers underneath were always the honest part.
 *
 * Every line here is derived from the payload, so it says true things about the
 * actual chat. It is not funny, and it does not pretend to be — that is exactly
 * the difference the paid model is being bought for.
 */

type Lang = 'en' | 'he' | 'other';

const T = {
  en: {
    sampleTitle: (n: number) => `A conversation with ${n} people in it`,
    sampleStory: (n: number, reasons: string) =>
      `${n} messages arrived close enough together to be one conversation. What made it stand out: ${reasons}.`,
    loudest: 'The loudest voice',
    nightOwl: 'Awake when nobody else is',
    ghost: 'Long gone',
    oneWord: 'Answers in one word',
    essayist: 'Writes at length',
    fastest: 'Replies immediately',
    quiet: 'Rarely says anything',
    regular: 'A steady presence',
    of: (p: number) => `Sent ${p}% of everything in this chat.`,
    night: (p: number) => `${p}% of their messages arrive between midnight and 5am.`,
    silence: (d: number) => `Once went ${d} days without a word.`,
    gone: (d: number) => `Last spoke ${d} days ago and has not returned.`,
    reply: (m: number) => `Usually replies within ${m} minutes.`,
    length: (c: number) => `Averages ${c} characters a message.`,
    year: (n: number) => `${n} messages.`,
    yearTitle: (y: number) => `${y}`,
    narrative: (n: number, span: string) =>
      `${n} messages across ${span}. Everything above was counted on your device. Add an API key to have it written properly.`,
    demo: 'Sample report',
    factBusiest: 'The loudest day',
    factStreak: 'The longest run of days',
    factSilence: 'The longest silence',
    factYear: 'The loudest year',
  },
  he: {
    sampleTitle: (n: number) => `שיחה שהשתתפו בה ${n} אנשים`,
    sampleStory: (n: number, reasons: string) =>
      `${n} הודעות הגיעו קרוב מספיק אחת לשנייה כדי להיחשב שיחה אחת. מה שבלט בה: ${reasons}.`,
    loudest: 'הקול הרם ביותר',
    nightOwl: 'ער כשכולם ישנים',
    ghost: 'נעלם מזמן',
    oneWord: 'עונה במילה אחת',
    essayist: 'כותב באורך',
    fastest: 'עונה מיד',
    quiet: 'כמעט לא מדבר',
    regular: 'נוכחות קבועה',
    of: (p: number) => `שלח ${p}% מכל ההודעות בקבוצה.`,
    night: (p: number) => `${p}% מההודעות שלו נשלחות בין חצות לחמש בבוקר.`,
    silence: (d: number) => `פעם אחת שתק ${d} ימים ברצף.`,
    gone: (d: number) => `דיבר לאחרונה לפני ${d} ימים ולא חזר.`,
    reply: (m: number) => `בדרך כלל עונה תוך ${m} דקות.`,
    length: (c: number) => `${c} תווים בממוצע להודעה.`,
    year: (n: number) => `${n} הודעות.`,
    yearTitle: (y: number) => `${y}`,
    narrative: (n: number, span: string) =>
      `${n} הודעות לאורך ${span}. כל מה שלמעלה חושב על המכשיר שלכם. הוסיפו מפתח API כדי שזה ייכתב כמו שצריך.`,
    demo: 'דוח לדוגמה',
    factBusiest: 'היום הרועש ביותר',
    factStreak: 'הרצף הארוך ביותר',
    factSilence: 'השתיקה הארוכה ביותר',
    factYear: 'השנה הרועשת ביותר',
  },
} as const;

function strings(language: Lang) {
  return language === 'he' ? T.he : T.en;
}

function titleFor(person: PersonDigest, rank: number, t: ReturnType<typeof strings>): string {
  if (rank === 0) return t.loudest;
  if (person.stillGone) return t.ghost;
  if (person.nightShare > 0.1) return t.nightOwl;
  if (person.oneWordShare > 0.22) return t.oneWord;
  if (person.meanLength > 40) return t.essayist;
  if (person.medianResponseMinutes !== null && person.medianResponseMinutes <= 1) return t.fastest;
  if (person.share < 0.01) return t.quiet;
  return t.regular;
}

/**
 * Four memories that any chat can supply, however quiet. Used only to top up a
 * report whose candidate moments ran short.
 */
function fallbackMemories(payload: PremiumPayload, t: ReturnType<typeof strings>) {
  const { digest, eras } = payload;
  const loudestYear = [...eras].sort((a, b) => b.messages - a.messages)[0];

  return [
    {
      title: t.factBusiest,
      story: digest.busiestDay
        ? `${digest.busiestDay.day}: ${digest.busiestDay.count}`
        : t.year(digest.totalMessages),
      cast: [],
      quote: null,
    },
    { title: t.factStreak, story: t.year(digest.longestStreakDays), cast: [], quote: null },
    { title: t.factSilence, story: t.year(digest.longestSilenceDays), cast: [], quote: null },
    {
      title: t.factYear,
      story: loudestYear ? `${loudestYear.year}: ${loudestYear.messages}` : digest.spanLabel,
      cast: [],
      quote: null,
    },
  ];
}

export function demoReport(payload: PremiumPayload): PremiumReport {
  const t = strings(payload.language as Lang);
  const { people, moments, eras, digest } = payload;

  const memories = moments.slice(0, 5).map((moment) => ({
    title: t.sampleTitle(moment.participants),
    story: t.sampleStory(moment.messages.length, moment.reasons.join(', ')),
    cast: [...new Set(moment.messages.map((m) => m.sender))].slice(0, 4),
    // Deliberately a real line from the excerpt: a demo that invents quotes
    // would be the one part of this file that says something untrue.
    quote: moment.messages.find((m) => m.text.length > 20 && m.text.length < 120)?.text ?? null,
  }));

  const characters = people.map((person, rank) => {
    const facts = [t.of(Math.round(person.share * 100)), t.length(person.meanLength)];
    if (person.nightShare > 0.05) facts.push(t.night(Math.round(person.nightShare * 100)));
    if (person.medianResponseMinutes !== null) facts.push(t.reply(person.medianResponseMinutes));

    return {
      sender: person.sender,
      title: titleFor(person, rank, t),
      description: facts.join(' '),
      catchphrase: person.distinctiveWords[0] ?? person.topEmoji[0] ?? '…',
      verdict: person.stillGone
        ? t.gone(person.longestSilenceDays)
        : t.silence(person.longestSilenceDays),
    };
  });

  const byNight = [...people].sort((a, b) => b.nightShare - a.nightShare)[0];
  const byGap = [...people].sort((a, b) => b.longestSilenceDays - a.longestSilenceDays)[0];
  const byLength = [...people].sort((a, b) => b.meanLength - a.meanLength)[0];
  const byLaugh = [...people].sort((a, b) => b.laughsPerMessage - a.laughsPerMessage)[0];

  // Prefer distinct winners — an award list where one person wins everything is
  // the failure mode the real prompt is told to avoid. But preferring is all it
  // can be: in a chat where several people have identical figures, every
  // superlative points at the same person and deduplication leaves one award
  // against a schema that requires four. Distinctness yields to the contract.
  const seen = new Set<string>();
  const candidates = [
    [t.loudest, people[0]],
    [t.nightOwl, byNight],
    [t.ghost, byGap],
    [t.essayist, byLength],
    [t.regular, byLaugh],
    [t.fastest, people[1]],
    [t.quiet, people[people.length - 1]],
    [t.oneWord, people[2]],
  ] as const;

  const distinct = candidates.filter(([, person]) => {
    if (!person || seen.has(person.sender)) return false;
    seen.add(person.sender);
    return true;
  });
  const awards = (distinct.length >= 4 ? distinct : candidates.filter(([, p]) => p))
    .slice(0, 8)
    .map(([name, person]) => ({
      name,
      winner: person!.sender,
      reason: t.of(Math.round(person!.share * 100)),
    }));

  return {
    // A chat with no scoreable bursts still has to fill the deck, and the
    // schema's four-memory floor is a contract the route must honour whether or
    // not a model wrote the report. These fall back to facts the chat always
    // has: its loudest day, its longest run, its longest silence, its size.
    memories: memories.length >= 4 ? memories : [...memories, ...fallbackMemories(payload, t)].slice(0, 5),
    characters,
    awards,
    eras: eras.map((era) => ({
      year: era.year,
      title: t.yearTitle(era.year),
      summary: t.year(era.messages),
    })),
    narrative: t.narrative(digest.totalMessages, digest.spanLabel),
  };
}
