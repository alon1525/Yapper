'use client';

/**
 * The shape of the chat going past, not the chat itself.
 *
 * Bubbles with bars where the words would be. Real text here would be either
 * somebody else's messages — which is the one thing this page promises never
 * to show — or a fake conversation the reader would start reading instead of
 * their own numbers. Widths and line counts are hand-set rather than random so
 * the loop looks like a conversation at a glance and is identical on every
 * render.
 */
const SCAN_ROWS: { mine: boolean; width: number; lines: number[] }[] = [
  { mine: false, width: 72, lines: [92, 61] },
  { mine: true, width: 54, lines: [80] },
  { mine: false, width: 44, lines: [68] },
  { mine: true, width: 67, lines: [88, 50] },
  { mine: false, width: 81, lines: [96, 83, 44] },
  { mine: true, width: 38, lines: [62] },
  { mine: false, width: 59, lines: [90, 55] },
  { mine: true, width: 75, lines: [86, 63] },
  { mine: false, width: 48, lines: [74] },
  { mine: true, width: 64, lines: [93, 47] },
  { mine: false, width: 70, lines: [88, 58] },
];

/**
 * The read, made watchable.
 *
 * The work is real and it is invisible: a number climbing on a beige page is
 * the whole of it. This is the same fact drawn as something happening — the
 * chat scrolling past under a scanner sweeping down it.
 *
 * Two identical columns roll upward and the loop resets at exactly one
 * column's height, so the seam never lands anywhere the eye can find it. The
 * column carries its own bottom padding rather than the roller carrying a gap,
 * because half a gap is precisely the offset that makes a seamless loop jump.
 *
 * The sweep lifts what it passes over rather than laying a colour on top —
 * `screen` against the bubbles, inside an isolated stacking context so it
 * blends with the film and not with the sheet behind it.
 *
 * Shared between the onboarding's reading step and the deck's wall, where the
 * paid report is written: both are a minute of real work the reader cannot
 * see, and the film is the same promise both times — the chat is being read,
 * here, now. It carries its own dark ground, so it sits on parchment and on
 * forest green alike.
 */
export function ScanFilm({
  height = 'clamp(128px, 20vh, 168px)',
  marginTop = 22,
}: {
  /**
   * Gives way on a short screen rather than pushing whatever follows under the
   * fold — a line that says what is happening and cannot be seen is worse than
   * one bubble less.
   */
  height?: string;
  marginTop?: number;
}) {
  const fade = 'linear-gradient(180deg,transparent 0,#000 13%,#000 87%,transparent 100%)';

  const column = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 9 }}>
      {SCAN_ROWS.map((row, k) => (
        <div
          key={k}
          style={{
            alignSelf: row.mine ? 'flex-end' : 'flex-start',
            width: `${row.width}%`,
            background: row.mine ? '#005C4B' : '#202C33',
            borderRadius: row.mine ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
            padding: '8px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {row.lines.map((line, i) => (
            <div
              key={i}
              style={{
                height: 5,
                width: `${line}%`,
                borderRadius: 3,
                background: 'rgba(233,237,239,.22)',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className="yap-loop"
      style={{
        position: 'relative',
        height,
        marginTop,
        borderRadius: 18,
        overflow: 'hidden',
        background: '#0B141A',
        isolation: 'isolate',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.07)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '0 14px',
          maskImage: fade,
          WebkitMaskImage: fade,
        }}
      >
        {/* Held to a column narrow enough that a bubble sitting on the right
            is visibly on the right. Run to the full width of the sheet, the
            same bubbles read as bars on a loading screen rather than as a
            conversation going past. */}
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <div style={{ animation: 'obScanRoll 15s linear infinite' }}>
            {column}
            {column}
          </div>
        </div>
      </div>

      {/* Starts hidden in its own style as well as in its keyframes, so with
          animations off it is absent rather than parked halfway down the film. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 88,
          opacity: 0,
          mixBlendMode: 'screen',
          backgroundImage: [
            'repeating-linear-gradient(180deg,rgba(201,242,77,.16) 0 1px,transparent 1px 4px)',
            'linear-gradient(180deg,rgba(201,242,77,0) 0%,rgba(201,242,77,.16) 62%,rgba(201,242,77,.42) 94%,rgba(201,242,77,0) 100%)',
          ].join(','),
          animation: 'obScanBand 2.6s linear infinite',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            background: '#C9F24D',
            boxShadow: '0 0 16px 3px rgba(201,242,77,.5)',
          }}
        />
      </div>
    </div>
  );
}
