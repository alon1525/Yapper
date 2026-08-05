'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { ChatStats, MergeSuggestion, RosterEntry } from '@wrapped/core';
import {
  CHAT_KINDS,
  GROUP_SLOTS,
  LANGUAGES,
  NOTES_LIMIT,
  type Brief,
  type GroupSlot,
  type ReportLanguage,
} from '@/lib/brief';
import { formatNumber } from '@/lib/format';
import type { AnalyzerState } from '@/lib/useAnalyzer';
import { GROUP_SLOT_BACKDROP, photoLayers } from '../cards/photos';
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

const HINTS = ['Nicknames', "Who's dating who", 'Keep it clean'];

const EXPORT_STEPS = [
  {
    n: '01',
    title: 'Open the chat, tap the ⋯ menu',
    note: 'Top right on iPhone, three dots on Android.',
  },
  {
    n: '02',
    title: 'Tap Export chat → Without media',
    note: 'iPhone: More → Export Chat. Android: Menu → More → Export chat.',
  },
  {
    n: '03',
    title: 'Send it to yourself, then bring it here',
    note: 'Save to Files, Mail, Drive — anywhere you can grab the file from.',
  },
];

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
const GROUP_SLIDES: { slot: GroupSlot; label: string; caption: string }[] = [
  { slot: 'opener', label: '01 · Opener', caption: 'The years.' },
  { slot: 'chaos', label: '08 · Chaos day', caption: 'Peak chaos' },
  { slot: 'verdict', label: '15 · Verdict', caption: 'The end' },
  { slot: 'paywall', label: '16 · Paywall', caption: 'Unlock' },
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

function initialsOf(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!cleaned) return '?';
  return (
    cleaned
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => [...word][0] ?? '')
      .join('') || '?'
  );
}

/** `YYYY-MM-DD` → `Aug 2016`. Built from the string, never from a `Date`. */
function monthLabel(day: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [year, month] = day.split('-');
  const index = Number(month) - 1;
  return months[index] ? `${months[index]} ${year}` : (year ?? '');
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
  const [step, setStep] = useState<Step>('lang');
  const [dragging, setDragging] = useState(false);

  /* The roster is copied out of the analyzer the moment it arrives, because
     answering the question moves the analyzer on and takes the question's own
     data with it — the photos step still needs to know who is in this chat. */
  const [rows, setRows] = useState<RosterEntry[]>([]);
  const [merges, setMerges] = useState<(MergeSuggestion & { verdict: 'open' | 'merged' | 'kept' })[]>(
    [],
  );
  const [renames, setRenames] = useState<Record<string, string>>({});
  /* Keyed by the name the export used, not the name on screen. Going back a step
     and fixing a spelling must not orphan the face that was already picked. */
  const [faces, setFaces] = useState<Record<string, string>>({});

  const fileInput = useRef<HTMLInputElement>(null);

  const index = STEPS.indexOf(step);

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
    if (state.phase === 'roster' && step === 'scan') setStep('people');
  }, [state.phase, step]);

  useEffect(() => {
    if (state.phase !== 'roster') return;
    setRows(state.people);
    setMerges(state.merges.map((m) => ({ ...m, verdict: 'open' as const })));
  }, [state]);

  // Every panel is a new screenful of copy; leaving the scroll where the last
  // one ended puts the reader halfway down the next question.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

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
      ? 'Waiting for your file'
      : step === 'people'
        ? 'Names look right'
        : step === 'photos'
          ? 'Done — brief Reg'
          : 'Continue';

  const trail =
    step === 'lang'
      ? 'Three quick questions, then the export.'
      : step === 'kind'
        ? (LANGUAGES.find((l) => l.code === brief.language)?.name ?? '')
        : step === 'notes'
          ? `${brief.kind} · optional`
          : step === 'upload'
            ? 'Nothing is uploaded — Reg reads it in your browser.'
            : step === 'people'
              ? `${openMerges.length} possible duplicates · ${unnamed.length} unnamed`
              : step === 'photos'
                ? `${people.length} people · ${Object.keys(faces).length} with a face`
                : '';

  const counted = state.phase === 'working' ? state.messages : (stats?.totalMessages ?? 0);
  const fraction = state.phase === 'working' ? state.fraction : 1;

  const scanLines: { text: string; value: string }[] = [
    { text: 'Opening your export', value: 'read locally' },
    { text: 'Reading your messages', value: formatNumber(counted, 'en') },
    { text: 'Sorting out who said what', value: `${rows.length || '—'} people` },
    { text: 'Counting every single emoji', value: '' },
    { text: 'Looking for the moments you forgot', value: '' },
    { text: 'Writing your story', value: '' },
  ];
  const scanAt = scanLines.findIndex(
    (line) => line.text === (state.phase === 'working' ? state.stage : ''),
  );

  return (
    <div
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
            Setting up your report
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
            {step === 'scan' ? 'Reading' : `Step ${Math.min(index + 1, COUNTED_STEPS)} of 7`}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Leave setup"
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
                More languages are on Reg&apos;s desk. Arabic, Spanish and Russian next.
              </div>
            </div>
          )}

          {/* ── 2 · Kind ─────────────────────────────────────────────────── */}
          {step === 'kind' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>Question 2 of 3</div>
              <h1 style={question}>What kind of chat is this?</h1>
              <p style={lede}>
                It changes what Reg looks for, and how mean he&apos;s allowed to be.
              </p>
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
                      <div style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">
                        {kind.mark}
                      </div>
                      <div style={{ fontWeight: 500, fontSize: 16, marginTop: 10 }}>{kind.name}</div>
                      <div
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.4,
                          color: on ? '#C9C0AE' : '#5E5344',
                          marginTop: 4,
                        }}
                      >
                        {kind.note}
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
                <div style={eyebrow}>Question 3 of 3</div>
                <div style={optionalPill}>Optional</div>
              </div>
              <h1 style={question}>Anything Reg should know?</h1>
              <p style={{ ...lede, maxWidth: '50ch' }}>
                Inside jokes, nicknames, who&apos;s dating who, the incident nobody talks about.
                Skip it and Reg will guess — badly, but confidently.
              </p>
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
                  placeholder="e.g. תמיר never replies because he works nights. Do not mention the trip to Eilat."
                  aria-label="Anything Reg should know"
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
                            notes: `${brief.notes ? `${brief.notes.replace(/\s*$/, '')} ` : ''}${hint}: `.slice(
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
                        {hint} →
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={mono({ marginTop: 12, lineHeight: 1.5 })}>
                Typed here, stays here until you ask for Reg&apos;s lines — and the names in it are
                swapped for tokens before it is sent, exactly like your messages.
              </div>
            </div>
          )}

          {/* ── 4 · Upload ───────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div style={{ animation: 'obPop .35s ease' }}>
              <div style={eyebrow}>The only fiddly part</div>
              <h1 style={question}>Export the chat, then drop it here.</h1>
              <div className="yap-export" style={{ marginTop: 24 }}>
                <ExportPhone />

                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {EXPORT_STEPS.map((exportStep) => (
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
                            {exportStep.title}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.45,
                              color: '#5E5344',
                              marginTop: 3,
                            }}
                          >
                            {exportStep.note}
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
                      Drop{' '}
                      <span style={{ fontFamily: 'var(--yap-mono)', fontSize: 15 }}>_chat.txt</span>{' '}
                      or the .zip
                    </div>
                    <div style={mono({ fontSize: 10.5, marginTop: 7 })}>
                      or click to browse — nothing is uploaded
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
                    Choose <strong>Without media</strong> — it&apos;s faster and Reg only reads
                    text anyway.
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
                <div style={eyebrow}>Reading on your device</div>
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
                {formatNumber(counted, 'en')}
              </div>
              <div
                style={{ fontFamily: 'var(--yap-serif)', fontSize: 30, lineHeight: 1.1, marginTop: 2 }}
              >
                {fraction >= 1 ? 'messages. All of them.' : 'messages and counting…'}
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
                <div
                  style={{
                    height: '100%',
                    background: '#1D3A2A',
                    width: `${Math.round(fraction * 100)}%`,
                    transition: 'width .45s ease',
                  }}
                />
              </div>

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
              <div style={eyebrow}>{people.length} people found</div>
              <h1 style={{ ...question, fontSize: 'clamp(32px, 5.6vw, 48px)' }}>Who is who?</h1>
              <p style={{ ...lede, maxWidth: '52ch' }}>
                These are the names WhatsApp gave Reg. Fix the ones that are wrong, name the phone
                numbers, and merge anyone who shows up twice.
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
                      Reg thinks these are the same person
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
                            Different
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
                            Merge
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
                    {unnamed.length === 1 ? 'person is' : 'people are'} just a phone number. Name
                    them, or Reg writes the story around a number. A name you add is also scrubbed
                    out of your messages before he sees them.
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
                      <div
                        aria-hidden="true"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
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
                        {row.unsaved && !typed.trim() ? '?' : initialsOf(typed || row.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                          dir="auto"
                          value={typed}
                          onChange={(e) =>
                            setRenames((prev) => ({ ...prev, [row.name]: e.target.value }))
                          }
                          placeholder={row.unsaved ? `${row.name} — who is this?` : 'Name'}
                          aria-label={`Name for ${row.name}`}
                          style={{
                            width: '100%',
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
                        <div style={mono({ fontSize: 10.5, marginTop: 3 })}>
                          {formatNumber(row.messages, 'en')} messages · since{' '}
                          {monthLabel(row.firstDay)}
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
                          ? 'Identify'
                          : edited
                            ? 'Edited'
                            : k === 0
                              ? 'Chief yapper'
                              : 'OK'}
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
                <div style={eyebrow}>Last thing</div>
                <div style={optionalPill}>Optional</div>
              </div>
              <h1 style={{ ...question, fontSize: 'clamp(32px, 5.6vw, 48px)' }}>Give it faces.</h1>
              <p style={{ ...lede, maxWidth: '52ch' }}>
                Photos make the slides much funnier. They stay on your device — they are never
                uploaded and never reach Reg, who works from text only. Skip it and everyone gets
                initials and flat colour.
              </p>

              <div style={{ ...panel, marginTop: 26 }}>
                <div style={mono({ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase' })}>
                  Group photos → slide backgrounds
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
                  Four slides get a full-bleed photo, colour-graded into the slide so the type
                  still wins. Drop one per slide, or fill the first and leave the rest.
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
                            aria-label={`Photo for ${slide.label}`}
                            style={hiddenInput}
                            onChange={(e) => {
                              setGroupPhoto(slide.slot, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                          {layers && (
                            <>
                              <div style={{ position: 'absolute', inset: 0, ...layers.image }} />
                              <div style={{ position: 'absolute', inset: 0, ...layers.veil }} />
                              <div style={{ position: 'absolute', inset: 0, ...layers.scrim }} />
                            </>
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
                              + Add
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
                            {slide.caption}
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
                Solo photos → leaderboard, chief yapper, ghost, awards
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
                  // Somebody left as a phone number has no initials worth
                  // showing — `+972 58-666-8048` reduces to "95", which reads
                  // as a name nobody has. The people step already draws them
                  // with a question mark; so does this one.
                  const stillANumber = row.unsaved && !(renames[row.name] ?? '').trim();
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
                        aria-label={`Photo of ${display}`}
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
                        <span style={{ opacity: url ? 0 : 1 }}>
                          {stillANumber ? '?' : initialsOf(display)}
                        </span>
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
                  ? `${Object.keys(faces).length} of ${people.length} have a face. Reg approves.`
                  : 'Tap anyone to add a photo. All optional.'}
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
                    {failed ? 'Something went wrong' : stats ? 'Brief accepted' : 'Still counting'}
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
                      ? 'Reg could not finish reading that one.'
                      : stats
                        ? 'Reg has everything he needs.'
                        : 'Reg is finishing the last of the counting.'}
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
                        label: 'Language',
                        value: LANGUAGES.find((l) => l.code === brief.language)?.name ?? 'English',
                      },
                      { label: 'Chat type', value: brief.kind || 'Friends group' },
                      {
                        label: 'Messages',
                        value: stats ? formatNumber(stats.totalMessages, 'en') : '…',
                      },
                      {
                        label: 'People',
                        value: `${stats?.people.length ?? people.length} · ${Object.keys(faces).length} with photos`,
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
                {failed
                  ? 'Try another export'
                  : stats
                    ? 'Write my story — with sound ♪'
                    : 'One moment…'}
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
                {freeCount} slides free. The full roast, per-person reports and the shareable pack
                unlock at the end.
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
              ← Back
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
                Skip
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
