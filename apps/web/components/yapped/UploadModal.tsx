'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ChatStats } from '@wrapped/core';
import { formatDays, formatNumber } from '@/lib/format';
import { Steps } from './Steps';

/**
 * The upload flow, as one modal in three steps.
 *
 * The design draws three: get the export, watch it being read, play it. The
 * app has a fourth that the design could not know about — an export names
 * anyone missing from the exporter's address book by phone number only, so
 * sometimes we have to stop and ask who that is. It shares step two's bar
 * rather than adding a fourth, because from the reader's side it is still
 * "Reg is working on it", and a four-step progress bar that only sometimes has
 * four steps is worse than a three-step one that occasionally pauses.
 *
 * Which panel shows is derived from the analyzer, never stored: this component
 * knows only whether the reader has opened it.
 */

export const STAGES = [
  'Opening your export',
  'Reading your messages',
  'Sorting out who said what',
  'Counting every single emoji',
  'Looking for the moments you forgot',
  'Writing your story',
];

export type Panel = 'guide' | 'scan' | 'naming' | 'ready';

const BAR_FOR: Record<Panel, number> = { guide: 0, scan: 1, naming: 1, ready: 2 };

const mono = (extra?: CSSProperties): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 11,
  color: '#8A7B63',
  ...extra,
});

const tile: CSSProperties = {
  background: 'rgba(246,239,228,.08)',
  borderRadius: 12,
  padding: 11,
};

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div style={tile}>
      <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 22 }}>{value}</div>
      <div
        style={{
          fontFamily: 'var(--yap-mono)',
          fontSize: 9.5,
          color: '#C9C0AE',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function UploadModal({
  panel,
  onClose,
  onPick,
  onNames,
  onPlay,
  picked,
  error,
  stage,
  fraction,
  unsaved,
  stats,
  slideCount,
  freeCount,
}: {
  panel: Panel;
  onClose: () => void;
  onPick: (file: File) => void;
  onNames: (aliases: Record<string, string>) => void;
  onPlay: () => void;
  picked: { name: string; size: number } | null;
  error: string | null;
  stage: string;
  fraction: number;
  unsaved: string[];
  stats: ChatStats | null;
  slideCount: number;
  freeCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  // Escape closes, and the page underneath must not scroll away behind the
  // sheet while it is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const title =
    panel === 'guide'
      ? 'Get your export'
      : panel === 'scan'
        ? 'Reg is reading'
        : panel === 'naming'
          ? 'Who is this?'
          : 'Your story is ready';

  const step =
    panel === 'guide'
      ? 'Step 1 of 3 · in WhatsApp'
      : panel === 'scan'
        ? 'Step 2 of 3 · on your device'
        : panel === 'naming'
          ? 'Step 2 of 3 · still on your device'
          : `Step 3 of 3 · ${freeCount} slides free`;

  const current = Math.max(0, STAGES.indexOf(stage));
  const pct = `${Math.round(fraction * 100)}%`;
  const named = unsaved.filter((n) => (names[n] ?? '').trim().length > 0).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(21,37,28,.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'var(--yap-sans)',
        color: '#15251C',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '88vh',
          overflow: 'auto',
          background: '#FAF5EC',
          border: '1px solid #E3D5BE',
          borderRadius: 26,
          boxShadow: '0 40px 90px rgba(20,12,4,.4)',
          padding: '26px 26px 24px',
          animation: 'yapPop .28s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/reg.png"
              alt=""
              style={{ width: 34, height: 34, borderRadius: 999, display: 'block' }}
            />
            <div>
              <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 22, lineHeight: 1 }}>
                {title}
              </div>
              <div
                style={mono({
                  fontSize: 10,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  marginTop: 3,
                })}
              >
                {step}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
          {[0, 1, 2].map((k) => (
            <div
              key={k}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: k <= BAR_FOR[panel] ? '#1D3A2A' : '#EADFCB',
              }}
            />
          ))}
        </div>

        {/* ── Step 1 · get the file ─────────────────────────────────────── */}
        {panel === 'guide' && (
          <div style={{ marginTop: 20 }}>
            <Steps />

            <input
              ref={inputRef}
              type="file"
              accept=".txt,.zip,text/plain,application/zip"
              className="sr-only"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
                e.target.value = '';
              }}
            />

            <div
              className="yap-drop"
              data-dragging={dragging}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) onPick(file);
              }}
              style={{
                marginTop: 16,
                border: '1.5px dashed #CDB994',
                borderRadius: 16,
                padding: 22,
                textAlign: 'center',
                background: 'linear-gradient(180deg,#FBF6EC,#F5EDDF)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 24 }}>
                Drop <span style={{ fontFamily: 'var(--yap-mono)', fontSize: 15 }}>_chat.txt</span>{' '}
                or the .zip here
              </div>
              <div style={mono({ marginTop: 6 })}>or click to browse · nothing is uploaded</div>
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

            <div style={{ fontSize: 12.5, color: '#8A7B63', marginTop: 12, lineHeight: 1.5 }}>
              Hebrew, English and RTL exports all work. Groups up to 500,000 messages.
            </div>
          </div>
        )}

        {/* ── Step 2 · reading it, here on the device ───────────────────── */}
        {panel === 'scan' && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#FFFDF8',
                border: '1px solid #E3D5BE',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 36,
                  borderRadius: 5,
                  background: '#1D3A2A',
                  color: '#C9F24D',
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 8,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {picked?.name.toLowerCase().endsWith('.zip') ? 'ZIP' : 'TXT'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  dir="auto"
                >
                  {picked?.name ?? 'Your export'}
                </div>
                <div style={mono({ marginTop: 2 })}>
                  {picked ? `${formatSize(picked.size)} · read locally` : 'read locally'}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 22, color: '#C2571F' }}>
                {pct}
              </div>
            </div>

            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: '#EADFCB',
                marginTop: 14,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#1D3A2A',
                  width: pct,
                  transition: 'width .4s ease',
                }}
              />
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}
              aria-live="polite"
            >
              {STAGES.map((text, k) => (
                <div
                  key={text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 14,
                    color: k < current ? '#1D3A2A' : k === current ? '#C2571F' : '#B4A68F',
                  }}
                >
                  <span style={{ fontFamily: 'var(--yap-mono)', fontSize: 12, width: 14 }}>
                    {k < current ? '✓' : k === current ? '▸' : '·'}
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2b · the people WhatsApp only knew by number ─────────── */}
        {panel === 'naming' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: 'var(--yap-serif)', fontSize: 30, lineHeight: 1.05 }}>
              {unsaved.length === 1 ? 'One person is not' : `${unsaved.length} people are not`}{' '}
              <em style={{ fontStyle: 'italic', color: '#C2571F' }}>saved in your phone.</em>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#5E5344', margin: '10px 0 0' }}>
              WhatsApp only wrote their number in the export. What does the group call them?
            </p>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}
            >
              {unsaved.map((number) => (
                <label key={number} style={{ display: 'block' }}>
                  <span
                    dir="ltr"
                    style={mono({ fontSize: 10.5, display: 'block', marginBottom: 5 })}
                  >
                    {number}
                  </span>
                  <input
                    type="text"
                    dir="auto"
                    value={names[number] ?? ''}
                    onChange={(e) =>
                      setNames((prev) => ({ ...prev, [number]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onNames(names);
                    }}
                    placeholder="Their name"
                    style={{
                      width: '100%',
                      background: '#FFFDF8',
                      border: '1px solid #E3D5BE',
                      borderRadius: 14,
                      padding: '12px 14px',
                      fontFamily: 'var(--yap-sans)',
                      fontSize: 15,
                      color: '#15251C',
                      outline: 'none',
                    }}
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNames(names)}
              className="yap-press"
              style={{
                width: '100%',
                marginTop: 16,
                border: 0,
                cursor: 'pointer',
                background: '#1D3A2A',
                color: '#F6F0E4',
                fontFamily: 'var(--yap-sans)',
                fontSize: 15,
                fontWeight: 500,
                padding: 14,
                borderRadius: 999,
                boxShadow: '0 8px 0 #0F231A',
              }}
            >
              {named === 0 ? 'Skip, keep the numbers' : 'Continue'}
            </button>

            <div style={{ fontSize: 12.5, color: '#8A7B63', marginTop: 12, lineHeight: 1.5 }}>
              Typed here, stays here. A name you add is also scrubbed out of your messages before
              Reg ever sees them — so filling this in makes your story more private, not less.
            </div>
          </div>
        )}

        {/* ── Step 3 · it's ready ──────────────────────────────────────── */}
        {panel === 'ready' && stats && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                background: '#1D3A2A',
                color: '#F6EFE4',
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--yap-mono)',
                  fontSize: 10,
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: '#F5B324',
                }}
              >
                Reg is done reading
              </div>
              <div
                style={{
                  fontFamily: 'var(--yap-serif)',
                  fontSize: 32,
                  lineHeight: 1.05,
                  marginTop: 8,
                }}
              >
                {formatDays(stats.span.days)}. {formatNumber(stats.totalMessages, stats.language)}{' '}
                messages. One very obvious culprit.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <Tile value={String(stats.people.length)} label="PEOPLE" />
                <Tile value={String(slideCount)} label="SLIDES" />
                <Tile value={String(freeCount)} label="FREE NOW" />
              </div>
            </div>

            <button
              type="button"
              onClick={onPlay}
              className="yap-press"
              style={{
                width: '100%',
                marginTop: 14,
                border: 0,
                cursor: 'pointer',
                background: '#F5B324',
                color: '#221600',
                fontFamily: 'var(--yap-sans)',
                fontWeight: 700,
                fontSize: 16,
                padding: 16,
                borderRadius: 999,
                boxShadow: '0 6px 0 #B98214',
                ['--yap-press-shadow' as string]: '#B98214',
              }}
            >
              Play my story — with sound ♪
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
  );
}
