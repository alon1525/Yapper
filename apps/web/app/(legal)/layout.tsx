import type { Viewport } from 'next';

/**
 * A route group, so `/privacy` stays `/privacy` — the folder exists only to
 * hang this viewport override off.
 *
 * The root layout pins `maximumScale: 1`, which is right for the deck: it is a
 * full-screen story laid out to the viewport, and a pinch that scrolls a slide
 * half out of frame breaks it. Applied to a page of body text it is an
 * accessibility failure — pinch-zoom is how a great many people read anything,
 * and these four pages are the ones a reader is most likely to need to enlarge.
 *
 * Nothing here is laid out to the viewport, so the restriction buys nothing and
 * costs that. Lifted for this group only.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
