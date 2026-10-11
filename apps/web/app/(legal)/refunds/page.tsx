import type { Metadata } from 'next';
import Link from 'next/link';
import { Fill, LegalPage, Note } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, SERVICE_NAME } from '@/lib/legal';

/**
 * Refunds and cancellation.
 *
 * The policy is deliberately more generous than the law requires, and that is
 * the cheap option rather than the kind one. A report costs a few tens of
 * shekels; a card chargeback costs the fee, the paperwork, and — past a
 * threshold the acquirer sets — the merchant account itself. “Ask and you get
 * it back” converts every angry buyer into an email instead of a dispute.
 *
 * It also removes a piece of machinery the alternative would need. A digital
 * product delivered instantly can only escape the EU/UK 14-day withdrawal right
 * if the buyer expressly consents to immediate performance *and* acknowledges
 * losing the right — a checkbox at checkout, worded correctly, recorded. By
 * simply honouring 14 days for everyone, the checkbox is unnecessary and the
 * page can promise the same thing to every reader regardless of country.
 */

export const metadata: Metadata = {
  title: `Refunds & Cancellation — ${SERVICE_NAME}`,
  description:
    'Ask within 14 days and you get your money back. What you are buying, how to ask, and how long it takes.',
};

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Money back"
      title="Refunds & Cancellation"
      current="/refunds"
      standfirst={
        <>
          If a report did not live up to it, email us within 14 days and we will refund you. We do
          not ask why, and you do not have to give a reason. Everything below is detail on that one
          sentence.
        </>
      }
    >
      <h2 id="what">1. What you are buying</h2>
      <p>
        A {SERVICE_NAME} report is a <strong>one-time purchase</strong> of <Fill k="price" />. It
        unlocks the full written report for the chat you had open when you bought it. It is not a
        subscription, nothing recurs, and there is nothing to cancel for the future.
      </p>
      <p>
        The report is generated on demand and delivered in the same session, in your browser. There
        is no shipment, no account and no download to wait for.
      </p>

      <h2 id="policy">2. The policy</h2>
      <Note>
        <p>
          <strong>14 days, no reason needed.</strong> Write to us within 14 days of your purchase
          and we will refund the full amount. You do not have to explain, and you do not have to
          delete anything you have already read or shared.
        </p>
      </Note>
      <p>Outside that window we will still look at it, and we always refund where:</p>
      <ul>
        <li>the report failed to generate, or generated so badly it is unusable;</li>
        <li>you were charged twice, or charged and never unlocked anything;</li>
        <li>you were charged for something you did not buy;</li>
        <li>the service went down before you got what you paid for.</li>
      </ul>
      <p>
        We may decline a refund where a purchase was made in breach of the{' '}
        <Link href="/terms">Terms</Link> — for example a chat obtained without permission, or an
        account systematically buying and reclaiming. That is the only case, and it is aimed at
        abuse rather than at anyone who is simply disappointed.
      </p>

      <h2 id="statutory">3. Your statutory rights</h2>
      <p>
        Consumer law in many countries gives you a right to cancel a purchase made online within a
        set period — commonly 14 days. Digital content that you agreed to receive immediately is
        often carved out of that right, which would mean an instantly-generated report is not
        covered.
      </p>
      <p>
        <strong>We do not rely on that carve-out.</strong> The policy in §2 gives you the 14 days
        regardless of whether the law in your country would have required it, so you never have to
        work out which case you are in.
      </p>
      <p>
        Wherever your local consumer law gives you <em>more</em> than this page does, that law wins.
        Nothing here limits a right you have by statute.
      </p>

      <h2 id="how">4. How to ask</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you used at
        checkout, or tell us the payment reference from your receipt. One line is enough — “refund,
        please”, and the reference.
      </p>
      <p>
        We do not need a screenshot, an explanation or a phone call. If you cannot find the
        reference, tell us the date and the approximate amount and we will look it up.
      </p>

      <h2 id="when">5. How long it takes</h2>
      <ul>
        <li>
          <strong>We reply</strong> within 3 business days.
        </li>
        <li>
          <strong>We issue the refund</strong> within 14 days of accepting the request — usually
          much sooner.
        </li>
        <li>
          <strong>Your bank posts it</strong> when it gets round to it. Card refunds typically
          appear within 5–10 business days after we send them, and that part is out of our hands.
        </li>
      </ul>
      <p>
        Refunds go back by the same method you paid with, to the same card or account. We do not
        issue credit, vouchers or partial refunds in place of the money.
      </p>

      <h2 id="chargebacks">6. Before you call your bank</h2>
      <p>
        If something has gone wrong, email us first. A chargeback takes weeks, costs us a fee on top
        of the refund, and gets you your money no faster than we would. We have never refused a
        refund to someone who asked.
      </p>

      <h2 id="price">7. Price and currency</h2>
      <p>
        The price shown at checkout is the price you pay, and is the amount we refund. If your card
        is denominated in another currency, your bank’s conversion rate applies both ways — a small
        difference between what left your account and what returns to it is your bank’s doing, not
        ours, and we cannot compensate for it.
      </p>
      <p>
        Payment is handled by <Fill k="provider" />. We never see or store your card details; see
        the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2 id="contact">8. Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — for refunds, receipts, billing
        questions and anything else about money.
      </p>
    </LegalPage>
  );
}
