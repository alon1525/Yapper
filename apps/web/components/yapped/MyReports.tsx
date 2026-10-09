'use client';

import { useState, type CSSProperties } from 'react';
import type { SavedReportSummary } from '@/lib/savedReports';
import { formatNumber } from '@/lib/format';

/**
 * The reports kept on this device, listed on the front page.
 *
 * Rendered only when there is at least one: a "My reports" heading over an
 * empty shelf is a promise the product does not make, since nothing is saved
 * unless the reader asks on the last slide. Styled as the rest of the landing
 * is — parchment, serif, mono labels — because this is still the front page,
 * not the deck.
 *
 * Everything here was read from the browser's own storage, so the copy says
 * so in as many words. A list of past reports is exactly the thing the
 * privacy page says we cannot show, and the one honest way to show it is to
 * be plain about where it came from.
 */

const mono = (extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 11,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: '#8A7B63',
  ...extra,
});

const pill = (dark: boolean): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 10.5,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  borderRadius: 999,
  padding: '5px 10px',
  background: dark ? '#1D3A2A' : '#F1E7D6',
  color: dark ? '#F3EADA' : '#5E5344',
  border: dark ? '1px solid #1D3A2A' : '1px solid #E3D5BE',
});

function savedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    date,
  );
}

export function MyReports({
  reports,
  onOpen,
  onDelete,
}: {
  reports: SavedReportSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Removal is two taps. These are the reader's own copies of a report they
  // may have paid for, and the only place they exist.
  const [confirming, setConfirming] = useState<string | null>(null);

  if (reports.length === 0) return null;

  return (
    <div id="reports" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 56px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--yap-serif)',
            fontWeight: 400,
            fontSize: 'clamp(28px, 3.6vw, 38px)',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          My reports
        </h2>
        <div style={mono()}>Kept in this browser · on this device only</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
          marginTop: 18,
        }}
      >
        {reports.map((report) => {
          const asking = confirming === report.id;
          return (
            <div
              key={report.id}
              style={{
                background: '#FFFDF8',
                border: '1px solid #E3D5BE',
                borderRadius: 18,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 10px 26px rgba(40,28,12,.06)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={pill(report.hasDeck)}>
                  {report.hasDeck ? 'Full roast' : report.hasPreview ? 'Free story' : 'Statistics'}
                </span>
                <span style={pill(false)}>Saved {savedOn(report.savedAt)}</span>
              </div>
              <div
                dir="auto"
                style={{
                  fontFamily: 'var(--yap-serif)',
                  fontSize: 24,
                  lineHeight: 1.1,
                  textWrap: 'pretty',
                }}
              >
                {report.groupName ?? 'Your chat'}
              </div>
              <div style={mono({ textTransform: 'none', letterSpacing: '.02em', fontSize: 12 })}>
                {formatNumber(report.totalMessages)} messages · {report.spanLabel} · {report.people}{' '}
                people
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(report.id)}
                  className="yap-press"
                  style={{
                    border: 0,
                    cursor: 'pointer',
                    background: '#1D3A2A',
                    color: '#F6F0E4',
                    fontFamily: 'var(--yap-sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    padding: '10px 18px',
                    borderRadius: 999,
                    boxShadow: '0 6px 0 #0F231A',
                  }}
                >
                  Open →
                </button>
                {asking ? (
                  <span style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onDelete(report.id);
                      }}
                      style={{
                        border: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#B04A18',
                        fontFamily: 'var(--yap-sans)',
                        fontSize: 13,
                        fontWeight: 500,
                        padding: 0,
                      }}
                    >
                      Yes, remove it
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#5E5344',
                        fontFamily: 'var(--yap-sans)',
                        fontSize: 13,
                        padding: 0,
                      }}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(report.id)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#8A7B63',
                      fontFamily: 'var(--yap-sans)',
                      fontSize: 13,
                      padding: 0,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ ...mono({ textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }), marginTop: 14, lineHeight: 1.5 }}>
        These were saved from the last slide, into this browser&apos;s own storage. They never
        reached a server, they are not on your other devices, and clearing this site&apos;s data
        removes them. A saved report plays again as it was; writing more of it needs the export
        again.
      </p>
    </div>
  );
}
