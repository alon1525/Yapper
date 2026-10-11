import type { Slide } from '@wrapped/core';
import type { ReportDeck } from './useReport';

/**
 * A written deck for looking at, not for reading.
 *
 * Every slide format the writer can return, once each, filled with the copy
 * from the design's own report so that what the preview shows is what the
 * design was drawn against. The model never sees this; it exists so that a
 * court case that overflows or a receipt that reads flat is visible on
 * `/dev/deck` before a key is ever attached. Nothing in it is verified, which
 * is why it is only ever handed straight to the deck and never to the pipeline.
 */

const PEOPLE = {
  alon: 'Alon',
  turtle: 'Turtle',
  tomer: 'Tomer Sharion',
  ben: 'Benbenbenben David',
  sheham: 'Sheham Gabay-Zar',
  liat: 'Liat',
  babli: 'Babli',
} as const;

export const DEV_PEOPLE: readonly string[] = Object.values(PEOPLE);

function slide(partial: Partial<Slide> & Pick<Slide, 'id' | 'type' | 'format' | 'title'>): Slide {
  return {
    subtitle: '',
    body: '',
    quotes: [],
    people: [],
    stats: [],
    scores: [],
    jokeScores: [],
    evidenceMessageIds: [],
    closer: '',
    confidence: 1,
    sensitivity: 'low',
    visualDirection: '',
    shareCaption: '',
    ...partial,
  };
}

const quote = (messageId: number, speaker: string, text: string, date: string) => ({
  messageId,
  speaker,
  text,
  date,
});

export const DEV_DECK: ReportDeck = {
  slides: [
    slide({
      id: 'stat-opening',
      type: 'opening',
      format: 'plain',
      title: 'Messages of evidence.',
      body: [
        'You renamed the chat “Famboys” in 2017 and have spent nine years disagreeing with it.',
        'Tomer has explained the same thing four times and I read all four.',
        'Liat has checked the train schedule more often than she has come.',
      ].join('\n'),
      closer: 'Everything below is the working.',
      stats: [
        { label: 'Messages', value: 25800 },
        { label: 'Days spoken on', value: 1912 },
        { label: 'Span', value: '2017 – 2026' },
        { label: 'Messages per day', value: 13 },
      ],
    }),
    slide({
      id: 'custom-diagnosis',
      type: 'custom_discovery',
      format: 'plain',
      title: 'Functional? Absolutely not.',
      subtitle: 'Group diagnosis',
      body: 'Collective braincell count: 1.7. Shared between eight people.',
      jokeScores: [
        { label: 'Friendship', value: '94/100' },
        { label: 'Entertainment', value: '99/100' },
        { label: 'Operational efficiency', value: '23/100' },
        { label: 'Ability to make plans', value: '11/100' },
        { label: 'Answering “what time?”', value: '4/100' },
      ],
    }),
    slide({
      id: 'custom-plans',
      type: 'custom_discovery',
      format: 'timeline',
      title: '47 messages to answer yes.',
      subtitle: 'Anatomy of “anyone free Friday?”',
      body: [
        "Tuesday, 18:02: someone's work schedule",
        "Tuesday, 18:09: someone's university schedule",
        'a philosophical tangent',
        'a Google Maps link',
        'Wednesday: a transportation debate',
        'a completely different activity, proposed',
        '“I might be able to”',
        'Thursday: 14 hours of silence',
        'Thursday, 23:51: Alon, saying something unhinged',
      ].join('\n'),
      closer: "You don't make plans. You conduct multi-party negotiations under international law.",
      people: [PEOPLE.alon, PEOPLE.liat, PEOPLE.tomer],
    }),
    slide({
      id: 'stat-board',
      type: 'stat',
      format: 'leaderboard',
      title: 'Who actually talks',
      body: 'Three people are 68% of this group. The other five are witnesses.',
      people: Object.values(PEOPLE),
      stats: [
        { label: PEOPLE.alon, value: '6,069' },
        { label: PEOPLE.tomer, value: '5,788' },
        { label: PEOPLE.turtle, value: '5,749' },
        { label: PEOPLE.sheham, value: '1,055' },
        { label: PEOPLE.ben, value: '1,028' },
        { label: PEOPLE.babli, value: '327' },
        { label: PEOPLE.liat, value: '144' },
      ],
    }),
    slide({
      id: 'persona-alon',
      type: 'persona',
      format: 'profile',
      title: PEOPLE.alon,
      subtitle: 'The unlicensed war criminal of comedy',
      people: [PEOPLE.alon],
      stats: [
        { label: 'Messages', value: '6,069' },
        { label: 'Avg chars', value: 19 },
        { label: 'Longest', value: '2,754' },
      ],
      body: [
        'Opens every plan with an insult and closes it by offering to drive.',
        'Wrote 2,754 characters at 01:40 because somebody got a film title wrong.',
        'Has typed “חחח” and then a paragraph explaining why it was not funny.',
      ].join('\n'),
      jokeScores: [
        { label: 'Chaos', value: '99/100' },
        { label: 'Restraint', value: '0/100' },
        { label: 'Ability to escalate', value: '∞/100' },
        { label: 'Loyalty', value: '96/100' },
      ],
      closer: 'Most likely to help you move house and insult you while carrying the couch.',
    }),
    slide({
      id: 'custom-trinity',
      type: 'custom_discovery',
      format: 'documentary',
      title: 'Here, in his natural habitat, Tomer begins a third paragraph.',
      body: 'The others have moved on. He has not noticed. A link to a UN resolution follows, unprompted, and the group falls silent in the way a forest does before rain.',
      people: [PEOPLE.tomer],
      quotes: [quote(4812, PEOPLE.tomer, 'ok so let me explain this properly because I think you are all missing the point', '2024-02-11')],
    }),
    slide({
      id: 'stat-monologue',
      type: 'stat',
      format: 'receipt',
      title: 'What Turtle sent to an empty room',
      subtitle: 'I pulled the record · 3 September 2023',
      body: [
        'Numbered points, nobody present × 12',
        '“and then I promise I am done” × 3',
        'Replies received while he typed × 0',
        'Total: one lecture, attendance zero, delivered in full.',
      ].join('\n'),
      people: [PEOPLE.turtle],
      quotes: [quote(9120, PEOPLE.turtle, 'point 12 and then I promise I am done', '2023-09-03')],
    }),
    slide({
      id: 'stat-chaos-day',
      type: 'stat',
      format: 'breaking_news',
      title: 'Group loses control of itself on a Tuesday',
      subtitle: '14 March 2024',
      body: 'By three in the afternoon four people had the keys and nobody had the car.',
      people: [PEOPLE.alon, PEOPLE.ben, PEOPLE.sheham],
      quotes: [quote(15020, PEOPLE.ben, 'wait who has the car', '2024-03-14')],
    }),
    slide({
      id: 'stat-media',
      type: 'stat',
      format: 'receipt',
      title: 'What Ben sent instead of replying',
      subtitle: 'Itemised · 2017 – 2026',
      body: [
        'Reaction videos × 212',
        'Screenshots of his own edit timeline × 48',
        'Voice notes nobody opened × 31',
        '“Sorry, was editing” × 19',
        'Total: one friendship, invoiced.',
      ].join('\n'),
      people: [PEOPLE.ben],
    }),
    slide({
      id: 'custom-final',
      type: 'custom_discovery',
      format: 'plain',
      title: 'Final group score',
      subtitle: 'I did the maths',
      body: 'Ability to communicate efficiently: −14/100. Probability this group still exists in twenty years: 100/100.',
      jokeScores: [
        { label: 'Friendship', value: '96/100' },
        { label: 'Functionality', value: '18/100' },
        { label: 'Planning', value: '9/100' },
        { label: 'Entertainment', value: '99/100' },
        { label: 'Emotional support', value: '94/100' },
        { label: 'Collective IQ', value: '45–700' },
      ],
    }),
    slide({
      id: 'stat-silence',
      type: 'stat',
      format: 'eulogy',
      title: 'In memory of the fourteen hours nobody spoke.',
      body: 'Born on a Thursday night after Alon said something unhinged. Died the next afternoon when Turtle apologised for it on his behalf.',
      people: [PEOPLE.alon, PEOPLE.turtle],
    }),
    slide({
      id: 'stat-rankings',
      type: 'finale',
      format: 'rankings',
      title: 'The aura rankings',
      body: [
        `${PEOPLE.liat}: steady. Says the least, gets replied to the fastest, has never once explained herself.`,
        `${PEOPLE.alon}: up, on chaos alone. Carried the chat and a couch.`,
        `${PEOPLE.turtle}: steady. Runs the group like a wedding planner whose wedding keeps getting cancelled.`,
        `${PEOPLE.tomer}: down, from his own paragraphs.`,
        `${PEOPLE.sheham}: protected, asterisked.`,
        `${PEOPLE.ben}: down. Missed the ranking; was editing.`,
        `${PEOPLE.babli}: appeared, was ranked, disappeared.`,
      ].join('\n'),
      closer: 'The one explaining why the plan is “actually happening” has confirmed the plan.',
      people: Object.values(PEOPLE),
    }),
  ],
  dictionary: [
    {
      phrase: 'חחח',
      partOfSpeech: 'interjection',
      definition: 'The full and final response to a 400-word message.',
      origin: 'Every day since 2017.',
      quotes: [],
      confidence: 1,
      evidenceMessageIds: [],
    },
    {
      phrase: 'I might be able to',
      partOfSpeech: 'verb phrase',
      definition: 'No.',
      origin: 'Coined by Babli, perfected by everyone.',
      quotes: [],
      confidence: 1,
      evidenceMessageIds: [],
    },
    {
      phrase: 'BenEdit',
      partOfSpeech: 'noun',
      definition: 'A unit of time between a plan being made and Ben discovering it existed. Roughly one episode.',
      origin: '',
      quotes: [],
      confidence: 1,
      evidenceMessageIds: [],
    },
  ],
  audit: {
    suppressed: [],
    rejectedFindings: [],
    rejectedSlides: [],
    findingsProposed: 0,
    findingsVerified: 0,
  },
};

/**
 * A chat for the preview's statistics to be computed from, in the Android
 * export format. Seven people, nine years, a few hundred lines, deterministic.
 * Nothing about it is meant to be read; it exists so the free slides in front
 * of the written ones have real numbers in them and the group has a name.
 */
export function devExport(): string {
  const names = Object.values(PEOPLE);
  const weights = [30, 28, 27, 5, 5, 2, 1];
  const texts = [
    'anyone free friday?',
    'חחח',
    'I might be able to',
    'who has the car',
    'ok so let me explain this properly',
    'point 12 and then I promise I am done',
    'sorry, was editing',
    'did anyone check the train',
    'this is actually a fascinating question about ancient deities',
    'no',
    '<Media omitted>',
    'wait what time?',
    'love you guys',
  ];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = () => {
    let r = rand() * 98;
    for (let i = 0; i < names.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return names[i]!;
    }
    return names[0]!;
  };

  const lines: string[] = ['01/03/2017, 20:00 - Alon created group "Famboys"'];
  const day = new Date(Date.UTC(2017, 2, 1));
  const end = Date.UTC(2026, 8, 30);
  while (day.getTime() < end) {
    // Most days are quiet; a few are not.
    const count = rand() < 0.35 ? 0 : rand() < 0.9 ? Math.floor(rand() * 4) : 20 + Math.floor(rand() * 30);
    for (let i = 0; i < count; i++) {
      const hour = rand() < 0.15 ? Math.floor(rand() * 4) : 8 + Math.floor(rand() * 15);
      const minute = Math.floor(rand() * 60);
      lines.push(
        `${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}, ` +
          `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} - ${pick()}: ${texts[Math.floor(rand() * texts.length)]}`,
      );
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return lines.join('\n');
}
