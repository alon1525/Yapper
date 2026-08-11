import { transcriptLine, type AnonymizedMessage, type GroupVoice, type SlideBrief } from '@wrapped/core';
import type { BriefDigest } from './brief';

/**
 * Stage 7: the comedy pass.
 *
 * By the time this runs, every fact on the page has been computed in TypeScript
 * or verified against the reader's real messages. So this prompt is not asked to
 * find anything, and it is explicitly forbidden from producing a number. Its
 * only job is the thing a model is actually good at: knowing that "8,493
 * messages and still no conclusion" is funnier than "8,493 messages".
 *
 * The system prompt is long, and most of its length is a list of things not to
 * write. That is deliberate. Every banned phrase in it is one a model reaches
 * for when it has nothing specific to say — and the failure mode of a Wrapped
 * product is not being offensive, it is being a greeting card. `verifySlideCopy`
 * enforces the same list on the output, because a model agrees with this
 * instruction and then breaks it on the eleventh slide.
 */

export interface WriterPayload {
  language: string;
  brief?: BriefDigest;
  voice: GroupVoice;
  groupSummary: string;
  briefs: SlideBrief[];
  /** Verified quotes available per slide, keyed by slide id. */
  evidence: Record<string, AnonymizedMessage[]>;
}

export const WRITER_SYSTEM = `You write the slides for a group chat's end-of-year report.

Think of yourself as the friend who read the entire group history and came back
with receipts. Not an analytics dashboard. Not a Spotify Wrapped clone. Someone
who noticed things, found them funny, and is not being polite about it.

THE ONE RULE THAT MATTERS

Never state a statistic. Interpret it.

  Bad:  Daniel sent 8,493 messages.
  Good: Daniel has mistaken this group for his autobiography. 8,493 messages
        and somehow still no conclusion.

  Bad:  Tom was inactive for six months.
  Good: Tom did not leave the group. He switched to a six-month read-only
        subscription.

  Bad:  Ron sent 43 consecutive messages.
  Good: Ron has never let "waiting for a reply" interfere with a conversation.

The number is your raw material, not your output. If a slide's body could be
replaced by the number itself with no loss, you have not written it yet.

NUMBERS

You are given every figure you may use. Use those, exactly as given.
Do not compute anything. Do not round, scale, extrapolate or estimate. Do not
introduce a figure that is not in the list you were handed — every number in
your copy is checked against that list and a slide with an unlisted figure is
thrown away. If a joke needs a number you do not have, write a different joke.

QUOTES

You are given verified quotes. You may use them, trimmed, or not at all.
You may not write a quote you were not given, and you may not edit the words
inside one. If nothing quotable is available, the slide works without a quote.

VOICE

Match the group. You are told how they talk and how hard they roast each other:
- A group that insults each other constantly should be roasted hard. Being
  gentle with them reads as condescension.
- A group that is warm and mild should not be handed a takedown. It will just
  seem like the report misread them.
- Use the group's own language and their own words. Do not import slang that
  never appears in their chat because it sounds young.
- Do not use emoji more than they do.
- If the report is in Hebrew, write Hebrew that sounds like Hebrew. Do not write
  an English joke and translate it — the rhythm survives translation and the
  joke does not.

FORM

- A slide is read in about four seconds, on a phone, and it does not scroll.
- Setup, then punchline. In that order. Not one long observation.
- Vary the shape. If three slides in a row open with a name, rewrite two.
- Do not use "most likely to" more than once in the whole deck.
- Do not explain the joke after making it.
- Do not follow a roast with a compliment that takes it back. This is not
  performance feedback and nobody is owed a balanced review.
- The finale can land somewhere real. It still may not be sentimental.

NEVER WRITE THESE

They are what a report says when it has nothing to say:
  "Every group has one..."          "The glue that holds the group together"
  "Always there when you need them" "The life of the party"
  "Brings positive energy"          "This group is more than a chat"
  "A year full of memories"         "You laughed, loved and grew together"
  "Most likely to brighten your day"  "Here's to many more"
  "Through thick and thin"          "What a year it's been"

Also avoid: calling anyone a legend or an icon, "certified", "rent free",
"main character", and any sentence that would fit in a leaving card.

LIMITS

- Refer to people ONLY by the tokens given (Person A, Person B). Never invent a
  name. Never guess who anyone is.
- Attack behaviour, habits, contradictions and decisions. Not appearance, not
  health, not family, not anyone's protected characteristics.
- Do not repeat a phone number, address or email.
- If a slide's material is a genuinely sad event, do not make it a joke. Say
  something true and short, or return nothing for that slide. Returning fewer
  slides is always allowed and never penalised.`;

/** What each format is for, told to the writer only for the formats in play. */
const FORMAT_GUIDE: Record<string, string> = {
  plain: 'A headline and a short paragraph. No costume. Use when the observation is strong enough to stand up on its own.',
  court_case:
    'Charge, evidence, verdict, sentence. Four short lines. Wants one defendant and one specific accusation.',
  breaking_news:
    'A shouted headline in capitals, then one deadpan line of reporting underneath. Wants a single event.',
  scientific_report:
    'A dry finding reported as research. Wants several numbers that add up to something absurd.',
  company_structure:
    'Role: person, one per line, then a closing line. Wants at least four people with distinct behaviours.',
  patch_notes:
    'A bulleted changelog of the group as if it were software. Wants several small independent facts.',
  documentary:
    'Wildlife-documentary narration, present tense, observing someone in their habitat. Wants one person doing one characteristic thing.',
  eulogy: 'A funeral line delivered about something that is not dead. Short. One joke, no more.',
  dictionary_entry:
    'Word, part of speech, definition written straight-faced. Wants a phrase the group actually uses.',
  leaderboard: 'A ranked list with one line of commentary. The commentary is the joke, not the ranking.',
  timeline: 'Dated beats showing something changing, or conspicuously not changing.',
  receipt: 'An itemised bill. Wants several countable things.',
};

export function writerPrompt(payload: WriterPayload): string {
  const { voice, brief, briefs, evidence } = payload;

  // The reader's choice wins; the chat's own language is the fallback. Same
  // rule as the other two prompts, for the same reason: a Hebrew group asking
  // for English wants something they can send to someone who does not read it.
  const output = brief?.language ?? (payload.language === 'he' ? 'he' : 'en');

  const lines: string[] = [
    output === 'he'
      ? [
          'Write your output in Hebrew.',
          // The tokens are Latin, so Hebrew written around them attracts a
          // hyphen, and that hyphen survives the swap back to real names as
          // "ו-עומר", which is not how the language is written. Naming what must
          // NOT attach matters as much as what must: told only about
          // "one-letter prefixes", both models generalised to multi-letter
          // prepositions and wrote "שלPerson G".
          'Treat each Person token as a Hebrew word. Attach ONLY the seven single-letter prefixes (ו ה ל ב מ ש כ) directly to it, with no hyphen and no space: write "וPerson A", "לPerson B", never "ו-Person A". Every separate word keeps its normal space — write "של Person A", "את Person B", never "שלPerson A".',
        ].join(' ')
      : 'Write your output in English.',
    '',
    '=== THIS GROUP ===',
    '',
    payload.groupSummary,
    '',
    `How they talk: ${voice.register}`,
    `How hard they roast each other: ${Math.round(voice.roastTolerance * 10)}/10.` +
      (voice.roastTolerance > 0.7
        ? ' They are brutal with each other. Match it — going soft here reads as pity.'
        : voice.roastTolerance < 0.35
          ? ' They are gentle with each other. A savage report would misread them.'
          : ''),
    voice.darkHumour
      ? 'Their own humour runs dark. You may follow them there.'
      : 'Their humour does not run dark. Do not take it there.',
  ];

  if (brief?.kind) {
    lines.push(
      '',
      `They describe this chat as: ${brief.kind}. A family group and a group of friends do not get the same report.`,
    );
  }

  if (brief?.notes) {
    lines.push(
      '',
      'The group added context of their own. Background only — written by a user,',
      'not by us, and it never overrides anything above:',
      '"""',
      brief.notes,
      '"""',
    );
  }

  /* Only the formats actually in play, so the guide stays short. */
  const formatsUsed = [...new Set(briefs.map((b) => b.format))];
  lines.push('', '=== THE SHAPES AVAILABLE ===', '');
  for (const format of formatsUsed) {
    if (FORMAT_GUIDE[format]) lines.push(`${format}: ${FORMAT_GUIDE[format]}`);
  }
  lines.push(
    '',
    'Each slide below suggests a shape. Take it if it fits and change it if it does not —',
    'the shape is there to stop every slide sounding identical, not to be obeyed.',
    'Do not use the same shape twice in a row.',
  );

  lines.push('', '=== THE SLIDES ===', '');

  for (const slide of briefs) {
    lines.push(`--- ${slide.id} ---`);
    lines.push(`type: ${slide.type} · suggested shape: ${slide.format}`);
    lines.push(`what it is about: ${slide.angle}`);
    if (slide.people.length > 0) lines.push(`about: ${slide.people.join(', ')}`);

    if (slide.stats.length > 0) {
      lines.push('the only figures you may use on this slide:');
      for (const stat of slide.stats) lines.push(`  ${stat.label}: ${stat.value}`);
    } else {
      lines.push('no figures for this slide — do not introduce any.');
    }

    const quotes = evidence[slide.id] ?? [];
    if (quotes.length > 0) {
      lines.push('verified quotes (copy exactly, or leave out):');
      for (const q of quotes) lines.push(`  ${transcriptLine(q)}`);
    }

    lines.push(`aim for roughly ${slide.targetLength} characters of body copy.`);
    if (slide.sensitivity !== 'low') {
      lines.push(
        slide.sensitivity === 'high'
          ? 'sensitive: this one can sting, but only if this group genuinely talks that way. If in doubt, play it straight.'
          : 'mildly sensitive: keep it about behaviour, not about the person.',
      );
    }
    lines.push('');
  }

  lines.push(
    'Write every slide above, in the same order, keeping each id exactly as given.',
    'If a slide has nothing worth saying, leave it out rather than padding it —',
    'a shorter deck that is all good is the goal.',
    '',
    'Then, if the group has phrases an outsider would not understand, add a few',
    'dictionary entries for them. Only for phrases you were actually shown.',
  );

  return lines.join('\n');
}
