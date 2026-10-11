import type { Metadata } from 'next';
import { LegalPage, Note } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, SERVICE_NAME } from '@/lib/legal';

/**
 * Accessibility statement.
 *
 * Written against what the code actually does, which is why §3 is a list of
 * things that are wrong rather than the usual paragraph claiming conformance.
 * The deck genuinely is a full-screen animated story driven by gestures, and
 * saying otherwise would be discovered in about four seconds by the one reader
 * this page exists for. A statement whose known-issues section is empty is a
 * statement nobody checked.
 *
 * Every claim below is verifiable in the source: keyboard handling in
 * `Deck.tsx`, the `prefers-reduced-motion` block in `globals.css`, the muted
 * default and labelled control in `useStorySound.ts`, and the viewport
 * override in `app/(legal)/layout.tsx` that makes this page itself zoomable
 * where the deck is not.
 */

export const metadata: Metadata = {
  title: `Accessibility — ${SERVICE_NAME}`,
  description:
    'What works, what does not yet, and how to tell us when Yapped gets in your way.',
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Accessibility"
      title="Accessibility Statement"
      current="/accessibility"
      standfirst={
        <>
          We want {SERVICE_NAME} to be usable by as many people as possible, and it is not there
          yet. Below is what we have done, what we know is still wrong, and how to reach a person
          who will fix it.
        </>
      }
    >
      <h2 id="commitment">1. Our commitment</h2>
      <p>
        We aim to meet <strong>WCAG 2.2 Level AA</strong>. We are not claiming to have fully
        conformed to it, because we have not had the site independently audited. The gap between
        aiming and conforming is listed honestly in §3 rather than left for you to discover.
      </p>

      <h2 id="done">2. What is in place</h2>
      <ul>
        <li>
          <strong>Keyboard navigation.</strong> The story advances with the arrow keys and the
          space bar, and every control is reachable by tab.
        </li>
        <li>
          <strong>Visible focus.</strong> Focused elements get a high-contrast outline that is never
          suppressed.
        </li>
        <li>
          <strong>Reduced motion.</strong> If your system asks for reduced motion, the animations
          switch off and the illustrated steps fall back to a finished still frame rather than
          freezing mid-animation.
        </li>
        <li>
          <strong>Sound never starts by itself.</strong> The soundtrack is on by default, but no
          audio plays until you have interacted with the page — entering the story is a button you
          press, and the sample on the front page waits for your first touch or key. It can be
          silenced at any time from a mute control that is a labelled button, not an unlabelled
          icon.
        </li>
        <li>
          <strong>Text pages zoom.</strong> This page and the other written pages support pinch and
          browser zoom up to 500%.
        </li>
        <li>
          <strong>No time limits.</strong> Nothing expires while you read it, and the story never
          advances on its own.
        </li>
        <li>
          <strong>Fonts and colour.</strong> Type is real text, never an image of text, and the
          palette was chosen with contrast in mind.
        </li>
      </ul>

      <h2 id="known">3. What we know is not good enough</h2>
      <Note tone="warn">
        <p>
          <strong>The story deck is a visual, animated, full-screen experience.</strong> That is the
          product, and it means parts of it work poorly or not at all with assistive technology
          today. If any of the below stops you using {SERVICE_NAME}, write to us — we will send you
          your report in a plain readable form.
        </p>
      </Note>
      <ul>
        <li>
          <strong>Zoom is disabled inside the deck.</strong> Each slide is laid out to fill the
          viewport, and pinch-zoom is pinned off so a gesture cannot scroll a slide half out of
          frame. This fails WCAG 1.4.4 on those screens. It is a real cost and we are looking for a
          layout that does not require it.
        </li>
        <li>
          <strong>Screen reader support in the deck is unverified.</strong> The slides are built as
          visual compositions and we have not tested them end to end with a screen reader, so we
          cannot promise the reading order or the announcements are sensible.
        </li>
        <li>
          <strong>Some interactions expect a pointer.</strong> Swipe and drag are offered
          everywhere alongside buttons, but the drag-and-drop upload area and the photo step are
          more comfortable with a mouse or a touchscreen than without one.
        </li>
        <li>
          <strong>Contrast has not been fully audited.</strong> The palette was designed for it, but
          not every combination in the deck has been measured, and some of the smaller mono type is
          likely marginal.
        </li>
        <li>
          <strong>Reg’s writing is not adapted for reading level.</strong> The AI writes in jokes,
          asides and long sentences, and we do not offer a plainer version.
        </li>
        <li>
          <strong>Sound is on by default rather than off.</strong> It cannot play before you act,
          and one labelled button stops it — but the more accessible default would be silence until
          asked, and that is not what we chose.
        </li>
        <li>
          <strong>No captions or transcript</strong> for the soundtrack. It carries no information —
          it is atmosphere — but there is currently nothing that says so in the interface.
        </li>
      </ul>

      <h2 id="feedback">4. Tell us</h2>
      <p>
        If something here gets in your way, please write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Say what you were trying to do,
        what happened, and what you were using — browser, device, and any assistive technology.
        Even one sentence helps.
      </p>
      <p>
        We aim to reply within <strong>3 business days</strong>, and to tell you either when it will
        be fixed or that it will not be, rather than leaving you without an answer. If you need
        something from {SERVICE_NAME} that the interface will not give you, ask and we will find
        another way to get it to you.
      </p>

      <h2 id="scope">5. Scope of this statement</h2>
      <p>
        This statement covers the {SERVICE_NAME} website. It does not cover the WhatsApp or LINE
        apps you export your chat from, which are other companies’ products, or the payment
        provider’s checkout pages, which are hosted and controlled by them.
      </p>
      <p>
        This statement was prepared by reviewing the site’s own code and behaviour. It has not been
        independently audited, and we will update it when that changes.
      </p>
    </LegalPage>
  );
}
