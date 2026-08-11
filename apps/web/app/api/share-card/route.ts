import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { NextResponse } from 'next/server';
import satori from 'satori';
import { z } from 'zod';
import { crossSite, forbiddenCrossSite } from '@/lib/guard';
import { checkRate, tooManyRequests } from '@/lib/rateLimit';

/**
 * Renders the 9:16 share card.
 *
 * This is a second, deliberately simplified layout — not the animated web card.
 * Satori implements a subset of CSS: flexbox and linear-gradients work, filters
 * and blend modes do not, and every font has to be handed over as a buffer.
 * Trying to reuse the on-screen components here does not work, so the card is
 * rebuilt from primitives that Satori actually supports.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const WIDTH = 1080;
const HEIGHT = 1920;

const BodySchema = z.object({
  groupName: z.string().max(80).nullable(),
  spanLabel: z.string().max(60),
  totalMessages: z.number(),
  topTalker: z.object({ name: z.string().max(40), share: z.number() }).nullable(),
  nightOwl: z.string().max(40).nullable(),
  topEmoji: z.string().max(20).nullable(),
  language: z.enum(['en', 'he', 'other']),
});

/**
 * Static instances only. Satori's font parser cannot read variable fonts —
 * it fails with an opaque `Cannot read properties of undefined` rather than a
 * useful message, so both files here are deliberately single-weight cuts.
 */
const fontDir = join(process.cwd(), 'assets', 'fonts');
let fontCache: { name: string; data: Buffer; weight: 700; style: 'normal' }[] | null = null;

function fonts() {
  if (!fontCache) {
    fontCache = [
      {
        name: 'Noto Sans',
        data: readFileSync(join(fontDir, 'NotoSans-Bold.ttf')),
        weight: 700,
        style: 'normal',
      },
      {
        // Hebrew has no coverage in the Latin font — without this every Hebrew
        // group name renders as tofu boxes.
        name: 'Noto Sans Hebrew',
        data: readFileSync(join(fontDir, 'NotoSansHebrew-Bold.ttf')),
        weight: 700,
        style: 'normal',
      },
    ];
  }
  return fontCache;
}

/**
 * Emoji are in neither text font, so Satori would draw tofu. They are supplied
 * as SVG images instead, read from `assets/emoji` on disk.
 *
 * Deliberately NOT fetched from a CDN. Rendering the card is something a free
 * user does, and the whole product claims nothing leaves their device — an
 * outbound request carrying an emoji that appeared in their chat would make
 * that claim false for the sake of one glyph. An emoji we do not have vendored
 * is dropped instead.
 */
const emojiDir = join(process.cwd(), 'assets', 'emoji');
const emojiCache = new Map<string, string | null>();

function loadEmoji(segment: string): string | undefined {
  if (emojiCache.has(segment)) return emojiCache.get(segment) ?? undefined;

  // Twemoji filenames omit the variation selector and join with hyphens.
  const codepoints = [...segment]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((c) => c !== 'fe0f')
    .join('-');

  try {
    const svg = readFileSync(join(emojiDir, `${codepoints}.svg`), 'utf8');
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    emojiCache.set(segment, dataUri);
    return dataUri;
  } catch {
    emojiCache.set(segment, null);
    return undefined;
  }
}

/**
 * Satori accepts a React-element-shaped object tree. Building it by hand rather
 * than with JSX keeps this file a plain `.ts` route and makes it obvious that
 * these are Satori primitives, not the app's React components.
 */
type Child = Node | string;
type Node = {
  type: string;
  props: Record<string, unknown> & { children?: Child | Child[] };
};

const el = (
  type: string,
  props: Record<string, unknown>,
  ...children: (Child | null | false)[]
): Node => ({
  type,
  props: { ...props, children: children.filter(Boolean) as Child[] },
});

function statRow(label: string, value: string, valueSize = 40) {
  return el(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingTop: 24,
        paddingBottom: 24,
        borderTop: '2px solid rgba(233,237,239,0.16)',
      },
    },
    el('span', { style: { fontSize: 30, color: 'rgba(233,237,239,0.55)' } }, label),
    el('span', { style: { fontSize: valueSize, color: '#E9EDEF' } }, value),
  );
}

/**
 * Satori cannot measure text and reflow, so an over-long number silently runs
 * off the edge of the card. Size it from the rendered width instead: digits in
 * Noto Sans Bold are about 0.6em, separators about 0.3em.
 */
function heroFontSize(text: string, available: number, max: number): number {
  const digits = (text.match(/\d/g) ?? []).length;
  const separators = text.length - digits;
  const emWidth = digits * 0.6 + separators * 0.3;
  return Math.floor(Math.min(max, available / Math.max(emWidth, 1)));
}

export async function POST(request: Request) {
  if (crossSite(request)) return forbiddenCrossSite();

  const rate = await checkRate('card', request);
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const numberFormat = new Intl.NumberFormat(body.language === 'he' ? 'he-IL' : 'en-GB');
  const formattedTotal = numberFormat.format(body.totalMessages);

  const rows: Node[] = [];
  if (body.topTalker) {
    rows.push(
      statRow('Biggest talker', `${body.topTalker.name} · ${Math.round(body.topTalker.share * 100)}%`),
    );
  }
  if (body.nightOwl) rows.push(statRow('Night owl', body.nightOwl));
  // The emoji is an inline SVG image sized from the font size, so it needs a
  // larger value than the text rows to read at the same visual weight.
  if (body.topEmoji) rows.push(statRow('Most used emoji', body.topEmoji, 58));

  const tree = el(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: WIDTH,
        height: HEIGHT,
        padding: 96,
        // Flat gradient only — Satori has no filters or blend modes.
        backgroundImage: 'linear-gradient(160deg, #0f6b53 0%, #07231f 55%, #070b0e 100%)',
        fontFamily: 'Noto Sans, Noto Sans Hebrew',
        color: '#E9EDEF',
      },
    },
    el(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      el(
        'span',
        { style: { fontSize: 28, letterSpacing: 6, color: '#53BDEB' } },
        'CHAT WRAPPED',
      ),
      el(
        'span',
        { style: { fontSize: 30, color: 'rgba(233,237,239,0.5)', marginTop: 14 } },
        body.spanLabel,
      ),
    ),

    el(
      'div',
      {
        // Takes the slack between header and stats so the hero sits optically
        // centred rather than being pushed around by the other two blocks.
        style: { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' },
      },
      el(
        'span',
        { style: { fontSize: 74, lineHeight: 1.05, color: '#E9EDEF' } },
        body.groupName ?? 'Our chat',
      ),
      el(
        'span',
        {
          style: {
            fontSize: heroFontSize(formattedTotal, WIDTH - 192, 200),
            lineHeight: 1,
            color: '#25D366',
            marginTop: 18,
          },
        },
        formattedTotal,
      ),
      el(
        'span',
        { style: { fontSize: 38, color: 'rgba(233,237,239,0.6)', marginTop: 10 } },
        'messages',
      ),
    ),

    el(
      'div',
      { style: { display: 'flex', flexDirection: 'column', width: '100%' } },
      ...rows,
      el(
        'span',
        { style: { fontSize: 26, color: 'rgba(233,237,239,0.35)', marginTop: 40 } },
        'Made from a WhatsApp export — never uploaded.',
      ),
    ),
  );

  try {
    const svg = await satori(tree as never, {
      width: WIDTH,
      height: HEIGHT,
      fonts: fonts(),
      loadAdditionalAsset: async (code, segment) =>
        code === 'emoji' ? (loadEmoji(segment) ?? '') : '',
    });

    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } })
      .render()
      .asPng();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[share-card] render failed', error);
    return NextResponse.json({ error: 'Could not render the card.' }, { status: 500 });
  }
}
