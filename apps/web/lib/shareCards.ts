import type { ChatStats } from '@wrapped/core';
import type { Localised } from './copy';
import { day, duration, hour, num, percent, shortName, span, spanLabel } from './localFormat';

/**
 * The cards, and the machine that draws them.
 *
 * Drawn on a canvas in the reader's own browser rather than rendered on a
 * server, and that is not a performance decision. The whole product rests on
 * "your chat never leaves your device"; a share card built server-side would
 * mean posting the group's name, the loudest member and the funniest day to an
 * endpoint in order to get a picture back. Here the bytes never leave, the
 * cards work with no network at all, and the reader's own fonts render their
 * own names — including the Japanese ones no font we could ship would cover.
 *
 * 1080×1920 because that is what a story is. Everything below is expressed as
 * a fraction of that, so the same code draws a thumbnail for the picker and a
 * full-size PNG for the share sheet.
 */

export const CARD_W = 1080;
export const CARD_H = 1920;

/** The deck's own grounds. A card is a slide, not a new design. */
const GROUNDS = {
  lime: { bg: '#C9F24D', fg: '#10130E', accent: '#1D3A2A' },
  pink: { bg: '#FF4FA3', fg: '#180410', accent: '#FFFFFF' },
  purple: { bg: '#4B1BD1', fg: '#F1ECFF', accent: '#C9F24D' },
  orange: { bg: '#FF6B1A', fg: '#1A0A00', accent: '#180410' },
  teal: { bg: '#16E0C8', fg: '#04211D', accent: '#04211D' },
  ink: { bg: '#10130E', fg: '#F6EFE4', accent: '#C9F24D' },
  navy: { bg: '#121A3A', fg: '#E7EBFF', accent: '#53BDEB' },
  forest: { bg: '#1D3A2A', fg: '#F6EFE4', accent: '#F5B324' },
} as const;

type GroundName = keyof typeof GROUNDS;

/**
 * What a card says, independent of how it is drawn.
 *
 * Every card is the same four things — a label, a huge value, a line under it,
 * and optionally a short ranking — because that is what survives being looked
 * at for one second in a story. A card that needed a fifth thing would be a
 * slide, and the deck already exists.
 */
export interface CardSpec {
  id: string;
  ground: GroundName;
  label: string;
  value: string;
  /** Sits under the value, in the serif. Two lines at most. */
  caption: string;
  /** Optional leaderboard: up to five rows, drawn as bars. */
  rows?: { name: string; value: string; share: number }[];
  /** Drawn small under the value — the emoji podium's whole point. */
  glyph?: string;
}

/**
 * The pack, in the order it is offered.
 *
 * Only cards this chat can actually fill: the same rule the deck follows, for
 * the same reason. A card offering "certified ghost" to a group where nobody
 * has ever gone quiet is a card about nothing.
 */
export function cardsFor(stats: ChatStats, l: Localised): CardSpec[] {
  const cards: CardSpec[] = [];
  const person = (name: string | null) => stats.people.find((p) => p.name === name) ?? null;

  cards.push({
    id: 'total',
    ground: 'lime',
    label: l.t('card.total.label'),
    value: num(l, stats.totalMessages),
    caption: l.t('card.total.caption', { days: span(l, stats.span.days) }),
  });

  const top = stats.people[0];
  if (top && stats.people.length >= 2) {
    cards.push({
      id: 'talker',
      ground: 'pink',
      label: l.t('card.talker.label'),
      value: shortName(top.name),
      caption: l.t('card.talker.caption', { share: percent(top.share) }),
    });

    cards.push({
      id: 'leaderboard',
      ground: 'purple',
      label: l.t('card.leaderboard.label'),
      value: '',
      caption: '',
      rows: stats.people.slice(0, 5).map((p) => ({
        name: shortName(p.name),
        value: num(l, p.messages),
        share: p.share,
      })),
    });
  }

  const night = stats.hourHistogram.slice(0, 5).reduce((sum, c) => sum + c, 0);
  if (stats.busiestHour) {
    cards.push({
      id: 'hours',
      ground: 'navy',
      label: l.t('card.hours.label'),
      value: hour(l, stats.busiestHour.hour),
      caption: l.t('card.hours.caption', { count: num(l, night) }),
    });
  }

  const ghost = person(stats.awards.ghost);
  if (ghost && ghost.longestSilenceDays >= 7) {
    cards.push({
      id: 'ghost',
      ground: 'ink',
      label: l.t('card.ghost.label'),
      value: shortName(ghost.name),
      caption: l.t('card.ghost.caption', { days: span(l, ghost.longestSilenceDays) }),
    });
  }

  const emoji = stats.topEmoji[0];
  if (emoji) {
    cards.push({
      id: 'emoji',
      ground: 'orange',
      label: l.t('card.emoji.label'),
      value: emoji.value,
      caption: l.t('card.emoji.caption', { count: num(l, emoji.count) }),
      glyph: emoji.value,
    });
  }

  if (stats.busiestDay && stats.busiestDay.count > 20) {
    cards.push({
      id: 'chaos',
      ground: 'teal',
      label: l.t('card.chaos.label'),
      // The date is the value and the count is the caption, not the other way
      // round: "450" over "450 messages in one day" says the number twice and
      // never says which day it was.
      value: day(l, stats.busiestDay.day),
      caption: l.t('card.chaos.caption', { count: num(l, stats.busiestDay.count) }),
    });
  }

  const fast = person(stats.awards.fastestReplier);
  if (fast && fast.medianResponseMs !== null) {
    cards.push({
      id: 'fastest',
      ground: 'lime',
      label: l.t('card.fastest.label'),
      value: duration(l, fast.medianResponseMs, stats.timestampPrecisionMs),
      caption: l.t('card.fastest.caption', { count: num(l, fast.responseSamples) }),
    });
  }

  cards.push({
    id: 'verdict',
    ground: 'forest',
    label: l.t('card.verdict.label'),
    value: stats.groupName ?? l.t('welcome.fallbackName'),
    caption: l.t('card.verdict.caption', {
      people: num(l, stats.people.length),
      span: spanLabel(l, stats),
    }),
  });

  return cards;
}

/* ── Drawing ────────────────────────────────────────────────────────────── */

/**
 * The families the deck uses, resolved through the CSS variables so a card is
 * set in the same faces as the slide it came from. Read off the document rather
 * than hard-coded: `next/font` mangles the family name at build time, and the
 * mangled name is only knowable at runtime.
 */
function families(): { poster: string; serif: string; mono: string; sans: string; heb: string } {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    poster: read('--yap-poster', 'Impact, sans-serif'),
    serif: read('--yap-serif', 'Georgia, serif'),
    mono: read('--yap-mono', 'monospace'),
    sans: read('--yap-sans', 'system-ui, sans-serif'),
    heb: read('--yap-heb', 'system-ui, sans-serif'),
  };
}

/** The poster face has no Hebrew; a value in it is set in Heebo's heaviest. */
const HEBREW = /[֐-׿]/;

/**
 * Canvas will happily draw with a font it has not loaded yet, silently
 * substituting the default — and the card is generated in the same tick the
 * button is pressed, which is exactly when that happens. Asking for each face
 * at the size it will be used settles it before the first stroke.
 */
export async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const f = families();
  await Promise.all([
    document.fonts.load(`400 200px ${f.poster}`),
    document.fonts.load(`400 60px ${f.serif}`),
    document.fonts.load(`400 32px ${f.mono}`),
    document.fonts.load(`700 40px ${f.sans}`),
    document.fonts.load(`900 200px ${f.heb}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
}

/** Wraps text to a width, in whatever script it happens to be written in. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  // Japanese has no spaces to break on, so a word-based wrap returns one
  // enormous line. Where there are no spaces, break per character — which is
  // how the language is set anyway.
  const spaced = text.includes(' ');
  const parts = spaced ? text.split(/\s+/) : [...text];
  const joiner = spaced ? ' ' : '';
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    const next = line ? line + joiner + part : part;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = part;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks a single line until it fits, rather than letting it run off the card. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: string,
  start: number,
  maxWidth: number,
  min = 40,
): number {
  let size = start;
  for (;;) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth || size <= min) return size;
    size -= Math.max(4, Math.round(size * 0.06));
  }
}

export interface DrawOptions {
  /** A photo the reader supplied, drawn behind the type and graded down. */
  photo?: HTMLImageElement | null;
  scale?: number;
}

/**
 * Draws one card. Everything is a fraction of the 1080×1920 frame and then
 * scaled, so the picker's thumbnails and the shared PNG are the same picture.
 */
export function drawCard(
  canvas: HTMLCanvasElement,
  card: CardSpec,
  l: Localised,
  options: DrawOptions = {},
): void {
  const scale = options.scale ?? 1;
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ground = GROUNDS[card.ground];
  const f = families();
  const pad = 96 * scale;
  const inner = w - pad * 2;

  ctx.fillStyle = ground.bg;
  ctx.fillRect(0, 0, w, h);

  if (options.photo) {
    // Cover, then graded into the ground so the type still wins — the same
    // treatment the deck gives a group photo behind a slide.
    const img = options.photo;
    const ratio = Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();
    ctx.fillStyle = ground.bg;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  /*
    Everything hangs off the reading edge: the left of the card in a
    left-to-right report, the right in a right-to-left one. `x(o)` is `o`
    pixels in from that edge and `far(o)` is `o` pixels in from the other, and
    text is aligned towards whichever it is anchored to — so the same drawing
    code lays out a Hebrew card as a mirror of the English one rather than as
    an English card with Hebrew words pinned to its left.
  */
  const rtl = l.rtl;
  const x = (offset: number) => (rtl ? w - pad - offset : pad + offset);
  const far = (offset: number) => (rtl ? pad + offset : w - pad - offset);
  const near: CanvasTextAlign = rtl ? 'right' : 'left';
  const away: CanvasTextAlign = rtl ? 'left' : 'right';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = near;

  // ── Label, top corner, in mono ─────────────────────────────────────────
  ctx.fillStyle = ground.fg;
  ctx.globalAlpha = 0.7;
  ctx.font = `400 ${34 * scale}px ${f.mono}`;
  const label = card.label.toUpperCase();
  // Hebrew has no capitals to track; spaced out, it reads as separate letters.
  ctx.letterSpacing = `${(rtl ? 2 : 6) * scale}px`;
  ctx.fillText(label, x(0), pad + 40 * scale);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;

  let y = h * 0.42;

  if (card.rows && card.rows.length > 0) {
    // ── The leaderboard card ─────────────────────────────────────────────
    y = h * 0.3;
    const rowH = 150 * scale;
    const topShare = Math.max(...card.rows.map((r) => r.share), 0.0001);
    card.rows.forEach((row, i) => {
      const top = y + i * rowH;
      ctx.fillStyle = ground.fg;
      ctx.globalAlpha = i > 2 ? 0.7 : 1;

      ctx.font = `400 ${58 * scale}px ${f.poster}`;
      ctx.fillText(String(i + 1), x(0), top);

      const nameSize = fitFont(ctx, row.name, f.sans, '700', 58 * scale, inner - 300 * scale, 30);
      ctx.font = `700 ${nameSize}px ${f.sans}`;
      ctx.fillText(row.name, x(76 * scale), top);

      ctx.font = `400 ${36 * scale}px ${f.mono}`;
      ctx.textAlign = away;
      ctx.fillText(row.value, far(0), top);
      ctx.textAlign = near;

      // The bar is scaled to the leader, not to the whole chat: one person with
      // 18% of a sixteen-person group is the top of this board. It runs from
      // under the name towards the far edge, and fills from the name's side.
      const barY = top + 26 * scale;
      const barH = 14 * scale;
      const trackW = inner - 76 * scale;
      const trackX = rtl ? pad : pad + 76 * scale;
      const fillW = trackW * (row.share / topShare);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(trackX, barY, trackW, barH);
      ctx.globalAlpha = i > 2 ? 0.7 : 1;
      ctx.fillStyle = ground.accent;
      ctx.fillRect(rtl ? trackX + trackW - fillW : trackX, barY, fillW, barH);
      ctx.globalAlpha = 1;
    });
  } else {
    // ── Every other card: one enormous value ─────────────────────────────
    const isGlyph = Boolean(card.glyph);
    const hebrew = HEBREW.test(card.value);
    const family = isGlyph
      ? f.sans
      : hebrew
        ? f.heb
        : card.value.length > 12
          ? f.serif
          : f.poster;
    const weight = hebrew && !isGlyph ? '900' : '400';
    const startSize = isGlyph
      ? 420 * scale
      : card.value.length > 12
        ? 150 * scale
        : (hebrew ? 260 : 320) * scale;
    const size = fitFont(ctx, card.value, family, weight, startSize, inner, 48 * scale);
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = ground.fg;

    const lines = wrap(ctx, card.value, inner);
    const lineH = size * (isGlyph ? 1 : 0.92);
    y = h * 0.46 - ((lines.length - 1) * lineH) / 2;
    for (const line of lines) {
      ctx.fillText(line, x(0), y);
      y += lineH;
    }

    // ── Caption, in the serif, under the value ─────────────────────────
    if (card.caption) {
      ctx.font = `400 ${56 * scale}px ${f.serif}`;
      ctx.fillStyle = ground.fg;
      ctx.globalAlpha = 0.92;
      y += 40 * scale;
      for (const line of wrap(ctx, card.caption, inner).slice(0, 3)) {
        ctx.fillText(line, x(0), y);
        y += 68 * scale;
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── The mark, bottom corner ────────────────────────────────────────────
  ctx.font = `400 ${40 * scale}px ${f.poster}`;
  ctx.fillStyle = ground.fg;
  ctx.globalAlpha = 0.85;
  ctx.fillText(l.t('share.watermark'), x(0), h - pad);
  ctx.globalAlpha = 1;
}

/** The card as a PNG file, named so a photo roll is readable. */
export async function cardToFile(
  card: CardSpec,
  l: Localised,
  options: DrawOptions = {},
): Promise<File> {
  const canvas = document.createElement('canvas');
  drawCard(canvas, card, l, options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas produced no image');
  return new File([blob], `yapped-${card.id}.png`, { type: 'image/png' });
}
