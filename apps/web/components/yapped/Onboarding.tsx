'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Briefcase,
  CircleQuestionMark,
  Heart,
  HeartHandshake,
  House,
  PencilLine,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { ChatStats, ExportFormat, MergeSuggestion, RosterEntry } from '@wrapped/core';
import {
  CHAT_KINDS,
  GROUP_SLOTS,
  LANGUAGES,
  NOTES_LIMIT,
  type Brief,
  type GroupSlot,
  type KindIcon,
  type ReportLanguage,
} from '@/lib/brief';
import { formatNumber } from '@/lib/format';
import type { AnalyzerState } from '@/lib/useAnalyzer';
import { localise, type CopyKey } from '@/lib/copy';
import { AnimalFace } from '../cards/AnimalFace';
import { GROUP_SLOT_BACKDROP, photoLayers } from '../cards/photos';
import { LINE_GREEN, LineMark, WhatsAppMark } from './Sources';
import { BACKDROPS } from '../cards/Shell';

/**
 * Briefing Reg.
 *
 * The old flow was a modal: get the file, watch it read, play. It asked nothing,
 * which meant Reg wrote every report the same way and guessed at the two things
 * only the reader knows — what language the report should be in, and what kind
 * of chat this actually is. This is the flow the design draws instead: three
 * questions, the export, and then the two things that can only be asked once the
 * file has been read — who is who, and what everyone looks like.
 *
 * It takes the page rather than floating above it. A modal is a detour from
 * whatever you were reading; this is the thing you came to do, and eight steps
 * inside a 620px sheet is a scroll bar wrapped around a decision.
 *
 * Which panel shows is derived from the analyzer wherever the analyzer knows —
 * the same rule the modal followed, for the same reason: two sources for "what
 * is happening" drift apart, and the one that drifts is always the one on screen.
 */

const STEPS = ['lang', 'kind', 'notes', 'upload', 'scan', 'people', 'photos', 'done'] as const;
type Step = (typeof STEPS)[number];

/** The last step is the summary, not a question — the bar counts the other seven. */
const COUNTED_STEPS = 7;

/**
 * The floor under the reading step.
 *
 * A 900-message export parses in about a fifth of a second, which puts a
 * counter, a progress bar, a film of the chat being scanned and six lines of
 * checklist on screen for four frames — the reader sees a flicker and arrives
 * at the next question with no sense that anything was read. So the panel is
 * given a minimum time on screen and everything in it moves at the slower of
 * real progress and that floor.
 *
 * Nothing here invents progress the parse has not made: the bar is still
 * `min(work, time)`, so a large export is never held back by a single
 * millisecond, and the step ends the moment both the work and the floor are
 * done with.
 */
const SCAN_FLOOR_MS = 4200;

/**
 * The end of that, kept back so it can be seen.
 *
 * The counter landing on the real total and the line under it turning from
 * "and counting…" to "All of them" is the whole point of the step, and paced
 * to the last millisecond of the floor it is painted in the same frame the
 * step is left on — which is to say never. So the numbers finish early and the
 * finished panel is held for a beat before the next question.
 *
 * Only the floor is shortened, not the wait: an export slow enough to be
 * running the pace itself still moves on the moment it is read.
 */
const SCAN_SETTLE_MS = 700;

/** Parsing owns the first 55% of the worker's bar — see `analyze.worker.ts`,
    which stops there and hands the roster back. The reading step covers
    exactly that stretch, so its own 0→1 is the worker's 0→0.55. */
const ROSTER_AT = 0.55;

const HINTS: CopyKey[] = ['ob.notes.hint1', 'ob.notes.hint2', 'ob.notes.hint3'];

/**
 * The design draws these cards with abstract marks — a half-circle, a diamond,
 * a triangle. At poster size in a static frame they read as a set; at 26px on a
 * card the reader has to work out which shape means "family", which is a puzzle
 * nobody came here to solve. Line icons say the same thing at a glance and
 * still sit in the editorial register — flat, stroked, no fill.
 */
const KIND_ICONS: Record<KindIcon, LucideIcon> = {
  partner: Heart,
  bestFriend: HeartHandshake,
  friends: UsersRound,
  family: House,
  work: Briefcase,
  other: CircleQuestionMark,
};

/**
 * Where the file comes from.
 *
 * Two apps, two menus, and nothing in common between the routes through them.
 * Showing both sets at once is how you get a reader following step 2 of the
 * wrong list, so the step is asked which app first and only ever shows one.
 */
export type ChatSource = 'whatsapp' | 'line';

const EXPORT_STEPS: Record<ChatSource, { n: string; title: CopyKey; note: CopyKey }[]> = {
  whatsapp: [
    { n: '01', title: 'ob.upload.wa1', note: 'ob.upload.wa1n' },
    { n: '02', title: 'ob.upload.wa2', note: 'ob.upload.wa2n' },
    { n: '03', title: 'ob.upload.wa3', note: 'ob.upload.wa3n' },
  ],
  line: [
    { n: '01', title: 'ob.upload.line1', note: 'ob.upload.line1n' },
    { n: '02', title: 'ob.upload.line2', note: 'ob.upload.line2n' },
    { n: '03', title: 'ob.upload.line3', note: 'ob.upload.line3n' },
  ],
};

/** Mirrors the deck's grounds, so a face picked here sits on the colour it will
    later be seen against rather than on a neutral chip. */
const PALETTE: [string, string][] = [
  ['#C9F24D', '#10130E'],
  ['#FF4FA3', '#180410'],
  ['#4B1BD1', '#F1ECFF'],
  ['#FF6B1A', '#1A0A00'],
  ['#16E0C8', '#04211D'],
  ['#1D3A2A', '#F6EFE4'],
  ['#F5B324', '#221600'],
  ['#121A3A', '#E7EBFF'],
];

/**
 * The four slides that take a photo, drawn at thumbnail size.
 *
 * Grounds and captions come from the deck's own palette — these tiles are a
 * promise about what the story will look like, and the grading is imported
 * rather than restated so the promise cannot quietly stop being true.
 */
const GROUP_SLIDES: { slot: GroupSlot; label: string; caption: CopyKey }[] = [
  { slot: 'opener', label: '01', caption: 'ob.photos.slotOpener' },
  { slot: 'chaos', label: '08', caption: 'ob.photos.slotChaos' },
  { slot: 'verdict', label: '15', caption: 'ob.photos.slotVerdict' },
  { slot: 'paywall', label: '16', caption: 'ob.photos.slotPaywall' },
];

const mono = (extra?: CSSProperties): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 11,
  color: '#8A7B63',
  ...extra,
});

const eyebrow: CSSProperties = mono({
  fontSize: 11,
  letterSpacing: '.18em',
  textTransform: 'uppercase',
});

const question: CSSProperties = {
  fontFamily: 'var(--yap-serif)',
  fontWeight: 400,
  fontSize: 'clamp(34px, 6vw, 52px)',
  lineHeight: 1.02,
  margin: '10px 0 0',
  textWrap: 'pretty',
};

const lede: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.55,
  color: '#5E5344',
  margin: '12px 0 0',
  maxWidth: '48ch',
};

const optionalPill: CSSProperties = mono({
  fontSize: 10,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  background: '#EFE3CE',
  borderRadius: 999,
  padding: '3px 9px',
});

const panel: CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #E3D5BE',
  borderRadius: 20,
  padding: 18,
};

/**
 * `YYYY-MM-DD` → `Aug 2016`, in the language the report is being written in.
 *
 * Built from the string rather than from a `Date` for the same reason as
 * everywhere else in this codebase — a date parsed out of a day string picks up
 * the runtime's timezone and can land in the previous month — but the month
 * *name* has to come from somewhere, and a hardcoded English array left the one
 * English word in an otherwise Hebrew row.
 */
function monthLabel(day: string, locale: string): string {
  const [year, month] = day.split('-');
  const index = Number(month) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return year ?? '';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(year), index, 1)));
}

/**
 * The export, demonstrated rather than described.
 *
 * Three sentences of instructions are three sentences nobody reads; a phone
 * opening its own menu and producing a file is the same information in a shape
 * that survives being glanced at. It carries `yap-loop` so reduced-motion
 * freezes it on its inline state — menu open, file showing — instead of on
 * whatever frame the loop was cut at.
 */
function ExportPhone() {
  const row = (width: string, right: boolean, height: number): CSSProperties => ({
    alignSelf: right ? 'flex-end' : 'flex-start',
    width,
    height,
    borderRadius: right ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
    background: right ? 'rgba(201,242,77,.22)' : 'rgba(255,255,255,.08)',
  });

  const menuItem: CSSProperties = {
    padding: '11px 13px',
    borderRadius: 10,
    background: 'rgba(255,255,255,.06)',
    color: '#EFEFE6',
  };

  return (
    <div className="yap-loop" style={{ animation: 'yapFloat 7s ease-in-out infinite' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 280,
          maxWidth: '100%',
          padding: 9,
          borderRadius: 38,
          background: '#20221E',
          boxShadow: '0 24px 50px rgba(30,20,8,.28),inset 0 0 0 2px #3A3C36',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 452,
            borderRadius: 31,
            overflow: 'hidden',
            background: '#10130E',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '14px 16px 8px',
              ...mono({ fontSize: 9, color: 'rgba(255,255,255,.6)' }),
            }}
          >
            <span>9:41</span>
            <span>WhatsApp</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 14px 12px',
              borderBottom: '1px solid rgba(255,255,255,.09)',
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 999, background: '#2E4A38' }} />
            <div style={{ flex: 1 }}>
              <div
                style={{ height: 9, width: 74, borderRadius: 3, background: 'rgba(255,255,255,.28)' }}
              />
              <div
                style={{
                  height: 6,
                  width: 44,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,.14)',
                  marginTop: 5,
                }}
              />
            </div>
            <div
              style={{
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                width: 26,
                height: 26,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[0, 1, 2].map((k) => (
                  <div
                    key={k}
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 9,
                      background: 'rgba(255,255,255,.7)',
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: 'rgba(201,242,77,.55)',
                  animation: 'obPhoneA 6s ease-in-out infinite',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 14 }}>
            <div style={row('64%', false, 30)} />
            <div style={row('52%', true, 24)} />
            <div style={row('44%', false, 24)} />
            <div style={row('68%', true, 30)} />
          </div>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: '#1B1E19',
              borderRadius: '20px 20px 0 0',
              padding: 14,
              animation: 'obSheet 6s ease-in-out infinite',
            }}
          >
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 3,
                background: 'rgba(255,255,255,.25)',
                margin: '0 auto 14px',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                fontFamily: 'var(--yap-sans)',
                fontSize: 12,
              }}
            >
              <div style={menuItem}>Group info</div>
              <div style={menuItem}>Search</div>
              <div style={{ ...menuItem, animation: 'obHi 6s ease-in-out infinite' }}>
                Export chat
              </div>
              <div style={menuItem}>Clear chat</div>
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: '#C9F24D',
                color: '#10130E',
                borderRadius: 12,
                padding: '10px 12px',
                animation: 'obFile 6s ease-in-out infinite',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 26,
                  borderRadius: 4,
                  background: '#10130E',
                  color: '#C9F24D',
                  display: 'grid',
                  placeItems: 'center',
                  ...mono({ fontSize: 7, color: '#C9F24D' }),
                }}
              >
                TXT
              </div>
              <div style={mono({ fontSize: 10, color: '#10130E', lineHeight: 1.3 })}>
                _chat.txt
                <br />
                <span style={{ opacity: 0.6 }}>Without media</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LINE's route to the same file, drawn still.
 *
 * The WhatsApp phone above it is a film because the menu it wants is hidden
 * three taps deep and the animation is the instruction. LINE's is one sheet
 * with the item written on it, so a still says everything a loop would and
 * says it in the app's own light chrome — a reader who opens LINE and sees a
 * dark WhatsApp screen has been told, wrongly, that they are in the wrong place.
 */
function LinePhone() {
  const row: CSSProperties = {
    padding: '11px 13px',
    borderRadius: 10,
    background: '#F4F4F2',
    color: '#22231F',
  };

  return (
    <div aria-hidden="true">
      <div
        style={{
          position: 'relative',
          width: 280,
          maxWidth: '100%',
          padding: 9,
          borderRadius: 38,
          background: '#20221E',
          boxShadow: '0 24px 50px rgba(30,20,8,.28),inset 0 0 0 2px #3A3C36',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 452,
            borderRadius: 31,
            overflow: 'hidden',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '14px 16px 8px',
              ...mono({ fontSize: 9, color: 'rgba(0,0,0,.45)' }),
            }}
          >
            <span>9:41</span>
            <span>LINE</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 14px 12px',
              borderBottom: '1px solid rgba(0,0,0,.08)',
            }}
          >
            <LineMark size={26} />
            <div style={{ flex: 1, fontFamily: 'var(--yap-sans)', fontWeight: 700, fontSize: 12 }}>
              ピザ会
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} style={{ width: 14, height: 2, borderRadius: 2, background: '#5B5D57' }} />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, padding: 14 }}>
            <div
              style={{
                alignSelf: 'flex-start',
                width: '62%',
                height: 28,
                borderRadius: '4px 14px 14px 14px',
                background: '#F0F0EE',
              }}
            />
            <div
              style={{
                alignSelf: 'flex-end',
                width: '54%',
                height: 24,
                borderRadius: '14px 4px 14px 14px',
                background: '#8DE05B',
              }}
            />
            <div
              style={{
                alignSelf: 'flex-start',
                width: '44%',
                height: 24,
                borderRadius: '4px 14px 14px 14px',
                background: '#F0F0EE',
              }}
            />
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px 20px 0 0',
              padding: 14,
              boxShadow: '0 -10px 30px rgba(0,0,0,.12)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 3,
                background: 'rgba(0,0,0,.15)',
                margin: '0 auto 14px',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                fontFamily: 'var(--yap-sans)',
                fontSize: 12,
              }}
            >
              <div style={row}>Albums</div>
              <div style={row}>Notes</div>
              <div
                style={{
                  ...row,
                  background: LINE_GREEN,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(6,199,85,.35)',
                }}
              >
                Export chat history
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: '#F6EFE4',
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 26,
                  borderRadius: 4,
                  background: '#10130E',
                  display: 'grid',
                  placeItems: 'center',
                  ...mono({ fontSize: 7, color: '#C9F24D' }),
                }}
              >
                TXT
              </div>
              <div style={mono({ fontSize: 10, color: '#10130E', lineHeight: 1.3 })}>
                [LINE] chat.txt
                <br />
                <span style={{ opacity: 0.6 }}>Text only, always</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
 * blends with the film and not with the beige sheet behind it.
 */
function ScanFilm() {
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
        /* Gives way on a short screen rather than pushing the checklist under
           the fold — this step has no footer to scroll to, so a line that says
           what is happening and cannot be seen is worse than one bubble less. */
        height: 'clamp(128px, 20vh, 168px)',
        marginTop: 22,
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

export function Onboarding({
  state,
  brief,
  onBrief,
  onPick,
  onNames,
  onPlay,
  onClose,
  error,
  stats,
  freeCount,
}: {
  state: AnalyzerState;
  brief: Brief;
  onBrief: (patch: Partial<Brief>) => void;
  onPick: (file: File) => void;
  onNames: (aliases: Record<string, string>) => void;
  onPlay: () => void;
  onClose: () => void;
  error: string | null;
  stats: ChatStats | null;
  freeCount: number;
}) {
  /* Everything after the language card is written in the language the card
     chose. `localise` is called rather than `useCopy` because this sheet lives
     outside the deck's provider — the deck does not exist yet. */
  const copy = useMemo(() => localise(brief.language), [brief.language]);
  const t = copy.t;

  const [step, setStep] = useState<Step>('lang');
  const [dragging, setDragging] = useState(false);
  /* Which app's instructions the export step is showing. It steers the
     copy and nothing else — the parser recognises either file itself. */
  const [source, setSource] = useState<ChatSource>('whatsapp');

  /* Milliseconds the reading step has been on screen, and the count it is
     currently willing to show — see SCAN_FLOOR_MS. */
  const [elapsed, setElapsed] = useState(0);
  const shownCount = useRef(0);

  /* The roster is copied out of the analyzer the moment it arrives, because
     answering the question moves the analyzer on and takes the question's own
     data with it — the photos step still needs to know who is in this chat. */
  const [rows, setRows] = useState<RosterEntry[]>([]);
  /* Which app actually wrote the file, taken off the parse. Copied out for the
     same reason the roster is: the analyzer has moved on by the time the
     question is answered. */
  const [readFrom, setReadFrom] = useState<ExportFormat>('android');
  const [merges, setMerges] = useState<(MergeSuggestion & { verdict: 'open' | 'merged' | 'kept' })[]>(
    [],
  );
  const [renames, setRenames] = useState<Record<string, string>>({});
  /* Keyed by the name the export used, not the name on screen. Going back a step
     and fixing a spelling must not orphan the face that was already picked. */
  const [faces, setFaces] = useState<Record<string, string>>({});

  const fileInput = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const index = STEPS.indexOf(step);

  /* `brief.kind` stays the English name — it is sent to the model as context
     and the prompts are written around those six words. Only the label the
     reader sees is translated. */
  const kindLabel = brief.kind
    ? t(`kind.${CHAT_KINDS.find((k) => k.name === brief.kind)?.icon ?? 'other'}` as CopyKey)
    : t('kind.friends');

  /* ── Derived roster ─────────────────────────────────────────────────────
     A merged row disappears from the list, and its messages are added to the
     row it went into — otherwise "Merge" visibly does nothing, which is the
     one thing a merge button must not do. */
  const mergedAway = useMemo(
    () => new Set(merges.filter((m) => m.verdict === 'merged').map((m) => m.from)),
    [merges],
  );

  const nameOf = useCallback(
    (row: RosterEntry) => (renames[row.name] ?? '').trim() || row.name,
    [renames],
  );

  const people = useMemo(() => {
    const absorbed = new Map<string, number>();
    for (const merge of merges) {
      if (merge.verdict !== 'merged') continue;
      const from = rows.find((r) => r.name === merge.from);
      absorbed.set(merge.into, (absorbed.get(merge.into) ?? 0) + (from?.messages ?? 0));
    }
    return rows
      .filter((row) => !mergedAway.has(row.name))
      .map((row) => ({ ...row, messages: row.messages + (absorbed.get(row.name) ?? 0) }))
      .sort((a, b) => b.messages - a.messages);
  }, [rows, merges, mergedAway]);

  const openMerges = merges.filter((m) => m.verdict === 'open');
  const unnamed = people.filter((p) => p.unsaved && !(renames[p.name] ?? '').trim());

  /* ── Flow ───────────────────────────────────────────────────────────────
     The analyzer moves the three steps it owns. Everything else is the reader
     pressing Continue. */
  useEffect(() => {
    if (state.phase === 'working' && step === 'upload') setStep('scan');
    if (state.phase === 'error' && (step === 'scan' || step === 'upload')) setStep('upload');
  }, [state.phase, step]);

  /* Leaving the reading step is the one move that waits — for the floor under
     it as well as for the worker. Kept apart from the flow above so that a
     file that cannot be read still bounces straight back to the drop zone
     instead of sitting under four seconds of pretend scanning first. */
  useEffect(() => {
    if (state.phase === 'roster' && step === 'scan' && elapsed >= SCAN_FLOOR_MS) setStep('people');
  }, [state.phase, step, elapsed]);

  /* Ticked by an interval rather than a frame loop: a hidden tab stops
     painting frames altogether, which would strand the reader behind a floor
     that had quietly stopped counting. Intervals keep firing, and the elapsed
     time is measured rather than accumulated, so one tick after coming back is
     enough to settle it. */
  useEffect(() => {
    if (step !== 'scan') return;
    const start = performance.now();
    shownCount.current = 0;
    setElapsed(0);
    const id = setInterval(() => setElapsed(performance.now() - start), 33);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (state.phase !== 'roster') return;
    setRows(state.people);
    setReadFrom(state.format);
    setMerges(state.merges.map((m) => ({ ...m, verdict: 'open' as const })));
  }, [state]);

  // Every panel is a new screenful of copy; leaving the scroll where the last
  // one ended puts the reader halfway down the next question. The sheet is the
  // scroller, not the window, so it is the one that has to be sent back to the
  // top.
  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [step]);

  // The page behind the sheet is still a scroller, and a fixed panel over a
  // scrollable page is how you end up with two bars down the right-hand side.
  useEffect(() => {
    document.body.classList.add('yap-locked');
    return () => document.body.classList.remove('yap-locked');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Published upwards keyed by the name the deck will use, so a rename made
     after a photo was chosen still lands on the right face. */
  useEffect(() => {
    const byDisplayName: Record<string, string> = {};
    for (const row of people) {
      const url = faces[row.name];
      if (url) byDisplayName[nameOf(row)] = url;
    }
    onBrief({ photos: byDisplayName });
    // `onBrief` is a setter from the parent and stable; `people`/`faces` are
    // the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, faces, nameOf]);

  const pickFile = (file: File | undefined) => {
    if (file) onPick(file);
  };

  /* Each photo tile owns its own input, wrapped in a label.
     One shared input plus a "which tile did they click" ref would be fewer
     elements, but it needs a programmatic `.click()` to open the picker — and
     the browser only honours that inside a trusted gesture, which makes the
     whole thing conditional on how the tile was activated. A label is the
     platform's own answer: keyboard, pointer and assistive tech all reach it,
     and there is no state to keep in sync with the pointer. */
  const hiddenInput: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  };

  const setFace = (original: string, file: File | undefined) => {
    if (!file) return;
    setFaces((prev) => {
      const previous = prev[original];
      if (previous) URL.revokeObjectURL(previous);
      return { ...prev, [original]: URL.createObjectURL(file) };
    });
  };

  const setGroupPhoto = (slot: GroupSlot, file: File | undefined) => {
    if (!file) return;
    const previous = brief.groupPhotos[slot];
    if (previous) URL.revokeObjectURL(previous);
    onBrief({ groupPhotos: { ...brief.groupPhotos, [slot]: URL.createObjectURL(file) } });
  };

  const resolveMerge = (from: string, verdict: 'merged' | 'kept') =>
    setMerges((prev) => prev.map((m) => (m.from === from ? { ...m, verdict } : m)));

  /**
   * Everything the reader changed, as one alias map. Renames and merges are the
   * same edit here — a merge is two names pointing at one — which is why the
   * worker needs no separate notion of merging.
   */
  const submitNames = () => {
    const aliases: Record<string, string> = {};
    for (const row of rows) {
      const typed = (renames[row.name] ?? '').trim();
      if (typed && typed !== row.name) aliases[row.name] = typed;
    }
    for (const merge of merges) {
      if (merge.verdict !== 'merged') continue;
      const into = rows.find((r) => r.name === merge.into);
      aliases[merge.from] = into ? nameOf(into) : merge.into;
    }
    onNames(aliases);
    setStep('photos');
  };

  const next = () => {
    if (step === 'people') return submitNames();
    setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!);
  };

  const back = () => {
    // Scan is not a place you can go back to — it is work that already happened.
    const target = step === 'people' ? 'upload' : STEPS[Math.max(0, index - 1)]!;
    setStep(target);
  };

  /* The counting that happens after the naming step can fail on a screen with
     no progress bar and no footer, so the last step has to be able to say so. */
  const failed = state.phase === 'error';

  const ready =
    step === 'lang'
      ? true
      : step === 'kind'
        ? brief.kind !== ''
        : step === 'upload'
          ? false
          : step === 'done'
            ? stats !== null || failed
            : true;

  const nextLabel =
    step === 'upload'
      ? t('ob.waiting')
      : step === 'people'
        ? t('ob.namesOk')
        : step === 'photos'
          ? t('ob.photosDone')
          : t('ob.continue');

  const trail =
    step === 'lang'
      ? 'Three quick questions, then the export.'
      : step === 'kind'
        ? (LANGUAGES.find((l) => l.code === brief.language)?.name ?? '')
        : step === 'notes'
          ? t('ob.trail.notes', { kind: kindLabel })
          : step === 'upload'
            ? t('ob.trail.upload')
            : step === 'people'
              ? t('ob.trail.people', {
                  merges: openMerges.length,
                  unnamed: unnamed.length,
                })
              : step === 'photos'
                ? t('ob.trail.photos', {
                    people: people.length,
                    faces: Object.keys(faces).length,
                  })
                : '';

  const counted =
    state.phase === 'working' || state.phase === 'roster'
      ? state.messages
      : (stats?.totalMessages ?? 0);

  /* How far the worker actually is through the stretch this step covers, and
     how much of that the floor is prepared to have shown yet. */
  const scanWork = state.phase === 'working' ? Math.min(1, state.fraction / ROSTER_AT) : 1;
  const scanShown = Math.min(scanWork, elapsed / (SCAN_FLOOR_MS - SCAN_SETTLE_MS), 1);

  /* The count, held to the same pace — and only ever allowed upward. The real
     figure arrives in two jumps of very different sizes (running totals while
     parsing, then the true total with the roster), and scaling the second one
     back down to where the floor has got to would take thousands of messages
     off a number the reader has already watched climb. */
  /* Held down to the real count as well as up to itself: the step is set to
     `scan` one render before the effect that clears the last file's total, and
     that render would otherwise show the old number under a bar back at zero. */
  shownCount.current = Math.min(
    counted,
    Math.max(shownCount.current, scanWork > 0 ? Math.round(counted * (scanShown / scanWork)) : 0),
  );
  const scanCount = shownCount.current;

  /* `at` is where each line sits on this step's own 0→1. The last three
     happen after the naming step; they are on the list so the reader can see
     what is still to come, and they stay unticked here because they have not
     happened yet. */
  const scanLines: { text: string; value: string; at: number }[] = [
    { text: t('ob.scan.open'), value: t('ob.scan.local'), at: 0 },
    { text: t('ob.scan.read'), value: formatNumber(scanCount, 'en'), at: 0.05 },
    {
      text: t('ob.scan.sort'),
      value: rows.length ? t('ob.scan.peopleValue', { n: rows.length }) : '—',
      at: 0.55,
    },
    { text: t('ob.scan.emoji'), value: '', at: Infinity },
    { text: t('ob.scan.moments'), value: '', at: Infinity },
    { text: t('ob.scan.write'), value: '', at: Infinity },
  ];
  const scanAt = scanLines.reduce((last, line, k) => (scanShown >= line.at ? k : last), 0);

  return (
    <div
      ref={sheet}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        overflowY: 'auto',
        background: '#F3EADA',
        color: '#15251C',
        fontFamily: 'var(--yap-sans)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
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
          background: 'rgba(250,245,236,.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #E0D2BB',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reg.png"
            alt=""
            style={{ width: 30, height: 30, borderRadius: 999, display: 'block' }}
          />
          <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 21 }}>Yapped</div>
          <div
            style={mono({
              fontSize: 10,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              paddingTop: 3,
            })}
          >
            {t('ob.header')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
            {Array.from({ length: COUNTED_STEPS }, (_, k) => (
              <div
                key={k}
                style={{
                  width: 26,
                  height: 4,
                  borderRadius: 2,
                  background: k <= index ? '#1D3A2A' : '#EADFCB',
                  transition: 'background .3s ease',
                }}
              />
            ))}
          </div>
          <div style={mono({ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' })}>
            {step === 'scan'
              ? t('ob.reading')
              : t('ob.step', { n: Math.min(index + 1, COUNTED_STEPS) })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ob.leave')}
            style={{
              border: '1px solid #E0D2BB',
              background: '#FFFDF8',
              cursor: 'pointer',
              width: 30,
              height: 30,
              borderRadius: 999,
              color: '#5E5344',
              fontSize: 14,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '44px 24px 70px' }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          {/* ── 1 · Language ─────────────────────────────────────────────── */}
          {step === 'lang' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>Question 1 of 3</div>
              <h1 style={question}>Which language should Reg write in?</h1>
              <p style={lede}>
                Your chat can be in any language — this is just the language of the report Reg
                writes about it.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                  gap: 12,
                  marginTop: 26,
                }}
              >
                {LANGUAGES.map((language) => {
                  const on = brief.language === language.code;
                  return (
                    <button
                      key={language.code}
                      type="button"
                      onClick={() => onBrief({ language: language.code as ReportLanguage })}
                      aria-pressed={on}
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${on ? '#1D3A2A' : '#E3D5BE'}`,
                        background: on ? '#FFFDF8' : '#FBF6EC',
                        color: '#15251C',
                        borderRadius: 18,
                        padding: '18px 18px 16px',
                        transition: 'all .18s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div
                          dir="auto"
                          style={{ fontFamily: 'var(--yap-serif)', fontSize: 26, lineHeight: 1 }}
                        >
                          {language.name}
                        </div>
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            border: `1.5px solid ${on ? '#1D3A2A' : '#CDB994'}`,
                            background: on ? '#1D3A2A' : 'transparent',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                            color: '#F6EFE4',
                          }}
                        >
                          {on ? '✓' : ''}
                        </div>
                      </div>
                      <div style={mono({ fontSize: 10.5, letterSpacing: '.08em', marginTop: 8 })}>
                        {language.note}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={mono({ marginTop: 14 })}>
                Arabic is next on Reg&apos;s desk. Ask for yours and he&apos;ll move it up.
              </div>
            </div>
          )}

          {/* ── 2 · Kind ─────────────────────────────────────────────────── */}
          {step === 'kind' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>{t('ob.kind.q')}</div>
              <h1 style={question}>{t('ob.kind.title')}</h1>
              <p style={lede}>{t('ob.kind.lede')}</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 12,
                  marginTop: 26,
                }}
              >
                {CHAT_KINDS.map((kind) => {
                  const on = brief.kind === kind.name;
                  const Icon = KIND_ICONS[kind.icon];
                  return (
                    <button
                      key={kind.name}
                      type="button"
                      onClick={() => onBrief({ kind: kind.name })}
                      aria-pressed={on}
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${on ? '#1D3A2A' : '#E3D5BE'}`,
                        background: on ? '#1D3A2A' : '#FFFDF8',
                        color: on ? '#F6EFE4' : '#15251C',
                        borderRadius: 18,
                        padding: 16,
                        transition: 'all .18s ease',
                      }}
                    >
                      <Icon
                        size={26}
                        strokeWidth={1.6}
                        aria-hidden="true"
                        // The ember is the landing page's own accent, and it is
                        // the one thing on an unselected card that is not text.
                        color={on ? '#C9F24D' : '#C2571F'}
                      />
                      <div style={{ fontWeight: 500, fontSize: 16, marginTop: 10 }}>
                        {t(`kind.${kind.icon}` as CopyKey)}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.4,
                          color: on ? '#C9C0AE' : '#5E5344',
                          marginTop: 4,
                        }}
                      >
                        {t(`kind.${kind.icon}.note` as CopyKey)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3 · Notes ────────────────────────────────────────────────── */}
          {step === 'notes' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={eyebrow}>{t('ob.notes.q')}</div>
                <div style={optionalPill}>{t('ob.optional')}</div>
              </div>
              <h1 style={question}>{t('ob.notes.title')}</h1>
              <p style={{ ...lede, maxWidth: '50ch' }}>{t('ob.notes.lede')}</p>
              <div
                style={{
                  ...panel,
                  marginTop: 22,
                  padding: 16,
                  boxShadow: '0 14px 34px rgba(40,28,12,.07)',
                }}
              >
                <textarea
                  dir="auto"
                  value={brief.notes}
                  onChange={(e) => onBrief({ notes: e.target.value.slice(0, NOTES_LIMIT) })}
                  placeholder={t('ob.notes.placeholder')}
                  aria-label={t('ob.notes.title')}
                  style={{
                    width: '100%',
                    minHeight: 150,
                    resize: 'vertical',
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 15.5,
                    lineHeight: 1.6,
                    color: '#15251C',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    borderTop: '1px solid #EFE3CE',
                    paddingTop: 12,
                    marginTop: 6,
                  }}
                >
                  <div style={mono({ fontSize: 10.5 })}>
                    {brief.notes.length} / {NOTES_LIMIT}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {HINTS.map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        onClick={() =>
                          onBrief({
                            notes: `${brief.notes ? `${brief.notes.replace(/\s*$/, '')} ` : ''}${t(hint)}: `.slice(
                              0,
                              NOTES_LIMIT,
                            ),
                          })
                        }
                        style={{
                          cursor: 'pointer',
                          border: '1px solid #E3D5BE',
                          background: '#F6EFE4',
                          borderRadius: 999,
                          padding: '6px 10px',
                          ...mono({ fontSize: 10.5, color: '#5E5344' }),
                        }}
                      >
                        {t(hint)} →
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={mono({ marginTop: 12, lineHeight: 1.5 })}>{t('ob.notes.privacy')}</div>
            </div>
          )}

          {/* ── 4 · Upload ───────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>{t('ob.upload.eyebrow')}</div>
              <h1 style={question}>{t('ob.upload.title')}</h1>

              {/* Which app, asked before the steps rather than after them. Reg
                  reads either file and works out which is which on his own, so
                  this changes nothing about the parse — it only decides which
                  set of instructions the reader is looking at. */}
              <div
                role="group"
                aria-label={t('ob.upload.which')}
                style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}
              >
                {(
                  [
                    ['whatsapp', 'WhatsApp', <WhatsAppMark key="w" size={20} />],
                    ['line', 'LINE', <LineMark key="l" size={20} />],
                  ] as const
                ).map(([value, label, mark]) => {
                  const on = source === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSource(value)}
                      aria-pressed={on}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        cursor: 'pointer',
                        border: `1.5px solid ${on ? '#1D3A2A' : '#E3D5BE'}`,
                        background: on ? '#FFFDF8' : 'transparent',
                        color: '#15251C',
                        borderRadius: 999,
                        padding: '9px 16px 9px 11px',
                        fontFamily: 'var(--yap-sans)',
                        fontSize: 14,
                        fontWeight: on ? 700 : 400,
                        transition: 'all .16s ease',
                      }}
                    >
                      {mark}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="yap-export" style={{ marginTop: 20 }}>
                {source === 'line' ? <LinePhone /> : <ExportPhone />}

                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {EXPORT_STEPS[source].map((exportStep) => (
                      <div
                        key={exportStep.n}
                        style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--yap-poster)',
                            fontSize: 20,
                            color: '#C2571F',
                            minWidth: 24,
                          }}
                        >
                          {exportStep.n}
                        </div>
                        <div>
                          <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.35 }}>
                            {t(exportStep.title)}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.45,
                              color: '#5E5344',
                              marginTop: 3,
                            }}
                          >
                            {t(exportStep.note)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <input
                    ref={fileInput}
                    type="file"
                    accept=".txt,.zip,text/plain,application/zip"
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                    onChange={(e) => {
                      pickFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <div
                    className="yap-drop"
                    data-dragging={dragging}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      pickFile(e.dataTransfer.files[0]);
                    }}
                    style={{
                      marginTop: 20,
                      border: '1.5px dashed #CDB994',
                      borderRadius: 18,
                      padding: '26px 20px',
                      textAlign: 'center',
                      background: 'linear-gradient(180deg,#FBF6EC,#F5EDDF)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 25, lineHeight: 1.15 }}>
                      {(() => {
                        const [before = '', after = ''] = t('ob.upload.drop').split('{file}');
                        return (
                          <>
                            {before}
                            <span style={{ fontFamily: 'var(--yap-mono)', fontSize: 15 }}>
                              {source === 'line' ? '[LINE] chat.txt' : '_chat.txt'}
                            </span>
                            {after}
                          </>
                        );
                      })()}
                    </div>
                    <div style={mono({ fontSize: 10.5, marginTop: 7 })}>
                      {t('ob.upload.browse')}
                    </div>
                  </div>

                  {error && (
                    <p
                      role="alert"
                      style={{
                        margin: '12px 0 0',
                        background: '#F7E3DA',
                        border: '1px solid #E4BFAC',
                        color: '#8C3410',
                        borderRadius: 14,
                        padding: '12px 14px',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <div
                    style={{ fontSize: 12.5, color: '#8A7B63', marginTop: 10, lineHeight: 1.5 }}
                  >
                    {t(source === 'line' ? 'ob.upload.lineHint' : 'ob.upload.waHint')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 5 · Scan ─────────────────────────────────────────────────── */}
          {step === 'scan' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '2.5px solid #E3D5BE',
                    borderTopColor: '#1D3A2A',
                    animation: 'obSpin .8s linear infinite',
                  }}
                />
                <div style={eyebrow}>{t('ob.scan.eyebrow')}</div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--yap-poster)',
                  fontSize: 'clamp(56px, 14vw, 96px)',
                  lineHeight: 0.9,
                  letterSpacing: '-.02em',
                  marginTop: 16,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(scanCount, 'en')}
              </div>
              <div
                style={{ fontFamily: 'var(--yap-serif)', fontSize: 30, lineHeight: 1.1, marginTop: 2 }}
              >
                {scanShown >= 1 ? t('ob.scan.all') : t('ob.scan.counting')}
              </div>

              <div
                style={{
                  height: 9,
                  borderRadius: 5,
                  background: '#EADFCB',
                  marginTop: 22,
                  overflow: 'hidden',
                }}
              >
                {/* The width is already moved thirty times a second, so it is
                    eased over one tick and no further — a 0.45s transition on
                    top of that is a bar permanently a beat behind itself. */}
                <div
                  style={{
                    height: '100%',
                    background: '#1D3A2A',
                    width: `${Math.round(scanShown * 100)}%`,
                    transition: 'width .1s linear',
                  }}
                />
              </div>

              <ScanFilm />

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}
                aria-live="polite"
              >
                {scanLines.map((line, k) => (
                  <div
                    key={line.text}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 15,
                      color: k < scanAt ? '#15251C' : k === scanAt ? '#C2571F' : '#B4A68F',
                      opacity: k <= scanAt ? 1 : 0.55,
                      transition: 'all .3s ease',
                    }}
                  >
                    <span style={mono({ fontSize: 13, width: 14, color: 'inherit' })}>
                      {k < scanAt ? '✓' : k === scanAt ? '▸' : '·'}
                    </span>
                    <span>{line.text}</span>
                    <span style={mono({ fontSize: 11.5, marginLeft: 'auto' })}>
                      {k <= scanAt ? line.value : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6 · People ───────────────────────────────────────────────── */}
          {step === 'people' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>{t('ob.people.found', { n: people.length })}</div>
              <h1 style={{ ...question, fontSize: 'clamp(32px, 5.6vw, 48px)' }}>
                {t('ob.people.title')}
              </h1>
              <p style={{ ...lede, maxWidth: '52ch' }}>
                {/* Named from the file that was actually read, not from the
                    button the reader pressed two steps ago — they can drop a
                    WhatsApp export with LINE selected, and Reg reads it anyway. */}
                {t(readFrom === 'line' ? 'ob.people.ledeLine' : 'ob.people.ledeWa')}
              </p>
              {/* The animals beside each name are a default, not a decision.
                  Said here because this is where the reader first meets them —
                  by the photo step they have already accepted them as fixed. */}
              <p style={{ ...lede, maxWidth: '52ch', marginTop: 8, opacity: 0.75 }}>
                {t('ob.people.photosNext')}
              </p>

              {openMerges.length > 0 && (
                <div
                  style={{
                    marginTop: 22,
                    background: '#FFF8E8',
                    border: '1px solid #EBD79F',
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/reg.png"
                      alt=""
                      style={{ width: 24, height: 24, borderRadius: 999, display: 'block' }}
                    />
                    <div
                      style={mono({
                        fontSize: 10.5,
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: '#9A7A22',
                      })}
                    >
                      {t('ob.people.mergeTitle')}
                    </div>
                  </div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}
                  >
                    {openMerges.map((merge) => (
                      <div
                        key={merge.from}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: '#FFFDF8',
                          border: '1px solid #EFE3CE',
                          borderRadius: 14,
                          padding: '11px 13px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          dir="auto"
                          style={{ fontFamily: 'var(--yap-heb)', fontWeight: 700, fontSize: 15 }}
                        >
                          {merge.from}
                        </div>
                        <div style={mono({ fontSize: 11 })}>+</div>
                        <div
                          dir="auto"
                          style={{ fontFamily: 'var(--yap-heb)', fontWeight: 700, fontSize: 15 }}
                        >
                          {merge.into}
                        </div>
                        <div style={mono({ fontSize: 10.5 })}>{merge.why}</div>
                        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => resolveMerge(merge.from, 'kept')}
                            style={{
                              cursor: 'pointer',
                              border: '1px solid #E3D5BE',
                              background: 'transparent',
                              borderRadius: 999,
                              padding: '7px 12px',
                              ...mono({
                                fontSize: 10.5,
                                color: '#5E5344',
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                              }),
                            }}
                          >
                            {t('ob.people.different')}
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveMerge(merge.from, 'merged')}
                            style={{
                              cursor: 'pointer',
                              border: 0,
                              background: '#1D3A2A',
                              borderRadius: 999,
                              padding: '7px 13px',
                              ...mono({
                                fontSize: 10.5,
                                color: '#F6EFE4',
                                textTransform: 'uppercase',
                                letterSpacing: '.08em',
                              }),
                            }}
                          >
                            {t('ob.people.merge')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unnamed.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#FDEEE6',
                    border: '1px solid #EFCBB4',
                    borderRadius: 14,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{ fontFamily: 'var(--yap-poster)', fontSize: 20, color: '#C2571F' }}
                  >
                    {unnamed.length}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.45, color: '#7A4A2C' }}>
                    {t(unnamed.length === 1 ? 'ob.people.unnamedOne' : 'ob.people.unnamedMany')}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
                {people.map((row, k) => {
                  const colour = PALETTE[k % PALETTE.length]!;
                  const typed = renames[row.name] ?? (row.unsaved ? '' : row.name);
                  const edited = typed.trim() !== '' && typed !== row.name;
                  return (
                    <div
                      key={row.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 13,
                        background: '#FFFDF8',
                        border: `1px solid ${row.unsaved && !typed.trim() ? '#EFCBB4' : '#E3D5BE'}`,
                        borderRadius: 16,
                        padding: '11px 13px',
                      }}
                    >
                      {/*
                          The same animal the deck will draw for them, keyed on
                          the name in the field beside it — so it re-draws as
                          they type, which is the clearest signal that the edit
                          took. A row that is still a bare phone number keeps
                          the question mark instead: this step's whole job is to
                          get those named, and a face on one reads as done.
                      */}
                      <div
                        aria-hidden="true"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          overflow: 'hidden',
                          background:
                            row.unsaved && !typed.trim() ? '#F1E7D6' : colour[0],
                          color: row.unsaved && !typed.trim() ? '#B4A68F' : colour[1],
                          display: 'grid',
                          placeItems: 'center',
                          fontFamily: 'var(--yap-heb)',
                          fontWeight: 900,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {row.unsaved && !typed.trim() ? (
                          '?'
                        ) : (
                          <AnimalFace name={typed || row.name} size={40} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* The dashed box is the affordance. Without it this is
                            an input drawn as a label, and the step reads as a
                            list of names with no way to change them. */}
                        <label className="yap-namefield">
                          <input
                            dir="auto"
                            value={typed}
                            onChange={(e) =>
                              setRenames((prev) => ({ ...prev, [row.name]: e.target.value }))
                            }
                            placeholder={
                              row.unsaved ? t('ob.people.who', { name: row.name }) : t('ob.people.name')
                            }
                            aria-label={t('ob.people.nameFor', { name: row.name })}
                            style={{
                              width: '100%',
                              minWidth: 0,
                              border: 0,
                              outline: 'none',
                              background: 'transparent',
                              fontFamily: 'var(--yap-heb)',
                              fontWeight: 700,
                              fontSize: 16.5,
                              color: row.unsaved && !typed.trim() ? '#C2571F' : '#15251C',
                              padding: 0,
                            }}
                          />
                          <PencilLine size={15} strokeWidth={1.8} aria-hidden="true" />
                        </label>
                        <div style={mono({ fontSize: 10.5, marginTop: 8 })}>
                          {t('ob.people.count', {
                            n: formatNumber(row.messages, 'en'),
                            month: monthLabel(row.firstDay, copy.locale),
                          })}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          padding: '5px 10px',
                          whiteSpace: 'nowrap',
                          background: row.unsaved && !typed.trim()
                            ? '#FDEEE6'
                            : edited
                              ? '#EAF3DC'
                              : '#F3EADA',
                          ...mono({
                            fontSize: 10,
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            color: row.unsaved && !typed.trim()
                              ? '#C2571F'
                              : edited
                                ? '#4A6B26'
                                : '#8A7B63',
                          }),
                        }}
                      >
                        {row.unsaved && !typed.trim()
                          ? t('ob.people.identify')
                          : edited
                            ? t('ob.people.edited')
                            : k === 0
                              ? t('ob.people.chief')
                              : t('ob.people.ok')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 7 · Photos ───────────────────────────────────────────────── */}
          {step === 'photos' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={eyebrow}>{t('ob.photos.eyebrow')}</div>
                <div style={optionalPill}>{t('ob.optional')}</div>
              </div>
              <h1 style={{ ...question, fontSize: 'clamp(32px, 5.6vw, 48px)' }}>
                {t('ob.photos.title')}
              </h1>
              <p style={{ ...lede, maxWidth: '52ch' }}>
                {t('ob.photos.lede')}
              </p>

              <div style={{ ...panel, marginTop: 26 }}>
                <div style={mono({ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase' })}>
                  {t('ob.photos.group')}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#5E5344',
                    marginTop: 6,
                    maxWidth: '56ch',
                  }}
                >
                  {t('ob.photos.groupNote')}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  {GROUP_SLIDES.map((slide) => {
                    const url = brief.groupPhotos[slide.slot];
                    const ground = BACKDROPS[GROUP_SLOT_BACKDROP[slide.slot]];
                    const layers = url ? photoLayers(slide.slot, ground.bg, url) : null;
                    return (
                      <div key={slide.slot}>
                        <label
                          style={{
                            position: 'relative',
                            display: 'block',
                            width: '100%',
                            aspectRatio: '9/16',
                            borderRadius: 14,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: ground.bg,
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            aria-label={t(slide.caption)}
                            style={hiddenInput}
                            onChange={(e) => {
                              setGroupPhoto(slide.slot, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                          {layers && (
                            <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
                              <div style={{ position: 'absolute', inset: 0, ...layers.image }} />
                              <div style={{ position: 'absolute', inset: 0, ...layers.tint }} />
                              <div style={{ position: 'absolute', inset: 0, ...layers.wash }} />
                              {layers.grain && (
                                <div
                                  className="yap-grain"
                                  style={{ position: 'absolute', inset: 0, ...layers.grain }}
                                />
                              )}
                            </div>
                          )}
                          {!url && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                placeItems: 'center',
                                ...mono({
                                  fontSize: 10,
                                  letterSpacing: '.1em',
                                  textTransform: 'uppercase',
                                  color: ground.accent,
                                }),
                              }}
                            >
                              {t('ob.photos.add')}
                            </div>
                          )}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              padding: '9px 10px 11px',
                              fontFamily: 'var(--yap-poster)',
                              fontSize: 14,
                              lineHeight: 0.95,
                              textTransform: 'uppercase',
                              textAlign: 'left',
                              color: ground.fg,
                            }}
                          >
                            {t(slide.caption)}
                          </div>
                        </label>
                        <div
                          style={mono({
                            fontSize: 9.5,
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            marginTop: 7,
                          })}
                        >
                          {slide.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={mono({
                  fontSize: 10.5,
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  marginTop: 26,
                })}
              >
                {t('ob.photos.solo')}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))',
                  gap: 12,
                  marginTop: 14,
                }}
              >
                {people.map((row, k) => {
                  const colour = PALETTE[k % PALETTE.length]!;
                  const url = faces[row.name];
                  const display = nameOf(row);
                  return (
                    <label
                      key={row.name}
                      style={{
                        cursor: 'pointer',
                        border: `1px solid ${url ? '#1D3A2A' : '#E3D5BE'}`,
                        background: '#FFFDF8',
                        borderRadius: 18,
                        padding: '14px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 9,
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        aria-label={display}
                        style={hiddenInput}
                        onChange={(e) => {
                          setFace(row.name, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <div
                        style={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 999,
                          backgroundColor: colour[0],
                          backgroundImage: url ? `url(${url})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          color: colour[1],
                          display: 'grid',
                          placeItems: 'center',
                          fontFamily: 'var(--yap-heb)',
                          fontWeight: 900,
                          fontSize: 20,
                        }}
                      >
                        {/*
                          The tile has to promise what the deck will actually
                          draw, so an empty slot shows that person's animal —
                          the same one, from the same name. It also sidesteps
                          the problem initials had here: `+972 58-666-8048`
                          reduces to "95", which reads as a name nobody has.
                        */}
                        {!url && (
                          <div className="absolute inset-0 overflow-hidden rounded-full">
                            <AnimalFace name={display} size={64} />
                          </div>
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            right: -2,
                            bottom: -2,
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: url ? '#1D3A2A' : '#F3EADA',
                            color: url ? '#C9F24D' : '#5E5344',
                            border: '2px solid #FFFDF8',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                            lineHeight: 1,
                          }}
                        >
                          {url ? '✓' : '+'}
                        </div>
                      </div>
                      <div
                        dir="auto"
                        style={{
                          fontFamily: 'var(--yap-heb)',
                          fontWeight: 700,
                          fontSize: 13.5,
                          textAlign: 'center',
                          lineHeight: 1.2,
                          color: '#15251C',
                        }}
                      >
                        {display}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={mono({ marginTop: 16 })}>
                {Object.keys(faces).length > 0
                  ? t('ob.photos.some', { n: Object.keys(faces).length, m: people.length })
                  : t('ob.photos.none')}
              </div>
            </div>
          )}

          {/* ── 8 · Done ─────────────────────────────────────────────────── */}
          {step === 'done' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div
                style={{
                  background: '#1D3A2A',
                  color: '#F6EFE4',
                  borderRadius: 26,
                  padding: 30,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(80% 70% at 50% 0%,rgba(245,179,36,.22),transparent 70%)',
                  }}
                />
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/reg.png"
                    alt=""
                    style={{ width: 56, height: 56, borderRadius: 999, display: 'block' }}
                  />
                  <div
                    style={mono({
                      fontSize: 10.5,
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: '#F5B324',
                      marginTop: 14,
                    })}
                  >
                    {failed
                      ? t('ob.done.failed')
                      : stats
                        ? t('ob.done.accepted')
                        : t('ob.done.counting')}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--yap-serif)',
                      fontSize: 'clamp(32px, 5.4vw, 44px)',
                      lineHeight: 1.03,
                      marginTop: 8,
                      maxWidth: '22ch',
                    }}
                  >
                    {failed
                      ? t('ob.done.error')
                      : stats
                        ? t('ob.done.ready')
                        : t('ob.done.finishing')}
                  </div>
                  {/* The counting happens after the naming step, so it can fail
                      on a screen with no progress bar and no footer. Without
                      this the button sits on "One moment…" forever and the
                      reader has no way back to the file. */}
                  {failed && (
                    <p
                      role="alert"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: '#F0E2CB',
                        margin: '12px 0 0',
                        maxWidth: '46ch',
                      }}
                    >
                      {error}
                    </p>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
                      gap: 10,
                      marginTop: 20,
                    }}
                  >
                    {[
                      {
                        label: t('ob.done.language'),
                        value: LANGUAGES.find((l) => l.code === brief.language)?.name ?? 'English',
                      },
                      { label: t('ob.done.type'), value: kindLabel },
                      {
                        label: t('ob.done.messages'),
                        value: stats ? formatNumber(stats.totalMessages, 'en') : '…',
                      },
                      {
                        label: t('ob.done.people'),
                        value: t('ob.done.peopleValue', {
                          n: stats?.people.length ?? people.length,
                          m: Object.keys(faces).length,
                        }),
                      },
                    ].map((tile) => (
                      <div
                        key={tile.label}
                        style={{
                          background: 'rgba(246,239,228,.08)',
                          border: '1px solid rgba(246,239,228,.14)',
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={mono({
                            fontSize: 9.5,
                            letterSpacing: '.14em',
                            textTransform: 'uppercase',
                            color: '#C9C0AE',
                          })}
                        >
                          {tile.label}
                        </div>
                        <div dir="auto" style={{ fontWeight: 500, fontSize: 16, marginTop: 5 }}>
                          {tile.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={failed ? () => setStep('upload') : onPlay}
                disabled={!stats && !failed}
                className="yap-press"
                style={{
                  width: '100%',
                  marginTop: 14,
                  border: 0,
                  cursor: stats || failed ? 'pointer' : 'progress',
                  background: stats || failed ? '#F5B324' : '#E4D8C3',
                  color: stats || failed ? '#221600' : '#A6987F',
                  fontFamily: 'var(--yap-sans)',
                  fontWeight: 700,
                  fontSize: 16,
                  padding: 17,
                  borderRadius: 999,
                  boxShadow: stats || failed ? '0 6px 0 #B98214' : 'none',
                  ['--yap-press-shadow' as string]: '#B98214',
                }}
              >
                {failed ? t('ob.done.retry') : stats ? t('ob.done.play') : t('ob.done.wait')}
              </button>
              <div
                style={{
                  fontSize: 12.5,
                  color: '#8A7B63',
                  marginTop: 12,
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                {t('ob.done.free', { n: freeCount })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────
          Absent while Reg is reading and once the brief is accepted: both are
          screens with exactly one thing to do, and a Continue button that does
          nothing yet is a button people press twice. */}
      {step !== 'scan' && step !== 'done' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 40,
            background: 'rgba(250,245,236,.94)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid #E0D2BB',
            padding: '14px 24px',
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <button
              type="button"
              onClick={back}
              style={{
                cursor: 'pointer',
                border: '1px solid #E0D2BB',
                background: '#FFFDF8',
                borderRadius: 999,
                padding: '12px 18px',
                visibility: index === 0 ? 'hidden' : 'visible',
                ...mono({
                  fontSize: 11,
                  color: '#5E5344',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }),
              }}
            >
              ← {t('ob.back')}
            </button>
            <div
              dir="auto"
              style={{
                fontSize: 13,
                color: '#8A7B63',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {trail}
            </div>
            {(step === 'notes' || step === 'photos') && (
              <button
                type="button"
                onClick={next}
                style={{
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                  padding: '12px 6px',
                  textDecoration: 'underline',
                  ...mono({ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }),
                }}
              >
                {t('ob.skip')}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!ready}
              style={{
                border: 0,
                cursor: ready ? 'pointer' : 'not-allowed',
                background: ready ? '#1D3A2A' : '#E4D8C3',
                color: ready ? '#F6EFE4' : '#A6987F',
                fontFamily: 'var(--yap-sans)',
                fontWeight: 500,
                fontSize: 15,
                borderRadius: 999,
                padding: '13px 26px',
                boxShadow: ready ? '0 5px 0 #0F231A' : 'none',
              }}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
