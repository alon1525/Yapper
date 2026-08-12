import type { Metadata } from 'next';
import Link from 'next/link';
import { Contents, Fill, LegalPage, Note, Table } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, SERVICE_NAME } from '@/lib/legal';

/**
 * The privacy policy.
 *
 * Written from the code rather than from a template, because the landing page
 * makes an unusually strong promise — “your chat never leaves your device” —
 * and a policy that hedges it into boilerplate would be both a worse document
 * and, in the places the promise is exactly true, a false one.
 *
 * Three things a generic policy would get wrong here, all of them checked
 * against the routes rather than assumed:
 *
 *  1. Two routes take real names, and both are stated rather than buried.
 *     `/api/share-card` takes the handful printed on a card made for sharing.
 *     `/api/premium` takes the whole cast, because the paid report is written
 *     about named people and the anonymised version of it read like a
 *     horoscope. The three free AI routes are still fed the pseudonymised copy,
 *     and still refuse a payload that is not.
 *  2. The rate limiter keys on the caller's IP (`lib/rateLimit.ts`). A per-IP
 *     counter with a TTL is still personal data, so it is named, with its
 *     purpose and its expiry.
 *  3. There is no database, no analytics and no cookie of any kind — checked,
 *     not assumed. That is the strongest thing this document has to say, so it
 *     says it plainly instead of reserving the right to do it later.
 *
 * If a route changes what it sends, this page is part of the change.
 */

export const metadata: Metadata = {
  title: `Privacy Policy — ${SERVICE_NAME}`,
  description:
    'What stays on your device, the two things that are sent when you ask for them, and everything we do not keep.',
};

const SECTIONS = [
  { id: 'who', title: 'Who we are' },
  { id: 'device', title: 'What never leaves your device' },
  { id: 'sent', title: 'What is sent, when you ask' },
  { id: 'automatic', title: 'What we collect automatically' },
  { id: 'cookies', title: 'Cookies and tracking' },
  { id: 'processors', title: 'Who else is involved' },
  { id: 'retention', title: 'How long anything is kept' },
  { id: 'bases', title: 'Why we are allowed to' },
  { id: 'others', title: 'Everyone else in your chat' },
  { id: 'children', title: 'Children' },
  { id: 'rights', title: 'Your rights' },
  { id: 'transfers', title: 'International transfers' },
  { id: 'security', title: 'Security' },
  { id: 'changes', title: 'Changes' },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy, at length"
      title="Privacy Policy"
      current="/privacy"
      standfirst={
        <>
          Your chat is read on your own device, by code running in your own browser. Nothing about
          it is sent anywhere unless you press a button that says it will be. For the free parts,
          what goes is an anonymised extract, not your chat; for the report you pay for, it is a
          few thousand messages with your group’s real names on them, which section 3(b) sets out
          in full. We run no database, set no cookies and keep no profile of you.
        </>
      }
    >
      <Contents items={SECTIONS} />

      <h2 id="who">1. Who we are</h2>
      <p>
        {SERVICE_NAME} is operated by <Fill k="operator" />, of <Fill k="address" /> (“we”, “us”).
        We are the data controller for the limited processing described below.
      </p>
      <p>
        For anything in this policy — a question, a request, or a complaint — write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. A person reads that address.
      </p>

      <h2 id="device">2. What never leaves your device</h2>
      <p>
        {SERVICE_NAME} is a browser application. When you choose an export file, the file is opened
        and parsed by JavaScript running inside your browser tab, and the statistics are computed
        there. The file is never uploaded. This is not a policy commitment we are asking you to
        take on trust — it is how the product is built, and you can watch it in your browser’s
        network tab: reading a 100,000-message export produces no upload at all.
      </p>
      <p>All of the following stay in the tab and are gone when you close it:</p>
      <ul>
        <li>
          <strong>The export file itself</strong>, and every message in it.
        </li>
        <li>
          <strong>Every statistic</strong> — the leaderboards, the timelines, the awards, the
          streaks, all of it computed locally.
        </li>
        <li>
          <strong>The photos you add</strong> to put faces to names. Images are held in browser
          memory to draw the slides and are never included in any request. There is no field for
          them in anything we send.
        </li>
        <li>
          <strong>The names you type</strong> when you rename a participant, identify a phone
          number, or merge two spellings of the same person.
        </li>
      </ul>
      <Note>
        <p>
          <strong>There is no account, and no database.</strong> {SERVICE_NAME} has nowhere to store
          your chat even if it wanted to. We cannot show you your old reports, and neither can
          anyone who compels us.
        </p>
      </Note>

      <h2 id="sent">3. What is sent, and only when you ask for it</h2>
      <p>
        Four actions send something to a server. Each is something you press, none of them happens
        on page load, and you can use {SERVICE_NAME} end to end without triggering any of them.
      </p>

      <h3>a. Reg’s free writing (optional, and anonymised)</h3>
      <p>
        If you ask for the AI-written parts of your free story, an extract is sent to our server
        and on to our AI provider. Before it leaves your browser it is put through a
        pseudonymiser:
      </p>
      <ul>
        <li>
          Every participant becomes a token — <strong>Person A</strong>, <strong>Person B</strong>.
          The map from token back to real name stays in your browser and is applied to the reply
          after it comes back, so the model never receives it.
        </li>
        <li>
          Message bodies are swept for those same names, and for phone numbers and email addresses,
          because people address each other by name inside messages constantly and redacting only
          the sender column would leak every name anyway.
        </li>
        <li>
          Only a small selection of the chat goes — the few hundred messages in the
          highest-scoring conversations, not the whole export.
        </li>
        <li>
          Anything you typed in the optional “anything Reg should know” box goes through the same
          scrub, and is handled by the model as untrusted text.
        </li>
      </ul>
      <p>
        The scrub covers the display names in your export. A nickname your group invented that
        appears nowhere as a participant name cannot be detected, and we do not claim to catch it.
      </p>

      <h3>b. The full report you pay for (real names, and much more of the chat)</h3>
      <p>
        This one is different from everything above, and it is different on purpose. When you
        unlock the full report, what is sent to our server and on to our AI provider is:
      </p>
      <ul>
        <li>
          <strong>Your group’s real names</strong>, as senders and inside the message text. They
          are not replaced with tokens, and nothing is scrubbed out of the message bodies.
        </li>
        <li>
          <strong>A few thousand messages</strong> — the conversations that scored highest, at
          least one from every year of the chat, and a spread of each person’s own messages so
          that their part of the report is written from how they actually talk.
        </li>
        <li>The same statistics and the same optional notes box as above.</li>
      </ul>
      <p>
        Why it is not anonymised like the rest: we tried it that way first. A model that only ever
        sees <strong>Person E</strong> cannot repeat the joke your group makes about somebody’s
        name, cannot tell that two nicknames belong to one person, and writes a report that would
        fit any group chat — which is not worth paying for. The report is about named people, so it
        is written from named people.
      </p>
      <Note tone="warn">
        <p>
          <strong>This is the only request in {SERVICE_NAME} that carries the whole cast.</strong>{' '}
          It happens once, when you press unlock, and never on page load or during the free part of
          the story. The screen you press it on says so before you press it. If you would rather
          this never happened, do not unlock the full report — everything before the paywall runs
          under the rules in section (a).
        </p>
      </Note>
      <p>
        It is still not stored. The report is generated, returned to your browser, and neither the
        request nor the reply is written to any database of ours — there isn’t one. Our AI provider
        holds the request for its own abuse-monitoring period; see{' '}
        <Link href="#processors">who else is involved</Link>.
      </p>

      <h3>c. The share card</h3>
      <p>
        The 9:16 image is drawn on our server, so making one sends the handful of values printed on
        it: the group name, the top talker’s name and share, the night owl’s name, the top emoji,
        the date range and the message count. <strong>These are real names, not tokens</strong> —
        they are the names you are about to share on purpose. They are used to draw the image, sent
        back to you, and not stored.
      </p>

      <h3>d. Buying a report</h3>
      <p>
        Starting a purchase sends three numbers — the message count, the date-range label and the
        number of participants — which are used to issue a signed token tying your purchase to that
        one chat. No message content is involved. Card details are entered with our payment
        provider and never touch our servers; see <Link href="/refunds">Refunds</Link>.
      </p>

      <Note tone="warn">
        <p>
          <strong>What this means in practice.</strong> If you never press the AI buttons, never
          make a share card and never buy a report, no part of your conversation has left your
          device at any point.
        </p>
      </Note>

      <h2 id="automatic">4. What we collect automatically</h2>
      <p>
        Only what any web server necessarily sees when it answers a request, and one thing we
        deliberately keep for an hour:
      </p>
      <Table>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">IP address</th>
            <td>
              Counted against a per-hour limit on the routes that cost us money to serve, so that a
              script in a loop cannot run up a bill or take the service down for everyone else. The
              counter is a number against your address with an automatic expiry; it is not a log of
              what you did.
            </td>
          </tr>
          <tr>
            <th scope="row">Standard request data</th>
            <td>
              IP, timestamp, URL, response status, browser user-agent — recorded by our hosting
              provider as part of serving any website, and used for security and diagnosing faults.
            </td>
          </tr>
          <tr>
            <th scope="row">Error reports</th>
            <td>
              When a server request fails, the failure is logged so it can be fixed. These logs are
              not designed to contain the content of a request, and we do not log request bodies.
            </td>
          </tr>
        </tbody>
      </Table>
      <p>
        We do not build a profile from any of this, do not combine it with anything else, and do not
        sell or share it for advertising. We have never sold personal information and have no
        mechanism to.
      </p>

      <h2 id="cookies">5. Cookies and tracking</h2>
      <Note>
        <p>
          <strong>{SERVICE_NAME} sets no cookies.</strong> There is no analytics, no advertising
          pixel, no session identifier, no fingerprinting and nothing stored in your browser between
          visits. That is why you have not been shown a cookie banner — there is nothing to consent
          to.
        </p>
      </Note>
      <p>
        Fonts are bundled with the site and served from our own domain, so viewing a page does not
        announce your visit to a font host. If we ever add anything that does need a cookie, this
        section changes first and you will be asked.
      </p>

      <h2 id="processors">6. Who else is involved</h2>
      <p>
        We use a small number of service providers to run {SERVICE_NAME}. They act on our
        instructions under contract, and none of them is permitted to use anything they see for
        their own purposes.
      </p>
      <Table>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">What it does</th>
            <th scope="col">What it sees</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Vercel</th>
            <td>Hosts the site and runs the server routes.</td>
            <td>Request metadata, including your IP address.</td>
          </tr>
          <tr>
            <th scope="row">Upstash</th>
            <td>Holds the abuse-prevention counters.</td>
            <td>Your IP address and a request count, expiring automatically.</td>
          </tr>
          <tr>
            <th scope="row">Anthropic</th>
            <td>Runs the model that writes Reg’s lines, when you ask for them.</td>
            <td>
              The pseudonymised extract described in §3a. Anthropic’s commercial terms do not permit
              training on it.
            </td>
          </tr>
          <tr>
            <th scope="row">
              <Fill k="provider" />
            </th>
            <td>Takes payment for a report.</td>
            <td>
              Your payment and billing details, as their own controller. We receive confirmation
              that a payment succeeded, not your card number.
            </td>
          </tr>
        </tbody>
      </Table>
      <p>
        We will disclose personal data to anyone else only where we are legally required to, and
        given the above the honest answer to most such requests is that we hold nothing responsive.
      </p>

      <h2 id="retention">7. How long anything is kept</h2>
      <Table>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Kept for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Your chat, statistics, names and photos</th>
            <td>Not kept. Never received.</td>
          </tr>
          <tr>
            <th scope="row">The anonymised extract sent for AI writing</th>
            <td>
              Held in memory for the length of the request. Not written to any store of ours. Our AI
              provider may retain it briefly for abuse monitoring under its own terms.
            </td>
          </tr>
          <tr>
            <th scope="row">Share-card values</th>
            <td>The length of the request that draws the image.</td>
          </tr>
          <tr>
            <th scope="row">Rate-limit counter</th>
            <td>Expires by itself, approximately one hour after your last request.</td>
          </tr>
          <tr>
            <th scope="row">Server and access logs</th>
            <td>Kept short-term by our hosting provider for security and diagnostics.</td>
          </tr>
          <tr>
            <th scope="row">Payment and receipt records</th>
            <td>
              Kept by us and our payment provider for as long as tax and accounting law requires.
            </td>
          </tr>
        </tbody>
      </Table>

      <h2 id="bases">8. Why we are allowed to (legal bases)</h2>
      <p>
        If the GDPR or the UK GDPR applies to you, these are the bases we rely on:
      </p>
      <ul>
        <li>
          <strong>Consent</strong> — for sending an anonymised extract for AI writing, and for
          drawing a share card. Both are actions you take deliberately, and you can decline both and
          still use the product. You may withdraw consent by not making further requests; because
          nothing is retained, there is nothing left to withdraw it from.
        </li>
        <li>
          <strong>Performance of a contract</strong> — for producing and delivering a report you
          have paid for.
        </li>
        <li>
          <strong>Legitimate interests</strong> — for rate limiting, server logs and security,
          where our interest is keeping a free service available and not being billed for someone
          else’s script. The data involved is minimal and short-lived.
        </li>
        <li>
          <strong>Legal obligation</strong> — for keeping records of payments.
        </li>
      </ul>

      <h2 id="others">9. Everyone else in your chat</h2>
      <p>
        A group chat export contains other people’s words, and they did not come here and agree to
        anything. We take that seriously, and so should you.
      </p>
      <p>
        What the product does about it: their export is never uploaded; their photos never leave
        your browser; and for the free parts of the story the extract replaces their names with
        tokens and strips names, phone numbers and email addresses from message bodies.
      </p>
      <p>
        What it does not do: the full report you pay for is sent with their real names and several
        thousand of their messages, exactly as section 3(b) describes. That is a decision you make
        on their behalf, and they are not there to be asked. It is the reason the unlock screen
        states it before you press it, and the reason it is worth thinking about for a second
        before you do.
      </p>
      <p>
        What you should do about it: only upload a chat you were genuinely part of, think about
        whether the people in it would mind — and if the answer is that one of them would, the free
        story is anonymised end to end and is still a real report. Use the share card and the
        report as the joke they are meant to be rather than as a way to embarrass someone. Where
        your local law requires the others’ consent to process their messages, obtaining it is your
        responsibility — see the <Link href="/terms">Terms</Link>.
      </p>
      <p>
        If you are in someone’s exported chat and want to raise something with us, write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will help where we can, though
        in most cases the true answer is that we never held anything about you.
      </p>

      <h2 id="children">10. Children</h2>
      <p>
        {SERVICE_NAME} is not intended for children. You must be at least 16 to use it. We do not
        knowingly process data about anyone under that age; if you believe we have, write to us and
        we will act on it.
      </p>

      <h2 id="rights">11. Your rights</h2>
      <p>
        Depending on where you live, you have some or all of the following rights over personal data
        we hold about you: to know what we hold, to get a copy, to have it corrected, to have it
        deleted, to restrict or object to how we use it, to receive it in a portable form, and to
        withdraw consent. If you are in California or a state with comparable law, this includes the
        right to know, to delete, to correct, and not to be discriminated against for asking — and
        we do not sell or share personal information as those laws define it.
      </p>
      <p>
        Exercise any of them by writing to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        We will respond within the period your law allows, and in any case within one month.
      </p>
      <p>
        The honest caveat: because we operate no database and no accounts, for most people the
        complete answer to “what do you hold about me” is a short-lived request counter tied to an
        IP address, and it has usually expired before the question arrives. We would rather tell you
        that than perform a search we know is empty.
      </p>
      <p>
        You also have the right to complain to your data protection authority. We would appreciate
        the chance to fix it first.
      </p>

      <h2 id="transfers">12. International transfers</h2>
      <p>
        {SERVICE_NAME} is available worldwide and our providers operate globally, so a request may be
        handled outside the country you are in — including in the United States. Where personal data
        is transferred out of the European Economic Area or the United Kingdom, it is covered by an
        adequacy decision or by Standard Contractual Clauses in our agreements with the provider
        concerned.
      </p>

      <h2 id="security">13. Security</h2>
      <p>
        The strongest security measure here is architectural: data we never collect cannot be
        breached, and there is no store to breach. Beyond that, everything is served over HTTPS,
        server requests are validated and size-bounded before they are processed, credentials are
        held as server-side environment variables and never sent to the browser, and the entitlement
        that unlocks a paid report is cryptographically signed and bound to the specific chat it was
        bought for.
      </p>
      <p>
        No system is perfectly secure. If you find a vulnerability, please tell us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> before telling anyone else.
      </p>

      <h2 id="changes">14. Changes to this policy</h2>
      <p>
        If we change what we collect or who we send it to, we will update this page and move the
        date at the top. Material changes — anything that would surprise a reader of the current
        version — will be flagged in the product itself rather than made quietly.
      </p>
    </LegalPage>
  );
}
