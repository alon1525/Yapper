import type { CSSProperties } from 'react';

/**
 * How to get the export, shown rather than described.
 *
 * Getting the file out of WhatsApp is where people fail more than anywhere
 * else, and it is three taps buried in a menu most of them have never opened.
 * So each step is a small looping film of the actual screen: the title bar
 * being pressed, the group-info list scrolling to `Export chat`, the share
 * sheet offering `Without media`.
 *
 * All three cards run on one 18s cycle and every animation inside them is
 * timed as a percentage of it — card 1 leads for the first third, card 2 the
 * second, card 3 the last — so the row reads as one sequence rather than three
 * things blinking independently. The keyframes are in `globals.css`; changing
 * a duration here without changing the others desynchronises the whole row.
 */

const CYCLE = '18s';

const card: CSSProperties = {
  flex: '1 1 260px',
  maxWidth: 420,
  background: '#FFFDF8',
  border: '1px solid #E3D5BE',
  borderRadius: 20,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const eyebrow: CSSProperties = {
  fontFamily: 'var(--yap-mono)',
  fontSize: 10,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: '#8A7B63',
};

const heading: CSSProperties = {
  fontFamily: 'var(--yap-serif)',
  fontSize: 24,
  lineHeight: 1.1,
  marginTop: 6,
};

const blurb: CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.5,
  color: '#5E5344',
  marginTop: 4,
};

const screen: CSSProperties = {
  position: 'relative',
  height: 290,
  borderRadius: 18,
  overflow: 'hidden',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.09)',
};

/* The back-chevron drawn as two borders on a rotated square, exactly as the
   design does it — no icon font for one glyph. */
const chevron: CSSProperties = {
  width: 8,
  height: 8,
  borderLeft: '2px solid rgba(255,255,255,.6)',
  borderBottom: '2px solid rgba(255,255,255,.6)',
  transform: 'rotate(45deg)',
};

/* The tap ripple starts invisible in its own inline style as well as in its
   keyframes, so that with animations off it stays hidden instead of freezing
   mid-flash on top of the screenshot. */
const tap = (extra: CSSProperties, animation: string): CSSProperties => ({
  position: 'absolute',
  width: 26,
  height: 26,
  borderRadius: 999,
  background: 'rgba(201,242,77,.85)',
  opacity: 0,
  animation,
  ...extra,
});

const menuRow = (dim: number): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  height: 26,
  borderRadius: 8,
  background: 'rgba(255,255,255,.04)',
  fontSize: 10.5,
  color: `rgba(233,237,239,${dim})`,
});

const bubble = (mine: boolean, maxWidth: string): CSSProperties => ({
  alignSelf: mine ? 'flex-end' : 'flex-start',
  maxWidth,
  background: mine ? '#005C4B' : '#202C33',
  color: '#E9EDEF',
  borderRadius: mine ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
  padding: '6px 8px 4px',
  fontFamily: 'var(--yap-heb)',
  fontSize: 10.5,
  lineHeight: 1.35,
});

const stamp = (dim: number): CSSProperties => ({
  textAlign: 'left',
  fontSize: 8,
  color: `rgba(233,237,239,${dim})`,
  marginTop: 2,
});

const GROUP_ROWS = [
  'Media, links and docs',
  'Starred messages',
  'Mute notifications',
  'Disappearing messages',
  '18 members',
];

function StepHead({
  n,
  title,
  children,
  dot,
}: {
  n: string;
  title: React.ReactNode;
  children: React.ReactNode;
  dot: string;
}) {
  return (
    <div style={{ minHeight: 104 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: '#DCCDB4',
            animation: `${dot} ${CYCLE} linear infinite`,
          }}
        />
        <div style={eyebrow}>Step {n}</div>
      </div>
      <div style={heading}>{title}</div>
      <div style={blurb}>{children}</div>
    </div>
  );
}

export function Steps() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        fontFamily: 'var(--yap-sans)',
        color: '#15251C',
      }}
      aria-label="How to export your chat from WhatsApp"
    >
      {/* ── 01 · tap the group name ─────────────────────────────────────── */}
      <div className="yap-loop" style={{ ...card, animation: `ysCard1 ${CYCLE} linear infinite` }}>
        <StepHead n="01" title="Tap the group name" dot="ysDot1">
          Open the chat, then tap the title bar at the top to open group info.
        </StepHead>

        <div style={{ ...screen, background: '#0B141A' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 12px',
              background: '#1F2C33',
              animation: `ysPress ${CYCLE} linear infinite`,
              transformOrigin: '50% 0',
            }}
          >
            <div style={chevron} />
            <div style={{ width: 26, height: 26, borderRadius: 999, background: '#C9F24D' }} />
            <div style={{ flex: 1 }}>
              <div
                dir="rtl"
                style={{
                  fontFamily: 'var(--yap-heb)',
                  fontWeight: 700,
                  fontSize: 11,
                  color: '#E9EDEF',
                }}
              >
                League of Virgins
              </div>
              <div style={{ fontSize: 8.5, color: 'rgba(233,237,239,.45)', marginTop: 2 }}>
                בבלי, עומר, פקולה, +15
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 50,
              left: 0,
              right: 0,
              bottom: 42,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              justifyContent: 'flex-end',
            }}
          >
            <div dir="rtl" style={bubble(false, '76%')}>
              <div style={{ color: '#C9F24D', fontWeight: 700, fontSize: 9.5, marginBottom: 2 }}>
                בבלי
              </div>
              מישהו זורק את הצ׳אט הזה ל־Yapped?
              <div style={stamp(0.45)}>23:14</div>
            </div>
            <div dir="rtl" style={bubble(true, '60%')}>
              כבר עושה
              <div style={stamp(0.5)}>23:14 ✓✓</div>
            </div>
            <div dir="rtl" style={bubble(false, '82%')}>
              <div style={{ color: '#F5B324', fontWeight: 700, fontSize: 9.5, marginBottom: 2 }}>
                עומר סמורו
              </div>
              רגע אל תעשה זה יגלה כמה אני מדבר
              <div style={stamp(0.45)}>23:15</div>
            </div>
            <div dir="rtl" style={bubble(true, '52%')}>
              מאוחר מדי 👀
              <div style={stamp(0.5)}>23:16 ✓✓</div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              background: '#0B141A',
            }}
          >
            <div
              style={{
                flex: 1,
                height: 26,
                borderRadius: 999,
                background: '#202C33',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                fontSize: 9.5,
                color: 'rgba(233,237,239,.4)',
              }}
            >
              Message
            </div>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: '#005C4B' }} />
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,.5)',
              animation: `ysDim ${CYCLE} linear infinite`,
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '76%',
              borderRadius: '18px 18px 0 0',
              background: '#1F2C33',
              boxShadow: '0 -10px 30px rgba(0,0,0,.45)',
              animation: `ysPanelUp ${CYCLE} cubic-bezier(.2,.8,.2,1) infinite`,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <div style={{ width: 50, height: 50, borderRadius: 999, background: '#C9F24D' }} />
            <div
              dir="rtl"
              style={{
                fontFamily: 'var(--yap-heb)',
                fontWeight: 900,
                fontSize: 14,
                color: '#E9EDEF',
              }}
            >
              League of Virgins
            </div>
            <div
              style={{
                fontFamily: 'var(--yap-mono)',
                fontSize: 9,
                letterSpacing: '.1em',
                color: 'rgba(233,237,239,.45)',
              }}
            >
              GROUP · 18 MEMBERS
            </div>
            <div
              style={{
                width: '100%',
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{ height: 24, borderRadius: 8, background: 'rgba(255,255,255,.05)' }}
                />
              ))}
            </div>
          </div>

          <div style={tap({ top: 20, left: 96 }, `ysTapA ${CYCLE} linear infinite`)} />
        </div>
      </div>

      {/* ── 02 · scroll to Export chat ──────────────────────────────────── */}
      <div className="yap-loop" style={{ ...card, animation: `ysCard2 ${CYCLE} linear infinite` }}>
        <StepHead n="02" title="Scroll down to Export" dot="ysDot2">
          In group info, scroll to the bottom and tap <em>Export chat</em>.
        </StepHead>

        <div style={{ ...screen, background: '#1F2C33' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 3,
              padding: '10px 12px',
              background: '#1F2C33',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <div style={chevron} />
            <div
              style={{
                fontFamily: 'var(--yap-mono)',
                fontSize: 9,
                letterSpacing: '.12em',
                color: 'rgba(233,237,239,.5)',
              }}
            >
              GROUP INFO
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 36,
              left: 0,
              right: 0,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              animation: `ysScroll ${CYCLE} cubic-bezier(.3,.7,.2,1) infinite`,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                paddingBottom: 8,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 999, background: '#C9F24D' }} />
              <div
                dir="rtl"
                style={{
                  fontFamily: 'var(--yap-heb)',
                  fontWeight: 900,
                  fontSize: 12,
                  color: '#E9EDEF',
                }}
              >
                League of Virgins
              </div>
              <div style={{ fontSize: 9, color: 'rgba(233,237,239,.45)' }}>Group · 18 members</div>
            </div>

            {GROUP_ROWS.map((label) => (
              <div key={label} style={menuRow(0.72)}>
                {label}
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                height: 30,
                borderRadius: 8,
                color: '#F1F3EC',
                animation: `ysRowHi ${CYCLE} linear infinite`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.6)',
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 500 }}>Export chat</div>
            </div>

            <div style={{ ...menuRow(0.72), color: 'rgba(255,120,120,.75)' }}>Exit group</div>
          </div>

          <div style={tap({ top: 196, left: 60 }, `ysTapB ${CYCLE} linear infinite`)} />
        </div>
      </div>

      {/* ── 03 · without media ──────────────────────────────────────────── */}
      <div className="yap-loop" style={{ ...card, animation: `ysCard3 ${CYCLE} linear infinite` }}>
        <StepHead n="03" title="Choose without media" dot="ysDot3">
          Smaller, faster, and Reg only ever needs the words.
        </StepHead>

        <div style={{ ...screen, background: '#1F2C33' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              padding: '10px 12px',
              background: '#1F2C33',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <div style={chevron} />
            <div
              style={{
                fontFamily: 'var(--yap-mono)',
                fontSize: 9,
                letterSpacing: '.12em',
                color: 'rgba(233,237,239,.5)',
              }}
            >
              GROUP INFO
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 36,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            {GROUP_ROWS.map((label) => (
              <div key={label} style={menuRow(0.6)}>
                {label}
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                height: 30,
                borderRadius: 8,
                background: 'rgba(201,242,77,.16)',
                boxShadow: 'inset 0 0 0 1px rgba(201,242,77,.4)',
                color: '#F1F3EC',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.6)',
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 500 }}>Export chat</div>
            </div>

            <div style={{ ...menuRow(0.6), color: 'rgba(255,120,120,.75)' }}>Exit group</div>
          </div>

          <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(0,0,0,.45)' }} />

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 4,
              background: '#1F2C33',
              borderRadius: '18px 18px 0 0',
              padding: '16px 14px 18px',
              boxShadow: '0 -10px 30px rgba(0,0,0,.5)',
              animation: `ysSheetUp ${CYCLE} cubic-bezier(.2,.8,.2,1) infinite`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 3,
                borderRadius: 2,
                background: 'rgba(255,255,255,.25)',
                margin: '0 auto 12px',
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#E9EDEF', textAlign: 'center' }}>
              Export chat
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(233,237,239,.6)',
                textAlign: 'center',
                lineHeight: 1.4,
                marginTop: 5,
              }}
            >
              Attaching media makes the file
              <br />
              much larger.
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 34,
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'rgba(255,255,255,.05)',
                  color: '#F1F3EC',
                  animation: `ysOptHi ${CYCLE} linear infinite`,
                }}
              >
                Without media
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 34,
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'rgba(233,237,239,.55)',
                  background: 'rgba(255,255,255,.05)',
                }}
              >
                Include media
              </div>
            </div>
          </div>

          <div
            style={tap(
              { left: 'calc(50% - 13px)', bottom: 80, zIndex: 5 },
              `ysTapC ${CYCLE} linear infinite`,
            )}
          />

          <div
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              bottom: 16,
              zIndex: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 12px',
              borderRadius: 12,
              background: '#F6EFE4',
              color: '#15251C',
              opacity: 0,
              animation: `ysToast ${CYCLE} linear infinite`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/reg.png"
              alt=""
              style={{ width: 24, height: 24, borderRadius: 999, display: 'block' }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>_chat.txt is ready</div>
              <div
                style={{
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 9,
                  color: '#7A6C57',
                  marginTop: 2,
                }}
              >
                Send it to Yapped →
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
