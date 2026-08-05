'use client';

import { createContext, useContext, type CSSProperties } from 'react';
import type { Brief, GroupSlot } from '@/lib/brief';
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
  opener: 'lime',
  chaos: 'red',
  verdict: 'lime',
  paywall: 'forest',
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
 * Straight from the design's own treatment test, which set five options beside
 * each other and picked one: *photo crushed into the slide's own colour, hard
 * gradient, film grain — this is the one I'd ship.*
 *
 * The order matters and none of it is decorative:
 *
 * 1. **Greyscale first.** The photo supplies luminance and nothing else. This
 *    is what stops a red jumper in someone's holiday snap from fighting the
 *    slide.
 * 2. **The ground, blended.** `color` re-hues every pixel to the slide's own
 *    hue — a true duotone, so the lime slide stays lime and the photo becomes
 *    the lime slide's photo. The chaos slide uses `multiply` instead, which
 *    burns rather than tints; it should read as an event, not a portrait.
 * 3. **A three-stop wash** in a shade of the ground, heaviest where the copy
 *    sits. The design puts its type at the bottom and uses a bottom gradient;
 *    this deck centres its column, so the middle stop is the strong one here.
 *    That is the one deliberate departure.
 * 4. **Grain.** Half a pixel of white on a 3px grid in overlay, jittering in
 *    two steps. It is the cheapest layer and the one that does the most: it is
 *    the difference between a photograph with a filter on it and something that
 *    looks printed.
 *
 * An earlier version of this dropped the photo to a third under a flat veil.
 * It was legible and it was dead — no duotone, no grain, a snapshot behind
 * fog. Legibility was never the hard part; keeping the photo *and* the type is.
 *
 * Every colour is derived from the ground passed in, so this module names none,
 * and the onboarding's preview tiles run the same function. A photo that looks
 * one way while you are choosing it and another way in the story is a bug the
 * reader has no way to report.
 */
export const GROUP_GRADES: Record<GroupSlot, Grade> = {
  /* B · Duotone opener — the design's recommended treatment. */
  opener: {
    filter: 'grayscale(1) contrast(1.25) brightness(.92)',
    opacity: 1,
    blend: 'color',
    tint: 0.92,
    washTop: 0.12,
    washMid: 0.68,
    washBottom: 0.95,
    vignette: false,
    grain: 0.16,
  },
  /* C · Chaos day — red multiply, blown contrast, black bloom. */
  chaos: {
    filter: 'grayscale(1) contrast(1.6) brightness(.6)',
    opacity: 1,
    blend: 'multiply',
    tint: 1,
    washTop: 0.1,
    washMid: 0.45,
    washBottom: 0.8,
    vignette: true,
    grain: 0.2,
  },
  /* D · Ghost background — the treatment that survives a 2016 potato camera. */
  verdict: {
    filter: 'grayscale(1) contrast(1.3) brightness(1.05)',
    opacity: 0.5,
    blend: 'color',
    tint: 0.6,
    washTop: 0.2,
    washMid: 0.72,
    washBottom: 0.96,
    vignette: false,
    grain: 0.12,
  },
  paywall: {
    filter: 'grayscale(1) contrast(1.2) brightness(.85)',
    opacity: 1,
    blend: 'color',
    tint: 0.92,
    washTop: 0.25,
    washMid: 0.74,
    washBottom: 0.96,
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
      <div className="absolute inset-0" style={layers.image} />
      <div className="absolute inset-0" style={layers.tint} />
      <div className="absolute inset-0" style={layers.wash} />
      {layers.grain && <div className="yap-grain absolute inset-0" style={layers.grain} />}
    </div>
  );
}

/**
 * Somebody's face, or nothing at all.
 *
 * Deliberately not an initials placeholder. Photos are optional and most decks
 * will not have them, so a fallback avatar would mean adding a circle to every
 * slide of every chat in order to serve the ones that filled the step in — and
 * an initials disc beside a name already set at poster size says nothing the
 * name did not. Absent is a better default than decorative.
 *
 * The ring is `currentColor`, so a photo stays separated from lime, navy and
 * paper without this component ever naming a colour.
 */
export function Portrait({ name, size = 64 }: { name: string; size?: number }) {
  const url = usePhoto(name);
  if (!url) return null;

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
