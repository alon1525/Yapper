'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import type { ChatStats } from '@wrapped/core';
import type { Brief } from '@/lib/brief';
import { readExportFile } from '@/lib/readExport';
import type { AnalyzerState } from '@/lib/useAnalyzer';
import { StoryPreview } from './yapped/StoryPreview';
import { Steps } from './yapped/Steps';
import { SourceMarks } from './yapped/Sources';
import { Onboarding } from './yapped/Onboarding';

/**
 * Yapped's front page.
 *
 * The pitch is not "here are some statistics about your chat", it is "someone
 * read nine years of your group chat and has notes" — so the page is set like
 * a magazine feature rather than a SaaS landing: parchment, a serif at poster
 * size, and Reg's face wherever he is doing the talking. The one loud thing on
 * it is the phone, because the phone *is* the product.
 *
 * The design is authored as a single 1280×900 frame with no breakpoints, so
 * the values below are its values, inline, exactly as written. The responsive
 * behaviour lives in `globals.css` — one column below 1024px and a scaled
 * phone below that, which a page selling a WhatsApp export cannot go without.
 */

const eyebrow = (color = '#8A7B63'): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 11,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color,
});

const chip: CSSProperties = {
  fontFamily: 'var(--yap-mono)',
  fontSize: 10.5,
  color: '#5E5344',
  background: '#F1E7D6',
  border: '1px solid #E3D5BE',
  borderRadius: 999,
  padding: '6px 11px',
};

const privacyLine: CSSProperties = {
  background: 'rgba(246,239,228,.08)',
  border: '1px solid rgba(246,239,228,.16)',
  borderRadius: 14,
  padding: 14,
  fontSize: 14.5,
  lineHeight: 1.5,
};

const MARQUEE = [
  'Top yapper',
  'Certified ghost',
  'Peak chaos day',
  'Content farm',
  'Vocabulary audit',
  'Group verdict',
];

/* Two identical runs side by side, scrolled exactly half the track — the seam
   lands where the second run starts, so the loop has no visible restart. */
function MarqueeRun() {
  return (
    <div style={{ display: 'flex', gap: 40 }}>
      {MARQUEE.map((word) => (
        <span key={word} style={{ display: 'contents' }}>
          <span>{word}</span>
          <span style={{ color: '#F5B324' }}>·</span>
        </span>
      ))}
    </div>
  );
}

function RevealPoint({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--yap-mono)', fontSize: 11, color: '#C2571F' }}>{n}</span>
      <span style={{ fontSize: 14.5, color: '#4E4536' }}>{children}</span>
    </div>
  );
}

export function Landing({
  state,
  brief,
  onBrief,
  onAnalyze,
  onNames,
  onPlay,
  onCancel,
  stats,
  freeCount,
}: {
  state: AnalyzerState;
  brief: Brief;
  onBrief: (patch: Partial<Brief>) => void;
  onAnalyze: (text: string, fileName: string, mediaCount: number) => void;
  onNames: (aliases: Record<string, string>) => void;
  onPlay: () => void;
  onCancel: () => void;
  stats: ChatStats | null;
  freeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const pick = useCallback(
    async (file: File) => {
      setReadError(null);
      try {
        const { text, fileName, mediaCount } = await readExportFile(file);
        onAnalyze(text, fileName, mediaCount);
      } catch (e) {
        setReadError(
          e instanceof Error
            ? e.message
            : 'That file could not be opened. Try exporting the chat again.',
        );
      }
    },
    [onAnalyze],
  );

  const close = useCallback(() => {
    setOpen(false);
    setReadError(null);
    onCancel();
  }, [onCancel]);

  return (
    <div
      className="yap"
      style={{
        background: '#F3EADA',
        color: '#15251C',
        fontFamily: 'var(--yap-sans)',
        minHeight: '100vh',
        // `clip`, not `hidden`: hiding one axis makes the other compute to
        // `auto`, which quietly turns this wrapper into a second scroller and
        // puts its own bar down the right of the page. `clip` trims the
        // over-wide marquee without any of that.
        overflowX: 'clip',
      }}
    >
      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '10px 24px',
          background: 'rgba(250,245,236,.86)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #E0D2BB',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reg.png"
            alt="Reg"
            style={{ width: 32, height: 32, borderRadius: 999, display: 'block' }}
          />
          <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 22, letterSpacing: '.01em' }}>
            Yapped
          </div>
          <div
            style={{
              fontFamily: 'var(--yap-mono)',
              fontSize: 10,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#8A7B63',
              paddingTop: 3,
            }}
          >
            by Reg
          </div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: '#5E5344' }}
        >
          <a className="yap-nav-links" href="#how">
            How it works
          </a>
          <a className="yap-nav-links" href="#preview">
            See a sample
          </a>
          <a
            href="#upload"
            style={{
              background: '#1D3A2A',
              color: '#F3EADA',
              padding: '9px 18px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            Get yapped →
          </a>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div
        className="yap-hero"
        style={{
          position: 'relative',
          padding: '70px 24px 40px',
          maxWidth: 1240,
          margin: '0 auto',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(120% 90% at 12% 0%,rgba(255,255,255,.65),transparent 60%),radial-gradient(90% 70% at 100% 15%,rgba(245,179,36,.16),transparent 60%)',
          }}
        />

        <div style={{ position: 'relative' }}>
          <h1
            style={{
              fontFamily: 'var(--yap-serif)',
              fontWeight: 400,
              fontSize: 'clamp(40px, 6.4vw, 78px)',
              lineHeight: 0.96,
              letterSpacing: '-.015em',
              margin: 0,
              textWrap: 'pretty',
            }}
          >
            Nine years of your group chat.{' '}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: '#FFFDF8',
                border: '1px solid #E3D5BE',
                borderRadius: 999,
                padding: '3px 20px 4px 6px',
                boxShadow: '0 6px 18px rgba(30,20,8,.10)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/reg.png"
                alt=""
                style={{ width: 52, height: 52, borderRadius: 999, display: 'block' }}
              />
              <span>Reg</span>
            </span>{' '}
            read all of it. <em style={{ fontStyle: 'italic', color: '#C2571F' }}>He has notes.</em>
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: '#5E5344',
              maxWidth: '46ch',
              margin: '22px 0 0',
              textWrap: 'pretty',
            }}
          >
            Drop in your WhatsApp or LINE export and Reg turns every message into a 40-slide story: the top
            yapper, the certified ghost, the night it all went sideways, and awards nobody asked
            for.
          </p>

          <div
            id="upload"
            style={{
              marginTop: 28,
              background: '#FFFDF8',
              border: '1px solid #E3D5BE',
              borderRadius: 22,
              padding: 20,
              maxWidth: 520,
              boxShadow: '0 18px 40px rgba(40,28,12,.09)',
            }}
          >
            <div
              style={{
                border: '1.5px dashed #CDB994',
                borderRadius: 16,
                padding: '24px 20px',
                textAlign: 'center',
                background: 'linear-gradient(180deg,#FBF6EC,#F7EFE1)',
              }}
            >
              <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 26, lineHeight: 1.15 }}>
                Feed Reg your chat export
              </div>
              <SourceMarks size={22} style={{ marginTop: 12 }} />
              <div
                style={{
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 11,
                  color: '#8A7B63',
                  marginTop: 10,
                }}
              >
                .txt or .zip — both work
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="yap-press"
                  style={{
                    border: 0,
                    cursor: 'pointer',
                    background: '#1D3A2A',
                    color: '#F6F0E4',
                    fontFamily: 'var(--yap-sans)',
                    fontSize: 15,
                    fontWeight: 500,
                    padding: '14px 26px',
                    borderRadius: 999,
                    boxShadow: '0 8px 0 #0F231A',
                  }}
                >
                  Brief Reg, then drop the export
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <div style={chip}>Read on your device · never uploaded</div>
              <div style={chip}>Free preview · premium full story</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <StoryPreview />
        </div>
      </div>

      {/* ── Marquee ────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          overflow: 'hidden',
          background: '#1D3A2A',
          color: '#F3EADA',
          padding: '14px 0',
          borderTop: '1px solid #163024',
          borderBottom: '1px solid #163024',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 40,
            width: '200%',
            animation: 'yapMarquee 28s linear infinite',
            fontFamily: 'var(--yap-poster)',
            fontSize: 22,
            textTransform: 'uppercase',
            letterSpacing: '.02em',
            whiteSpace: 'nowrap',
          }}
        >
          <MarqueeRun />
          <MarqueeRun />
        </div>
      </div>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <div id="how" style={{ maxWidth: 1100, margin: '0 auto', padding: '70px 24px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--yap-serif)',
              fontWeight: 400,
              fontSize: 'clamp(32px, 4.4vw, 46px)',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Three taps and it&apos;s Reg&apos;s problem
          </h2>
          <div style={{ ...eyebrow(), letterSpacing: '.14em' }}>
            Plays step by step · iPhone &amp; Android
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          <Steps />
        </div>
        {/* The three films are WhatsApp's menus. Saying so is the honest way to
            carry LINE here — a LINE user who follows a WhatsApp film looks for
            a "Without media" option their app has never had. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 18,
            fontFamily: 'var(--yap-sans)',
            fontSize: 13.5,
            color: '#5E5344',
          }}
        >
          <SourceMarks size={20} style={{ justifyContent: 'flex-start' }} />
          <div>
            WhatsApp is shown above. On LINE it&apos;s the ☰ menu → Settings → Export chat
            history, and Reg reads that file just the same.
          </div>
        </div>
      </div>

      {/* ── The reveal ─────────────────────────────────────────────────── */}
      <div id="preview" style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 24px 24px' }}>
        <div
          className="yap-two"
          style={{
            background: '#FFFDF8',
            border: '1px solid #E3D5BE',
            borderRadius: 26,
            padding: 30,
          }}
        >
          <div>
            <div style={eyebrow()}>The reveal</div>
            <h2
              style={{
                fontFamily: 'var(--yap-serif)',
                fontWeight: 400,
                fontSize: 'clamp(32px, 4.2vw, 44px)',
                lineHeight: 1.02,
                margin: '12px 0 0',
              }}
            >
              Quiet page. <em style={{ fontStyle: 'italic', color: '#C2571F' }}>Loud story.</em>
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: '#5E5344',
                margin: '14px 0 0',
                maxWidth: '44ch',
              }}
            >
              Sixteen slides free, with sound. The rest — a report per person, the full chaos-day
              story, the private awards — sits behind the last slide.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <RevealPoint n="01">9:16 frames, made for screenshots and status</RevealPoint>
              <RevealPoint n="02">Soundtrack with per-slide stingers — mutable, always</RevealPoint>
              <RevealPoint n="03">One link the whole group can flip through</RevealPoint>
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <div
              style={{
                width: 150,
                height: 266,
                borderRadius: 20,
                background: '#C9F24D',
                color: '#10130E',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                transform: 'rotate(-4deg)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--yap-poster)',
                  fontSize: 28,
                  lineHeight: 0.86,
                  textTransform: 'uppercase',
                }}
              >
                Nine years. Still no pizza.
              </div>
            </div>
            <div
              style={{
                width: 150,
                height: 266,
                borderRadius: 20,
                background: '#FF4FA3',
                color: '#180410',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                transform: 'rotate(3deg)',
                marginTop: 14,
              }}
            >
              <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 32, lineHeight: 0.85 }}>
                173,319
              </div>
              <div
                style={{
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 10,
                  marginTop: 6,
                  letterSpacing: '.1em',
                }}
              >
                MESSAGES
              </div>
            </div>
            <div
              style={{
                width: 150,
                height: 266,
                borderRadius: 20,
                background: '#4B1BD1',
                color: '#F1ECFF',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                transform: 'rotate(-2deg)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 10,
                  letterSpacing: '.12em',
                  color: '#C9B6FF',
                }}
              >
                CERTIFIED GHOST
              </div>
              <div
                style={{
                  fontFamily: 'var(--yap-poster)',
                  fontSize: 30,
                  lineHeight: 0.88,
                  letterSpacing: '-.01em',
                  textTransform: 'uppercase',
                  marginTop: 6,
                }}
              >
                Submarine
                <br />
                Dave
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Privacy ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 24px 70px' }}>
        <div
          className="yap-two"
          style={{ background: '#1D3A2A', color: '#F3EADA', borderRadius: 26, padding: 34 }}
        >
          <div>
            <div style={eyebrow('#F5B324')}>Privacy, plainly</div>
            <h2
              style={{
                fontFamily: 'var(--yap-serif)',
                fontWeight: 400,
                fontSize: 'clamp(30px, 3.8vw, 40px)',
                lineHeight: 1.05,
                margin: '12px 0 0',
              }}
            >
              Your chat never leaves your device.
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={privacyLine}>Every number is calculated in your browser.</div>
            <div style={privacyLine}>
              Reg&apos;s lines are optional, and he only ever sees an anonymised copy.
            </div>
            <div style={privacyLine}>Nothing is stored. Close the tab and it&apos;s gone.</div>
          </div>
        </div>
      </div>

      {open && (
        <Onboarding
          state={state}
          brief={brief}
          onBrief={onBrief}
          onClose={close}
          onPick={(file) => void pick(file)}
          onNames={onNames}
          onPlay={onPlay}
          error={state.phase === 'error' ? state.message : readError}
          stats={stats}
          freeCount={freeCount}
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #E0D2BB', background: '#FAF5EC', padding: 24 }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: '#5E5344',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/reg.png"
              alt=""
              style={{ width: 24, height: 24, borderRadius: 999, display: 'block' }}
            />
            © 2026 Yapped — Reg is a robot and has no legal standing.
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#5E5344' }}>
            <a href="#upload">Get yapped</a>
            <a href="#preview">Sample</a>
            <a href="#how">Privacy</a>
            <a href="#how">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
