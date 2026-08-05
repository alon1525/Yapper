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
  filter: string;
  /** How much of the photograph survives at all. */
  opacity: number;
  /** Flat veil of the slide's own ground, across the whole frame. */
  veil: number;
  /** The same ground again, bottom-weighted, where the copy sits. */
  scrimTop: number;
  scrimBottom: number;
}

/**
 * How a photo is pushed under the type.
 *
 * A snapshot dropped behind a headline wins the slide outright. The deck is
 * flat grounds and one loud idea per screen, and a photograph is the loudest
 * thing that can be put on a page — the first version of this graded each
 * photo into its slide's hue and left the luminance alone, which looked correct
 * on a 120px preview tile and made the opener's headline unreadable at full
 * size. Detail behind type is the problem, not colour.
 *
 * So the photo is desaturated, dropped to roughly a third, and buried under two
 * layers of the slide's *own* ground: a flat veil everywhere and a second pass
 * weighted towards the bottom, where the copy is. What survives is texture —
 * you can tell it is your photo, and you can still read the slide.
 *
 * Every colour comes from the ground that is passed in, so this module names no
 * colours either, and the same function draws the onboarding's preview tiles.
 * A photo that looks one way while you are choosing it and another way in the
 * story is a bug the reader has no way to report.
 */
export const GROUP_GRADES: Record<GroupSlot, Grade> = {
  opener: {
    filter: 'grayscale(1) contrast(1.05)',
    opacity: 0.36,
    veil: 0.5,
    scrimTop: 0.2,
    scrimBottom: 0.82,
  },
  chaos: {
    filter: 'grayscale(1) contrast(1.5) brightness(.8)',
    opacity: 0.45,
    veil: 0.45,
    scrimTop: 0.25,
    scrimBottom: 0.85,
  },
  verdict: {
    filter: 'grayscale(1) contrast(1.2) brightness(1.1)',
    opacity: 0.4,
    veil: 0.5,
    scrimTop: 0.3,
    scrimBottom: 0.9,
  },
  paywall: {
    filter: 'grayscale(1) contrast(1.15)',
    opacity: 0.32,
    veil: 0.58,
    scrimTop: 0.35,
    scrimBottom: 0.9,
  },
};

const mix = (ground: string, percent: number) =>
  `color-mix(in srgb, ${ground} ${Math.round(percent * 100)}%, transparent)`;

/** The three stacked layers, as inline styles. Shared by the deck and the
    onboarding preview so the two cannot drift. */
export function photoLayers(
  slot: GroupSlot,
  ground: string,
  url: string,
): { image: CSSProperties; veil: CSSProperties; scrim: CSSProperties } {
  const grade = GROUP_GRADES[slot];
  return {
    image: {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: grade.filter,
      opacity: grade.opacity,
    },
    veil: { background: ground, opacity: grade.veil },
    scrim: {
      background: `linear-gradient(180deg,${mix(ground, grade.scrimTop)},${mix(ground, grade.scrimBottom)})`,
    },
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
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={layers.image} />
      <div className="absolute inset-0" style={layers.veil} />
      <div className="absolute inset-0" style={layers.scrim} />
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
