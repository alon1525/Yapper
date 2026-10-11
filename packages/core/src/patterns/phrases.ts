import type { ChatLanguage } from '../lang/language';
import { minWordLength, stopwordsFor } from '../lang/language';
import { dayKey } from '../stats/stats';
import { extractWords, increment } from '../stats/text';
import type { ParseResult } from '../types';

/**
 * Repeated language: the n-grams a group wears smooth, the phrase one person
 * owns, and the phrase that escaped from one person and infected everybody.
 *
 * The last of those is the point of this file. Counting repeated phrases is
 * ordinary; knowing that "יאללה בלגן" was said by exactly one person for eight
 * months and by all six of them ever since is the observation that makes a
 * reader ask how it noticed. It needs first-use attribution, an adoption date
 * per person, and evidence ids for all of it, which is why this is a pass of its
 * own rather than a top-words ranking with extra fields.
 */

export interface PhraseUse {
  messageId: number;
  sender: string;
  day: string;
}

export interface RepeatedPhrase {
  /** The n-gram, lowercased and space-joined. */
  phrase: string;
  words: number;
  count: number;
  /** Distinct senders who have used it. */
  speakers: string[];
  firstUse: PhraseUse;
  lastUse: PhraseUse;
  /** A handful of uses spread across the phrase's life, for citation. */
  examples: PhraseUse[];
}

export interface SignaturePhrase extends RepeatedPhrase {
  owner: string;
  /** Share of all uses that are this person's. 1 means nobody else says it. */
  ownership: number;
}

export interface PhraseContagion extends RepeatedPhrase {
  /** Who said it first, and said it alone for a while. */
  patientZero: string;
  /** When each later adopter first used it, in order of adoption. */
  adopters: { sender: string; day: string; messageId: number }[];
  /** Days between the coinage and the second person picking it up. */
  incubationDays: number;
  /** 0..1 — how cleanly this looks like spread rather than coincidence. */
  spreadScore: number;
}

export interface PhraseReport {
  repeated: RepeatedPhrase[];
  signatures: SignaturePhrase[];
  contagions: PhraseContagion[];
}

export interface PhraseOptions {
  /** N-gram sizes to count. Defaults to 2 and 3. */
  sizes?: number[];
  /** Minimum uses before a phrase is worth anything. */
  minCount?: number;
  /** How many of each list to keep. */
  limit?: number;
  /** Cap on messages scanned. Keeps a 173k export honest about its cost. */
  maxMessages?: number;
  /**
   * Uses required before a phrase can be somebody's signature. The default
   * suits a real export; a short one needs it lowered or nothing qualifies.
   */
  minSignatureUses?: number;
}

/**
 * A phrase must clear this share of *its own* uses to belong to one person.
 * Below it, two people say it and neither owns it.
 */
const OWNERSHIP_FLOOR = 0.75;
/** And they must have said it this many times, or it is a coincidence. */
const SIGNATURE_MIN_USES = 5;

/**
 * A contagion needs the coiner alone for at least this long. Without it, two
 * people using a phrase in the same conversation — which is just conversation —
 * reads as transmission.
 */
const MIN_INCUBATION_DAYS = 7;
/** And it has to reach this many other people to be a group phrase. */
const MIN_ADOPTERS = 2;

export function analyzePhrases(
  parsed: ParseResult,
  language: ChatLanguage,
  options: PhraseOptions = {},
): PhraseReport {
  const {
    sizes = [2, 3],
    minCount = 4,
    limit = 25,
    maxMessages = 120_000,
    minSignatureUses = SIGNATURE_MIN_USES,
  } = options;

  const stopwords = stopwordsFor(language);
  const floor = minWordLength(language);

  /*
    Uses are collected per phrase in message order. Storing every use rather
    than a count is what makes first-use attribution possible, and first-use
    attribution is the entire value of this module — but it is also the reason
    the phrase table is capped: an unbounded map of every bigram in a six-figure
    export is a genuine memory problem in a browser tab.
  */
  const uses = new Map<string, PhraseUse[]>();

  const texts = parsed.messages.filter((m) => m.kind === 'text' && m.sender !== null);
  const step = texts.length > maxMessages ? Math.ceil(texts.length / maxMessages) : 1;

  for (let i = 0; i < texts.length; i += step) {
    const m = texts[i]!;
    // Stopwords are *not* removed for n-grams. "five minutes away" and "i'm on
    // my way" are function words almost end to end, and they are exactly the
    // phrases worth finding — a content-word-only bigram list finds nothing a
    // top-words list did not already have.
    const tokens = m.body
      .toLocaleLowerCase()
      .normalize('NFC')
      .match(/[\p{L}\p{N}']+/gu);
    if (!tokens || tokens.length < 2) continue;

    const day = dayKey(m);
    for (const n of sizes) {
      for (let j = 0; j + n <= tokens.length; j++) {
        const window = tokens.slice(j, j + n);
        // A phrase made entirely of one-character tokens is noise.
        if (window.every((w) => w.length < floor)) continue;
        const phrase = window.join(' ');

        let list = uses.get(phrase);
        if (!list) {
          // Only start tracking new phrases while there is room. Established
          // ones keep accumulating, so the common phrases — the ones that
          // matter — are never truncated mid-chat.
          if (uses.size >= 400_000) continue;
          uses.set(phrase, (list = []));
        }
        list.push({ messageId: m.id, sender: m.sender!, day });
      }
    }
  }

  /* --- fold into the three shapes ---------------------------------- */
  const repeated: RepeatedPhrase[] = [];
  const signatures: SignaturePhrase[] = [];
  const contagions: PhraseContagion[] = [];

  for (const [phrase, list] of uses) {
    if (list.length < minCount) continue;

    const bySender = new Map<string, PhraseUse[]>();
    for (const use of list) {
      let s = bySender.get(use.sender);
      if (!s) bySender.set(use.sender, (s = []));
      s.push(use);
    }

    const first = list[0]!;
    const last = list[list.length - 1]!;
    const base: RepeatedPhrase = {
      phrase,
      words: phrase.split(' ').length,
      count: list.length,
      speakers: [...bySender.keys()],
      firstUse: first,
      lastUse: last,
      examples: spread(list, 4),
    };
    repeated.push(base);

    /* signature: one person says this and the others do not */
    const ownerEntry = [...bySender.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
    const ownership = ownerEntry[1].length / list.length;
    if (ownership >= OWNERSHIP_FLOOR && ownerEntry[1].length >= minSignatureUses) {
      signatures.push({ ...base, owner: ownerEntry[0], ownership });
    }

    /* contagion: one person alone, then everybody */
    if (bySender.size > MIN_ADOPTERS) {
      const patientZero = first.sender;
      const ownUses = bySender.get(patientZero)!;

      // Everyone else, ordered by when they first said it.
      const adopters = [...bySender.entries()]
        .filter(([sender]) => sender !== patientZero)
        .map(([sender, list2]) => ({
          sender,
          day: list2[0]!.day,
          messageId: list2[0]!.messageId,
        }))
        .sort((a, b) => a.day.localeCompare(b.day));

      const secondUser = adopters[0];
      if (secondUser && adopters.length >= MIN_ADOPTERS) {
        const incubationDays = daysBetween(first.day, secondUser.day);

        if (incubationDays >= MIN_INCUBATION_DAYS) {
          // Two independent things have to hold: the coiner really did use it
          // alone for a while, and it really did reach several people. Scoring
          // them together stops a phrase said twice by one person and once each
          // by two others from reading as an epidemic.
          const soloShare = ownUses.filter((u) => u.day < secondUser.day).length / list.length;
          const reach = Math.min(1, adopters.length / Math.max(2, bySender.size - 1));
          const incubation = Math.min(1, incubationDays / 90);

          contagions.push({
            ...base,
            patientZero,
            adopters,
            incubationDays,
            spreadScore: soloShare * 0.35 + reach * 0.4 + incubation * 0.25,
          });
        }
      }
    }
  }

  /*
    Longer phrases win ties. "five minutes" and "in five minutes" both survive
    the count floor and say the same thing; the longer one is the funnier line
    and the more specific evidence, and without this the list fills with
    fragments of the same sentence.
  */
  const byInterest = (a: RepeatedPhrase, b: RepeatedPhrase) =>
    b.count * b.words - a.count * a.words || a.phrase.localeCompare(b.phrase);

  return {
    repeated: dedupeOverlapping(repeated.sort(byInterest)).slice(0, limit),
    signatures: signatures
      .sort((a, b) => b.ownership * b.count - a.ownership * a.count)
      .slice(0, limit),
    contagions: contagions.sort((a, b) => b.spreadScore - a.spreadScore).slice(0, limit),
  };
}

/** Uses spread across the phrase's whole life rather than the first four. */
function spread(list: readonly PhraseUse[], n: number): PhraseUse[] {
  if (list.length <= n) return [...list];
  const out: PhraseUse[] = [];
  for (let i = 0; i < n; i++) {
    out.push(list[Math.floor((i * (list.length - 1)) / (n - 1))]!);
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

/**
 * Drops a phrase that is wholly contained in a longer one already kept with a
 * similar count — the trigram and the two bigrams inside it are one observation,
 * and printing all three reads as a stutter.
 */
function dedupeOverlapping(sorted: readonly RepeatedPhrase[]): RepeatedPhrase[] {
  const kept: RepeatedPhrase[] = [];
  for (const candidate of sorted) {
    const shadowed = kept.some(
      (k) =>
        k.words > candidate.words &&
        ` ${k.phrase} `.includes(` ${candidate.phrase} `) &&
        candidate.count <= k.count * 1.5,
    );
    if (!shadowed) kept.push(candidate);
  }
  return kept;
}

/**
 * Words one person uses that the group barely does — the same idea as
 * `computeVoiceProfiles`, but returning the *messages*, so a claim about
 * somebody's vocabulary can be cited rather than asserted.
 */
export interface SignatureWord {
  word: string;
  owner: string;
  count: number;
  /** How many times more of this person's vocabulary it is than the group's. */
  ratio: number;
  examples: PhraseUse[];
}

export function signatureWords(
  parsed: ParseResult,
  language: ChatLanguage,
  perPerson = 3,
): SignatureWord[] {
  const stopwords = stopwordsFor(language);
  const floor = minWordLength(language);

  const counts = new Map<string, Map<string, number>>();
  const group = new Map<string, number>();
  const examples = new Map<string, PhraseUse[]>();
  const totals = new Map<string, number>();
  let groupTotal = 0;

  for (const m of parsed.messages) {
    if (m.kind !== 'text' || m.sender === null) continue;
    const day = dayKey(m);

    let mine = counts.get(m.sender);
    if (!mine) counts.set(m.sender, (mine = new Map()));

    for (const word of extractWords(m.body, stopwords, floor)) {
      increment(mine, word);
      increment(group, word);
      increment(totals, m.sender);
      groupTotal++;

      const key = `${m.sender} ${word}`;
      let ex = examples.get(key);
      if (!ex) examples.set(key, (ex = []));
      if (ex.length < 4) ex.push({ messageId: m.id, sender: m.sender, day });
    }
  }

  const out: SignatureWord[] = [];
  for (const [owner, mine] of counts) {
    const own = totals.get(owner) ?? 1;
    const ranked = [...mine.entries()]
      .filter(([, count]) => count >= 4)
      .map(([word, count]) => ({
        word,
        count,
        ratio:
          count / own / Math.max((group.get(word) ?? 0) / Math.max(1, groupTotal), 1e-9),
      }))
      .sort((a, b) => b.ratio - a.ratio || b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, perPerson);

    for (const r of ranked) {
      out.push({
        ...r,
        owner,
        examples: examples.get(`${owner} ${r.word}`) ?? [],
      });
    }
  }

  return out.sort((a, b) => b.ratio - a.ratio);
}
