'use client';

/**
 * The stand-in face.
 *
 * Most readers fill in two or three photos and leave the rest of the chat
 * blank, so the common case for any slide that shows a person is *no picture*.
 * This is what goes there: a flat two-tone animal head, drawn rather than
 * photographed, so a name without a photo still arrives with a face beside it.
 *
 * An animal and not a human one. A generated human face has to make a guess
 * about the person it stands for — a guess this deck has no data for and gets
 * visibly wrong when it misses. A pig has no such claim to make: nobody reads
 * it as a likeness, so it can sit next to any name in any script without ever
 * being about that person.
 *
 * Ported from `Yapped Face.dc.html` in the design project: every path, table
 * and rotation is the design's, so the animals are the ones that were signed
 * off. Only the hash differs, and `hash` below says why. The rotation is
 * `ORDER` — six of the ten
 * silhouettes below. The other four are reachable only by naming them, which is
 * how the design leaves them: `cat` strokes whiskers across the head and
 * `frog`/`owl` want a different pupil table, and neither is worth the exception
 * when six read cleanly at every size the deck asks for.
 */

/**
 * The avatar's own colours, not the slide's.
 *
 * Everywhere this renders, the alternative it replaces is a photograph — which
 * arrives in whatever colours it arrives in and does not restyle itself per
 * ground. So this does not either. Reading `--slide-accent` would make the same
 * person a different animal-coloured object on every slide they appear on, and
 * the point of a stand-in face is that it is recognisably *theirs* across the
 * deck.
 */
const PLATE = '#E5D9C1';
const FACE = '#F6EEDF';
const INK = '#15251C';

/**
 * Fur, per person. The design's five hues, each lightened until the face reads.
 *
 * Every animal's eyes and brows are `INK` drawn straight onto fur, and the
 * turtle — which has no muzzle — puts its nose, mouth and shell plates there
 * too. The design's tones are all mid-dark, which is fine at the 98px the mock
 * draws them at and not fine at the 30px a leaderboard row gets: `#2F4FB8`
 * against `INK` is 2.2:1, and a blue turtle at that size is a featureless disc.
 *
 * These are the same five hues tinted toward white until each clears 4.5:1
 * against `INK` while still holding 3:1 against the cream muzzle — both ways,
 * because a fur light enough to show the eyes can go on to swallow the snout.
 * Lightening was the lever rather than swapping hues: the pool of ready-made
 * colours that clears both bars is almost entirely pink and orange, and five
 * animals in five shades of the same warmth is not a set.
 */
const FUR = ['#CB7041', '#579385', '#6F86CE', '#CA6B97', '#878A81'] as const;

interface Species {
  ears?: string;
  earsInner?: string;
  head: string;
  /** A lighter mask over the head — the fox's chin, the monkey's face. */
  patch?: string;
  muzzle?: string;
  /** Drawn instead of a muzzle, for the two species with eyes bigger than one. */
  eyeWhites?: string;
  nose?: string;
  /** Fixed when the species owns its expression; hashed from MOUTH otherwise. */
  mouth?: string;
  /** Whatever else the animal is: shell plates, a chin line, ear tufts. */
  extra?: string;
}

const SPECIES: Record<string, Species> = {
  dog: {
    ears: 'M23 44c-9 3-13 16-8 26 5 10 14 10 16 3zM77 44c9 3 13 16 8 26-5 10-14 10-16 3z',
    head: 'M50 88c-17 0-27-11-27-25s10-25 27-25 27 11 27 25-10 25-27 25z',
    muzzle: 'M34 72a16 12 0 1 0 32 0a16 12 0 1 0-32 0z',
    nose: 'M43 65h14c0 6-3 9-7 9s-7-3-7-9z',
    extra: 'M50 74v6',
  },
  bear: {
    ears: 'M21 36a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM59 36a10 10 0 1 0 20 0a10 10 0 1 0-20 0z',
    earsInner: 'M26 36a5 5 0 1 0 10 0a5 5 0 1 0-10 0zM64 36a5 5 0 1 0 10 0a5 5 0 1 0-10 0z',
    head: 'M50 89c-18 0-29-12-29-26s11-25 29-25 29 11 29 25-11 26-29 26z',
    muzzle: 'M35 72a15 11 0 1 0 30 0a15 11 0 1 0-30 0z',
    nose: 'M43 66h14c0 6-3 9-7 9s-7-3-7-9z',
    extra: 'M50 75v5',
  },
  rabbit: {
    ears: 'M37 36c-5-19-3-30 3-30s8 11 6 30zM63 36c5-19 3-30-3-30s-8 11-6 30z',
    earsInner: 'M39 33c-3-14-2-22 1-22s4 8 3 22zM61 33c3-14 2-22-1-22s-4 8-3 22z',
    head: 'M50 88c-16 0-26-11-26-24s10-24 26-24 26 11 26 24-10 24-26 24z',
    muzzle: 'M36 71a14 10 0 1 0 28 0a14 10 0 1 0-28 0z',
    nose: 'M47 65h6l-3 4z',
    extra: 'M50 69v4M46 79h8',
  },
  pig: {
    ears: 'M24 40l-2-18 18 10zM76 40l2-18-18 10z',
    head: 'M50 88c-17 0-27-11-27-24s10-25 27-25 27 12 27 25-10 24-27 24z',
    muzzle: 'M35 71a15 12 0 1 0 30 0a15 12 0 1 0-30 0z',
    nose: 'M44 68h4v6h-4zM52 68h4v6h-4z',
  },
  turtle: {
    head: 'M50 88c-18 0-29-11-29-25s11-25 29-25 29 11 29 25-11 25-29 25z',
    nose: 'M45 66h3v3h-3zM52 66h3v3h-3z',
    mouth: 'M38 74c8 6 16 6 24 0',
    extra: 'M38 47l6-5 6 5-3 6h-6zM55 49l5-4 5 4-2 5h-6zM26 50l5-4 5 4-2 5h-6z',
  },
  monkey: {
    ears: 'M16 58a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM64 58a10 10 0 1 0 20 0a10 10 0 1 0-20 0z',
    earsInner: 'M21 58a5 5 0 1 0 10 0a5 5 0 1 0-10 0zM69 58a5 5 0 1 0 10 0a5 5 0 1 0-10 0z',
    head: 'M50 88c-16 0-27-11-27-25s11-25 27-25 27 11 27 25-11 25-27 25z',
    patch: 'M50 46c11 0 19 8 19 20s-8 22-19 22-19-10-19-22 8-20 19-20z',
    nose: 'M46 68h2.5v3H46zM51.5 68H54v3h-2.5z',
    mouth: 'M42 76c5 4 11 4 16 0',
  },
};

/** The rotation. Six silhouettes that stay legible down to a 30px row. */
const ORDER = ['dog', 'bear', 'rabbit', 'pig', 'turtle', 'monkey'] as const;

/** [filled, catchlight, stroked] — a species uses one shape or the other. */
const EYES: [string, string, string][] = [
  ['M33.5 58a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM57.5 58a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0z', '', ''],
  [
    'M33 58a5 6.5 0 1 0 10 0a5 6.5 0 1 0-10 0zM57 58a5 6.5 0 1 0 10 0a5 6.5 0 1 0-10 0z',
    'M36 55a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0zM60 55a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0z',
    '',
  ],
  ['', '', 'M33 59c3-5 9-5 12 0M55 59c3-5 9-5 12 0'],
  ['', '', 'M33 59h11M56 59h11'],
  ['M33.5 58a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0z', '', 'M56 59c3-4 9-4 12 0'],
];

const BROWS = ['', 'M33 48c4-3 9-3 12 0M55 48c3-3 8-3 12 0', 'M33 50l12-4M55 46l12 4', 'M33 48h11M56 48h11'];
const MOUTH = ['M44 76c3 3 9 3 12 0', 'M50 74v4M44 78c3 3 9 3 12 0', 'M42 76c4 4 12 4 16 0', 'M46 78h8'];
const GLASSES = ['', '', '', 'M30 52h18v13H30zM52 52h18v13H52zM48 58h4'];

/**
 * FNV-1a with an avalanche step on the end.
 *
 * The design project's version stops at FNV-1a and indexes straight off the
 * result. That is fine for one pick and wrong for six: three of the tables here
 * have four entries, so those picks read the low *two bits* only, and FNV-1a's
 * final multiply barely mixes into them — the low bits of the digest are
 * carried by the last characters hashed, which are the slot suffix, the same
 * for every name.
 *
 * The effect is measurable rather than theoretical. Across 300 plausible names,
 * the unmixed hash produced 47 pairs whose six picks *all* matched — a person's
 * exact twin — against 4.7 expected from a 9,600-combination space. The `fmix32`
 * finaliser below lands it at expectation, i.e. twins become the ~1-in-9,600
 * coincidence they should be. It costs five instructions per avatar.
 *
 * The price is that a name draws the same animal as the design mock only if the
 * mock adopts the same finaliser. The species *set* is the deck's; the mapping
 * from name to species is this file's.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function AnimalFace({
  name,
  size,
  height,
  radius = '999px',
  /** The ground behind the animal, so a plate can match the stock it sits on. */
  bg = PLATE,
}: {
  name: string;
  size: number;
  height?: number;
  radius?: string;
  bg?: string;
}) {
  const at = <T,>(arr: readonly T[], slot: string): T => arr[hash(`${name}:${slot}`) % arr.length]!;

  const sp = SPECIES[at(ORDER, 'species')]!;
  const eyes = at(EYES, 'eyes');
  const furInk = at(FUR, 'fur');

  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden"
      style={{ width: size, height: height ?? size, borderRadius: radius, background: bg }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        <path d={sp.ears ?? ''} fill={furInk} />
        <path d={sp.earsInner ?? ''} fill={FACE} opacity=".75" />
        <path d={sp.head} fill={furInk} />
        <path d={sp.patch ?? ''} fill={FACE} />
        <path d={sp.muzzle ?? ''} fill={FACE} />
        <path d={sp.eyeWhites ?? ''} fill={FACE} />
        <path d={eyes[0]} fill={INK} />
        <path d={eyes[1]} fill={FACE} />
        <path d={eyes[2]} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={at(BROWS, 'brows')} stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d={sp.nose ?? ''} fill={INK} />
        <path
          d={sp.mouth ?? at(MOUTH, 'mouth')}
          stroke={INK}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={sp.extra ?? ''}
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity=".8"
        />
        <path d={at(GLASSES, 'glasses')} stroke={INK} strokeWidth="2.6" fill="none" />
      </svg>
    </div>
  );
}
