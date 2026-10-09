import type { Metadata } from 'next';
import Link from 'next/link';
import { Contents, Fill, LegalPage, Note } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, SERVICE_NAME } from '@/lib/legal';

/**
 * Terms of service.
 *
 * Two clauses here are doing nearly all the work, and the rest is ordinary:
 *
 *  1. §4 — the uploader confirms they have the right to upload the chat. Every
 *     export contains other people's words, and those people never agreed to
 *     anything. That is the real exposure in this product, so it is stated
 *     early and in plain language rather than buried in an indemnity.
 *  2. §9 — WhatsApp and LINE are other companies' trademarks. A product that
 *     reads their exports has to say it is not theirs, in a place a reader will
 *     actually reach.
 */

export const metadata: Metadata = {
  title: `Terms of Service — ${SERVICE_NAME}`,
  description:
    'The agreement for using Yapped: what it is, what you promise about the chat you upload, and the limits of what a robot’s opinion is worth.',
};

const SECTIONS = [
  { id: 'agreement', title: 'The agreement' },
  { id: 'what', title: 'What Yapped is' },
  { id: 'eligibility', title: 'Who may use it' },
  { id: 'yours', title: 'The chat you upload' },
  { id: 'reg', title: 'What Reg writes' },
  { id: 'use', title: 'Acceptable use' },
  { id: 'paid', title: 'Paid reports' },
  { id: 'ip', title: 'Intellectual property' },
  { id: 'affiliation', title: 'Not affiliated with WhatsApp or LINE' },
  { id: 'availability', title: 'Availability' },
  { id: 'warranty', title: 'No warranties' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnity', title: 'Indemnity' },
  { id: 'termination', title: 'Termination' },
  { id: 'law', title: 'Governing law' },
  { id: 'changes', title: 'Changes' },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="The agreement"
      title="Terms of Service"
      current="/terms"
      standfirst={
        <>
          {SERVICE_NAME} turns a chat export into a story for entertainment. Two things matter more
          than the rest: you must have the right to upload the chat you upload, and nothing Reg
          writes is a statement of fact about a real person. The whole document is below, and it is
          short.
        </>
      }
    >
      <Contents items={SECTIONS} />

      <h2 id="agreement">1. The agreement</h2>
      <p>
        These terms are a contract between you and <Fill k="operator" /> (“we”, “us”), the operator
        of {SERVICE_NAME}. By using {SERVICE_NAME} you accept them. If you do not, please do not use
        it.
      </p>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link>, <Link href="/refunds">Refund Policy</Link>{' '}
        and <Link href="/accessibility">Accessibility Statement</Link> form part of this agreement.
      </p>

      <h2 id="what">2. What {SERVICE_NAME} is</h2>
      <p>
        {SERVICE_NAME} reads a chat export you choose, computes statistics from it in your browser,
        and presents them as a story narrated by a fictional character called Reg. Parts of that
        story are written by an AI model at your request. A longer report is available to buy.
      </p>
      <p>
        It is an entertainment product. It is not analytics, not evidence, not a psychological
        assessment, and not advice of any kind.
      </p>

      <h2 id="eligibility">3. Who may use it</h2>
      <p>
        You must be at least 16 years old, and old enough under your local law to agree to a
        contract. If you are buying a report, you must be legally able to make the payment. By using
        {' '}
        {SERVICE_NAME} you confirm both.
      </p>

      <h2 id="yours">4. The chat you upload</h2>
      <Note>
        <p>
          <strong>You promise us that you have the right to upload it.</strong> Specifically: that
          you were genuinely a participant in the conversation, that you obtained the export
          lawfully, and that using it here does not breach anyone’s rights, any confidentiality
          obligation, or any law that applies to you — including, where your law requires it,
          obtaining the other participants’ consent.
        </p>
      </Note>
      <p>
        We cannot verify any of this, and we do not try to. A chat export is other people’s words as
        much as your own, which is why the product is built so that those words stay on your device
        (see the <Link href="/privacy">Privacy Policy</Link>) and why the promise above sits with
        you rather than with us.
      </p>
      <p>
        The chat and its contents remain yours and the other participants’. We claim no rights over
        them, and in the ordinary use of the product we never receive them.
      </p>

      <h2 id="reg">5. What Reg writes</h2>
      <p>
        Reg is a fictional character voiced by an AI model. The lines he produces are generated
        text: a joke about patterns in the data, written to be funny about a group of friends.
      </p>
      <ul>
        <li>
          <strong>It is not a statement of fact.</strong> Nothing Reg says about a person should be
          read as a claim about what they actually did, meant, felt or are like.
        </li>
        <li>
          <strong>It can simply be wrong.</strong> AI models misread context, invent connections and
          state guesses with confidence. Expect this rather than being surprised by it.
        </li>
        <li>
          <strong>It can be unflattering.</strong> The product’s entire premise is a roast. If you
          would not want a robot to be rude about your group chat, this is the wrong product.
        </li>
        <li>
          <strong>Do not rely on it.</strong> Not for any decision about a person, a relationship,
          an employee, or anything else that matters.
        </li>
        <li>
          Because the output is machine-generated from your data, two people with similar chats may
          receive similar text, and we make no promise that anything Reg writes is unique to you.
        </li>
      </ul>
      <p>
        You are responsible for what you do with the output — particularly for anything you choose
        to share. Sharing a card or a report is your decision about other people’s conversation, and
        the consequences of it are yours.
      </p>

      <h2 id="use">6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          upload a chat you were not part of, obtained without permission, or are not entitled to
          use;
        </li>
        <li>
          use {SERVICE_NAME} or its output to harass, bully, defame, intimidate, expose or humiliate
          anyone;
        </li>
        <li>
          use it to build a profile of a person, or for surveillance, monitoring or investigation of
          any kind;
        </li>
        <li>
          attempt to circumvent rate limits, entitlement checks or any other restriction, including
          by scripting or automating requests;
        </li>
        <li>
          probe, scan or attack the service, or use it to run workloads unrelated to producing your
          own story;
        </li>
        <li>
          resell, redistribute or commercially exploit the service or its output, or present it as
          your own product;
        </li>
        <li>
          use it in any way that is unlawful where you are, or that would put us in breach of a law
          or of our providers’ terms.
        </li>
      </ul>
      <p>
        We may block access, without notice, where we reasonably believe any of the above is
        happening.
      </p>

      <h2 id="paid">7. Paid reports</h2>
      <p>
        A report is a one-time purchase for <Fill k="price" />, generated from the chat you had open
        when you bought it. Your purchase unlocks that report, for that chat; it is not a
        subscription, and it does not entitle you to unlimited reports.
      </p>
      <p>
        Because the report is generated on demand, delivery is immediate. What that means for
        cancellation and refunds is set out in the <Link href="/refunds">Refund Policy</Link>, which
        also explains the statutory rights you may have in your country.
      </p>
      <p>
        A report is written by the same AI model as the free parts, at greater length. Everything in
        §5 applies to it too. In particular, buying a report does not buy a promise that you will
        find it funny.
      </p>

      <h2 id="ip">8. Intellectual property</h2>
      <p>
        {SERVICE_NAME} — the site, the design, the code, the character of Reg and the way the story
        is put together — belongs to us. You may not copy, adapt or reuse it beyond ordinary
        personal use of the product.
      </p>
      <p>
        <strong>Your story is yours.</strong> The report, the slides and the share card produced
        from your chat are yours to keep, post and send to your group. We grant you a worldwide,
        perpetual licence to use them for any lawful purpose, personal or commercial, subject to
        §6.
      </p>

      <h2 id="affiliation">9. Not affiliated with WhatsApp or LINE</h2>
      <Note tone="warn">
        <p>
          {SERVICE_NAME} is an independent product. It is{' '}
          <strong>not affiliated with, endorsed by, sponsored by or connected to</strong> WhatsApp,
          Meta Platforms, LINE Corporation, or any of their group companies. “WhatsApp” and “LINE”
          are trademarks of their respective owners and are used here only to say, factually, which
          exports the product can read.
        </p>
      </Note>
      <p>
        We read the export file that those apps let you produce yourself. We do not connect to your
        account, do not use any of their APIs, and cannot access anything you have not exported and
        chosen here.
      </p>

      <h2 id="availability">10. Availability</h2>
      <p>
        {SERVICE_NAME} is provided as it is, when it is. We may change, suspend or discontinue any
        part of it — including the AI features, which depend on a third-party model we do not
        control. We do not promise uninterrupted availability, and there is nothing stored on our
        side to be lost if it goes away.
      </p>
      <p>
        If we discontinue the paid report, we will honour purchases already made or refund them.
      </p>

      <h2 id="warranty">11. No warranties</h2>
      <p>
        To the fullest extent the law allows, {SERVICE_NAME} is provided “as is” and “as available”,
        without warranties of any kind, express or implied — including any implied warranty of
        merchantability, fitness for a particular purpose, accuracy or non-infringement. We do not
        warrant that the service will be uninterrupted or error-free, that a given export will parse
        correctly, or that the output will be accurate, appropriate or to your taste.
      </p>
      <p>
        Nothing here excludes a warranty or right that cannot lawfully be excluded where you live.
      </p>

      <h2 id="liability">12. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for indirect, incidental, special or
        consequential loss, for lost profits, data or goodwill, or for any harm arising from what
        you or anyone else does with the output — including embarrassment, offence or damage to a
        relationship caused by sharing it.
      </p>
      <p>
        Our total liability to you for any claim connected with {SERVICE_NAME} is limited to the
        greater of the amount you paid us in the twelve months before the claim, or{' '}
        <Fill k="price" />.
      </p>
      <p>
        Nothing in these terms limits liability for death or personal injury caused by negligence,
        for fraud, or for anything else that cannot lawfully be limited. If you are a consumer, your
        mandatory statutory rights are unaffected by this section.
      </p>

      <h2 id="indemnity">13. Indemnity</h2>
      <p>
        If someone brings a claim against us because of a chat you uploaded or something you did
        with the output — for example a participant who says you had no right to use their messages
        — you agree to cover the resulting costs and damages, provided we tell you about the claim
        promptly and let you take part in the defence. This does not apply to a claim caused by our
        own breach of these terms.
      </p>

      <h2 id="termination">14. Termination</h2>
      <p>
        You end this agreement by closing the tab; there is no account to delete. We may block your
        access if you breach these terms. The sections that should survive the end of the agreement
        — §§8, 11, 12, 13 and 15 — do.
      </p>

      <h2 id="law">15. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of <Fill k="jurisdiction" />, and the courts of{' '}
        <Fill k="courts" /> have jurisdiction over any dispute.
      </p>
      <p>
        <strong>If you are a consumer, this does not take anything away from you.</strong> You keep
        the protection of the mandatory consumer laws of the country you live in, and you may bring
        proceedings in your local courts where your law gives you that right.
      </p>
      <p>
        Before any of that, please write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Nearly everything is cheaper to fix
        by email.
      </p>

      <h2 id="changes">16. Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top says when they last changed, and the version
        on this page at the time you use {SERVICE_NAME} is the one that applies. If a change is
        material we will say so in the product rather than only here. Changes never apply
        retroactively to a report you have already bought.
      </p>
    </LegalPage>
  );
}
