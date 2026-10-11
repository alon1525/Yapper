'use client';

import { createContext, useContext, type CSSProperties } from 'react';
import type { Brief, GroupSlot } from '@/lib/brief';
import { AnimalFace } from './AnimalFace';
import type { Backdrop } from './Shell';

/**
 * The faces, in the deck.
 *
 * Photos arrive from the onboarding and are read by slides that are rendered
 * from a plain `render(stats)` function — no props to thread them through, and
 * threading them anyway would mean every slide taking an argument that most of
 * them ignore. A context is the honest shape: a slide that wants a face asks
 * for one, and a chat with no photos renders exactly what it rendered before.
 *
 * Nothing here ever leaves the browser. These are object URLs pointing at bytes
 * the user chose in a file dialog; no payload builder reads this module, and the
 * two AI routes only ever receive text.
 */

interface PhotoBag {
  /** Display name → object URL. Keyed by the name the deck shows. */
  people: Record<string, string>;
  groups: Partial<Record<GroupSlot, string>>;
}

const PhotoContext = createContext<PhotoBag>({ people: {}, groups: {} });

export function PhotoProvider({
  brief,
  children,
}: {
  brief: Pick<Brief, 'photos' | 'groupPhotos'>;
  children: React.ReactNode;
}) {
  return (
    <PhotoContext.Provider value={{ people: brief.photos, groups: brief.groupPhotos }}>
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhoto(name: string | null | undefined): string | undefined {
  const bag = useContext(PhotoContext);
  return name ? bag.people[name] : undefined;
}

export function useGroupPhoto(slot: GroupSlot | undefined): string | undefined {
  const bag = useContext(PhotoContext);
  return slot ? bag.groups[slot] : undefined;
}

/**
 * Which ground each photo slot lands on.
 *
 * The slides that take a photo read their backdrop from here rather than
 * declaring their own, and so does the onboarding's preview tile. One table,
 * because the preview's whole job is to be a truthful promise — a tile drawn on
 * lime for a slide that turns out to be forest is worse than no preview.
 *
 * This module is the leaf: it imports only a type from `Shell`, which is erased.
 * The slides import the table from here. Pointing that arrow the other way is
 * what produced a real circular import — the preview table evaluated before
 * `FinalSlide` had finished, and the whole page 500'd on `FINAL_BACKDROP is not
 * defined`.
 */
export const GROUP_SLOT_BACKDROP: Record<GroupSlot, Backdrop> = {
  opener: 'night',
  chaos: 'night',
  verdict: 'night',
  paywall: 'night',
};

interface Grade {
  /** Crushes the photo to greyscale first; the tint supplies the colour. */
  filter: string;
  /** 1 for a full duotone, lower to let the ground show through the image. */
  opacity: number;
  /** `color` re-hues the photo; `multiply` burns it into the ground. */
  blend: 'color' | 'multiply';
  tint: number;
  /** Three-stop vertical wash, in a shade of the ground. */
  washTop: number;
  washMid: number;
  washBottom: number;
  /** A dark bloom under the centre. The one violent slide gets it. */
  vignette: boolean;
  /** 0 disables. */
  grain: number;
}

/**
 * How a photo is pushed under the type.
 *
 * The design's second deck keeps the photograph: in colour, oversized and
 * drifting, under a three-stop wash of the near-black ground that is lightest
 * at the top and heaviest where the copy sits, with film grain over the lot.
 * The duotone its first pass used (photo crushed into the slide's own colour)
 * belonged to a deck of flat colours; on one dark ground the colour comes from
 * the bloom beside the photo, not from inside it.
 *
 * The order still matters and none of it is decorative:
 *
 * 1. **A light grade.** A touch of contrast and a little less brightness, so
 *    the picture reads as footage rather than as a snapshot pasted in.
 * 2. **The wash.** A shade of the ground at three stops. The design's own
 *    numbers are 55 / 35 / 88 top to bottom for a slide whose copy sits at the
 *    foot; the slides that centre their column take a heavier middle stop.
 * 3. **The bloom under the chaos day.** The one violent slide also gets a dark
 *    radial behind its centre, so the red reads as an event rather than a tint.
 * 4. **Grain.** Half a pixel of white on a 3px grid in overlay, jittering in
 *    two steps. It is the cheapest layer and the one that does the most: it is
 *    the difference between a photograph with a filter on it and something that
 *    looks printed.
 *
 * The tint layer is kept at zero rather than removed, so a grade can still ask
 * for a duotone if one slide ever wants one again.
 *
 * Every colour is derived from the ground passed in, so this module names none,
 * and the onboarding's preview tiles run the same function. A photo that looks
 * one way while you are choosing it and another way in the story is a bug the
 * reader has no way to report.
 */
export const GROUP_GRADES: Record<GroupSlot, Grade> = {
  /* The cover: copy at the foot, so the wash is the design's own three stops. */
  opener: {
    filter: 'contrast(1.08) saturate(.95) brightness(.9)',
    opacity: 1,
    blend: 'multiply',
    tint: 0,
    washTop: 0.55,
    washMid: 0.4,
    washBottom: 0.9,
    vignette: false,
    grain: 0.16,
  },
  /* The loud day: darker, harder, with the black bloom behind the centre. */
  chaos: {
    filter: 'contrast(1.3) saturate(.8) brightness(.7)',
    opacity: 1,
    blend: 'multiply',
    tint: 0,
    washTop: 0.5,
    washMid: 0.45,
    washBottom: 0.85,
    vignette: true,
    grain: 0.2,
  },
  /* The closer: copy at the foot again. */
  verdict: {
    filter: 'contrast(1.08) saturate(.9) brightness(.85)',
    opacity: 1,
    blend: 'multiply',
    tint: 0,
    washTop: 0.5,
    washMid: 0.45,
    washBottom: 0.92,
    vignette: false,
    grain: 0.16,
  },
  /* The wall: Reg and a button in the middle of the frame, so the middle stop
     carries the weight. */
  paywall: {
    filter: 'contrast(1.1) saturate(.85) brightness(.8)',
    opacity: 1,
    blend: 'multiply',
    tint: 0,
    washTop: 0.55,
    washMid: 0.7,
    washBottom: 0.92,
    vignette: false,
    grain: 0.16,
  },
};

const alpha = (colour: string, a: number) =>
  `color-mix(in srgb, ${colour} ${Math.round(a * 100)}%, transparent)`;

/**
 * The wash is a *shade* of the ground, not the ground itself.
 *
 * On a dark slide the design darkens further — its purple opener washes down to
 * near-black-violet — which is what gives the gradient somewhere to go. On a
 * light slide there is nowhere darker to go without turning the type's own
 * ground against it: lime carries near-black copy, and a dark wash under dark
 * text is the same mistake in the opposite direction. So light grounds wash
 * towards themselves, exactly as the design's half-frame treatment fades its
 * photo into flat lime.
 */
function washColour(ground: string): string {
  return isDark(ground) ? `color-mix(in srgb, ${ground} 62%, #000)` : ground;
}

/** Rec. 601 luma off a `#rrggbb` literal — every ground in the palette is one. */
function isDark(hex: string): boolean {
  const value = hex.replace('#', '');
  if (value.length !== 6) return true;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0)) / 255 < 0.6;
}

export interface PhotoLayers {
  image: CSSProperties;
  tint: CSSProperties;
  wash: CSSProperties;
  grain: CSSProperties | null;
}

/** The stacked layers, as inline styles. Shared by the deck and the onboarding
    preview so the two cannot drift apart. */
export function photoLayers(slot: GroupSlot, ground: string, url: string): PhotoLayers {
  const grade = GROUP_GRADES[slot];
  const shade = washColour(ground);

  const wash = `linear-gradient(180deg,${alpha(shade, grade.washTop)} 0%,${alpha(shade, grade.washMid)} 50%,${alpha(shade, grade.washBottom)} 100%)`;
  const bloom = grade.vignette
    ? ',radial-gradient(70% 55% at 50% 60%,rgba(0,0,0,.66),transparent 75%)'
    : '';

  return {
    image: {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: grade.filter,
      opacity: grade.opacity,
    },
    tint: { background: ground, mixBlendMode: grade.blend, opacity: grade.tint },
    // The bloom is listed first so it paints *under* the wash, the way the
    // design stacks its radial beneath the flat gradient.
    wash: { background: `${bloom ? `${bloom.slice(1)},` : ''}${wash}` },
    grain: grade.grain > 0 ? { opacity: grade.grain } : null,
  };
}

/**
 * The graded photo layer. Renders nothing at all when there is no photo, which
 * is the common case — most readers skip the step, and the deck they get is the
 * deck that existed before this feature.
 */
export function SlidePhoto({ slot, ground }: { slot: GroupSlot; ground: string }) {
  const url = useGroupPhoto(slot);
  if (!url) return null;
  const layers = photoLayers(slot, ground, url);

  return (
    // `isolate` keeps the duotone and the grain blending against the photo
    // rather than against whatever the slide is sitting on.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 isolate overflow-hidden"
    >
      {/* Oversized by 6% on every edge and drifting, so a still photograph
          reads as footage. The onboarding's tile draws the same layers without
          the drift; a thumbnail that pans is a thumbnail that distracts. */}
      <div className="yap-drift absolute -inset-[6%]" style={layers.image} />
      <div className="absolute inset-0" style={layers.tint} />
      <div className="absolute inset-0" style={layers.wash} />
      {layers.grain && <div className="yap-grain absolute inset-0" style={layers.grain} />}
    </div>
  );
}

/**
 * Somebody's face — theirs if they gave one, an animal if they did not.
 *
 * This used to render nothing without a photo, on the argument that an initials
 * disc says nothing the name did not. That argument still holds against
 * *initials*; it does not hold against a drawn face. The stand-in is a picture
 * where a picture belongs, it makes the slide the same shape whether or not the
 * reader filled the step in, and it gives a leaderboard eight distinct marks to
 * scan instead of eight names. See `AnimalFace` for why it is an animal.
 *
 * The ring is `currentColor`, so a face stays separated from lime, navy and
 * paper without this component ever naming a colour.
 */
export function Portrait({ name, size = 64 }: { name: string; size?: number }) {
  const url = usePhoto(name);

  if (!url) {
    return (
      <span aria-hidden="true" className="inline-block shrink-0 align-middle">
        <AnimalFace name={name} size={size} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full bg-cover bg-center align-middle"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${url})`,
        boxShadow: '0 0 0 2px color-mix(in srgb, currentColor 40%, transparent)',
      }}
    />
  );
}
