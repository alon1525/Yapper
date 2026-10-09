import { notFound } from 'next/navigation';
import { DevDeck } from '@/components/dev/DevDeck';
import { REPORT_LANGUAGE_CODES, type ReportLanguage } from '@/lib/languages';

/**
 * `/dev/deck`: the written deck on a fixture, for designing against.
 *
 * Development only. A production build answers 404, the same way the fixture
 * loader refuses to run anywhere a reader could reach — a page that plays a
 * fake report is a page somebody will screenshot as a real one.
 *
 * `?lang=he` runs the deck right-to-left with Hebrew chrome, which is the
 * layout check the fixture's English copy cannot do on its own.
 */
export default async function DevDeckPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { lang } = await searchParams;
  const language = (REPORT_LANGUAGE_CODES as readonly string[]).includes(lang ?? '')
    ? (lang as ReportLanguage)
    : 'en';
  return <DevDeck language={language} />;
}
