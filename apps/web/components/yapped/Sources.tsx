import { Phone } from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * Which apps Reg can read.
 *
 * Two marks and their names, wherever the reader is being asked for a file.
 * "Both exports work" as a sentence is a claim people skim past; a green
 * WhatsApp bubble beside a green LINE tile is the same claim in the form
 * somebody actually checks before they go looking for their export.
 *
 * The marks are drawn here rather than pulled from a brand pack: they are
 * simplified and each one is captioned with its name, so nothing rests on the
 * glyph being an exact reproduction. They identify a file format this app can
 * read — they are not a badge of anyone's approval, and they are not restyled
 * into the Yapped palette, which would read as a co-brand.
 */

const WHATSAPP_GREEN = '#25D366';
export const LINE_GREEN = '#06C755';

export function WhatsAppMark({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 999,
        background: WHATSAPP_GREEN,
        flexShrink: 0,
      }}
    >
      <Phone size={size * 0.55} strokeWidth={2.4} color="#FFFFFF" fill="#FFFFFF" />
    </span>
  );
}

export function LineMark({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: LINE_GREEN,
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24" role="presentation">
        {/* The bubble with the flick at the bottom left, which is the part of
            the mark people recognise at 20px — the wordmark inside it does not
            survive that size and is left to the caption. */}
        <path
          d="M12 3.4c5 0 9 3.2 9 7.2 0 4-4 7.2-9 7.2-.5 0-1 0-1.5-.1l-3.9 2.5c-.3.2-.7 0-.6-.4l.7-2.9C3.9 15.6 3 13.4 3 10.6c0-4 4-7.2 9-7.2Z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

/**
 * The row. `tone` is the colour the captions are set in, because this sits on
 * the parchment card on the landing and on the sheet inside the onboarding, and
 * those are not the same ground.
 */
export function SourceMarks({
  size = 20,
  tone = '#8A7B63',
  style,
}: {
  size?: number;
  tone?: string;
  style?: CSSProperties;
}) {
  const label: CSSProperties = {
    fontFamily: 'var(--yap-mono)',
    fontSize: 11,
    letterSpacing: '.04em',
    color: tone,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 14,
        ...style,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <WhatsAppMark size={size} />
        <span style={label}>WhatsApp</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <LineMark size={size} />
        <span style={label}>LINE</span>
      </span>
    </div>
  );
}
