import { z } from 'zod';
import type { AiPreviewPayload } from './aiPayload';

/**
 * The prompt, kept apart from the route that sends it.
 *
 * The route imports `next/server` and the Anthropic SDK, neither of which loads
 * outside a request. Holding the prompt here means `scripts/ai-dry-run.ts` can
 * build the exact text a real user's chat would produce — and be inspected for
 * leaked names — without a key, a server, or a paid request.
 */

export const SYSTEM = `You write Spotify-Wrapped-style copy for a group chat.

Voice: funny, warm, specific, a little roasting. You are writing for the people
in this chat, not about them — they will read this and immediately screenshot it
into the same group.

The single rule that matters: never state a statistic. Turn it into an
observation about a person.

  Bad:  "Person A sent 1,200 messages."
  Good: "Person A somehow replied before anyone else had finished reading."

  Bad:  "😂 was the most used emoji."
  Good: "No serious conversation here survived two minutes before someone
         answered with 😂."

Constraints:
- Refer to people ONLY by the exact tokens you are given (Person A, Person B).
  Never invent a name. Never guess who anyone is.
- Be specific to what actually happened in the excerpts. A joke that would work
  for any group chat is a failed joke.
- Two or three sentences per memory. The narrative is one short paragraph.
- Do not moralise, do not add disclaimers, do not explain the joke.`;

/**
 * The shape the model is constrained to return, and the shape the slide renders.
 * It lives beside the prompt because the two are one contract: changing the
 * wording without changing this, or the reverse, is how a slide goes blank.
 */
export const PreviewSchema = z.object({
  memories: z
    .array(
      z.object({
        title: z.string(),
        story: z.string(),
        cast: z.array(z.string()),
      }),
    )
    .min(1)
    .max(2),
  narrative: z.string(),
  award: z.object({
    name: z.string(),
    winner: z.string(),
    reason: z.string(),
  }),
});

export function userPrompt(payload: AiPreviewPayload): string {
  const { digest, moments, language } = payload;

  const lines = [
    language === 'he'
      ? [
          'The conversation is in Hebrew. Write your output in Hebrew.',
          // The tokens are Latin, so writing Hebrew around them invites a
          // hyphen — "ו-Person A". Every token is swapped for a Hebrew name
          // before anyone reads this, and that hyphen survives the swap as
          // "ו-עומר", which is not how the language is written. Attaching the
          // prefix restores cleanly; verified against a real export.
          // "One-letter prefixes" alone was not precise enough: both models
          // generalised it to multi-letter prepositions and wrote "שלPerson G",
          // which restores to "שלגבוה" instead of "של גבוה". The rule has to
          // name what must NOT attach as well as what must.
          'Treat each Person token as a Hebrew word. Attach ONLY the seven single-letter prefixes (ו ה ל ב מ ש כ) directly to it, with no hyphen and no space: write "וPerson A", "לPerson B", never "ו-Person A". Every separate word keeps its normal space — write "של Person A", "את Person B", never "שלPerson A".',
        ].join(' ')
      : 'Write your output in English.',
    '',
    `The group has ${payload.participantCount} people and sent ${digest.totalMessages} messages (${digest.spanLabel}), about ${digest.perDay} a day.`,
  ];

  if (digest.topTalker) {
    lines.push(
      `${digest.topTalker.sender} sent ${Math.round(digest.topTalker.share * 100)}% of everything.`,
    );
  }
  if (digest.nightOwl) {
    lines.push(
      `${digest.nightOwl.sender} sends ${Math.round(digest.nightOwl.nightShare * 100)}% of their messages between midnight and 5am.`,
    );
  }
  if (digest.ghost) {
    lines.push(
      `${digest.ghost.sender} once went ${Math.round(digest.ghost.days)} days without saying anything.`,
    );
  }
  if (digest.topEmoji.length > 0) {
    lines.push(
      `Most used emoji: ${digest.topEmoji.map((e) => `${e.value} (${e.count})`).join(', ')}.`,
    );
  }

  lines.push('', 'Here are the conversations that stood out:', '');

  for (const moment of moments) {
    lines.push(`--- ${moment.id} (${moment.reasons.join('; ')}) ---`);
    for (const m of moment.messages) {
      lines.push(`[${m.time}] ${m.sender}: ${m.text}`);
    }
    lines.push('');
  }

  lines.push(
    'Pick the one or two moments that are genuinely worth remembering, write them up,',
    'then write one short closing paragraph about this group, and invent one award.',
  );

  return lines.join('\n');
}
