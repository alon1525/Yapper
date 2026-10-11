import Link from 'next/link';
import { LAST_UPDATED, SERVICE_NAME, TO_FILL, type FillKey } from '@/lib/legal';

/**
 * The shell every legal page is poured into.
 *
 * Four documents that look like four different websites read as four different
 * promises, so the chrome is written once: the same bar back to the product,
 * the same measure, the same footer carrying the reader to the sibling pages.
 * The pages themselves supply only prose.
 *
 * Server components throughout — there is no state on any of these pages, and
 * shipping the parser's neighbours to a reader who came to check a refund
 * policy would be a strange thing to do.
 */

const PAGES = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/accessibility', label: 'Accessibility' },
] as const;

/**
 * A blank the operator still has to fill in.
 *
 * Shown as a visible marker rather than invented plausible text. A policy that
 * confidently names the wrong company is a worse document than one that shows
 * its reader exactly which line is not finished yet — and the operator needs
 * to be able to find these, which a marker guarantees and a guess does not.
 */
export function Fill({ k }: { k: FillKey }) {
  return <span className="yap-legal-fill">[{TO_FILL[k]}]</span>;
}

/** A pulled-out promise (green) or caution (amber). */
export function Note({
  tone = 'plain',
  children,
}: {
  tone?: 'plain' | 'warn';
  children: React.ReactNode;
}) {
  return (
    <div className={`yap-legal-note${tone === 'warn' ? ' yap-legal-note--warn' : ''}`}>
      {children}
    </div>
  );
}

/**
 * Contents for the two long pages. Anchors are derived from the same list that
 * renders the headings' `id`s in the page body, so a renamed section cannot
 * leave a dead link behind.
 */
export function Contents({ items }: { items: readonly { id: string; title: string }[] }) {
  return (
    <nav className="yap-legal-toc" aria-label="Contents">
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A table that scrolls inside itself instead of widening the page. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="yap-legal-table-wrap" role="region" tabIndex={0}>
      <table>{children}</table>
    </div>
  );
}

export function LegalPage({
  eyebrow,
  title,
  standfirst,
  current,
  children,
}: {
  eyebrow: string;
  title: string;
  standfirst: React.ReactNode;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="yap-legal">
      <header className="yap-legal-bar">
        <div className="yap-legal-bar-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/reg.png" alt="" />
          <Link href="/">← {SERVICE_NAME}</Link>
        </div>
      </header>

      <main className="yap-legal-body">
        <div className="yap-legal-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="yap-legal-standfirst">{standfirst}</p>
        <p className="yap-legal-dates">Last updated {LAST_UPDATED}</p>
        {children}
      </main>

      <footer className="yap-legal-foot">
        <div className="yap-legal-foot-inner">
          <span>© 2026 {SERVICE_NAME}</span>
          <nav aria-label="Legal">
            {PAGES.filter((p) => p.href !== current).map((p) => (
              <Link key={p.href} href={p.href}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
