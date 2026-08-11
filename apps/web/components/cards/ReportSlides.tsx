'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { DictionaryEntry, Quote, Slide as SlideModel } from '@wrapped/core';
import { Eyebrow, Headline, Panel, RegProse, Tag, type Backdrop } from './Shell';

/**
 * The discovered deck.
 *
 * Every string here is model-written in the group's own language, so every text
 * node carries `dir="auto"` — the same rule the premium slides follow, for the
 * same reason: a Hebrew paragraph inside an LTR block pushes its full stop,
 * dashes and trailing emoji to the wrong edge.
 *
 * Nothing names a colour. Each slide inherits its ground from `Slide` and reaches
 * for `--slide-accent` / `--slide-panel`, which is what lets one component render
 * a court case on lime and on navy without a second look.
 *
 * The formats below are *typography*, not layout engines. A court case is a
 * label-and-line list; breaking news is a shouted headline over a deadpan line.
 * Each one exists because a deck where forty slides share one shape reads as a
 * template no matter how good the writing is.
 */

/* ------------------------------------------------------------------ *
 * Receipts
 * ------------------------------------------------------------------ */

/**
 * The evidence drawer.
 *
 * Closed by default and small when open. The slide is the joke and has four
 * seconds to land; the receipts are for the person who reads it, does not
 * believe it, and taps. That person is the reason the whole verification stage
 * exists, and giving them nothing to tap wastes it.
 *
 * Confidence scores are deliberately not shown. "0.82 confident" invites an
 * argument about the number rather than about the messages, and the messages are
 * the actual answer.
 */
function Receipts({ quotes }: { quotes: Quote[] }) {
  const [open, setOpen] = useState(false);
  if (quotes.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase transition hover:opacity-80"
        style={{
          fontFamily: 'var(--yap-mono)',
          background: 'var(--slide-panel)',
          color: 'currentColor',
        }}
      >
        {open ? 'hide receipts' : `show receipts · ${quotes.length}`}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 flex flex-col gap-2 overflow-hidden"
        >
          {quotes.map((quote) => (
            <Panel key={`${quote.messageId}-${quote.text.slice(0, 12)}`}>
              <p
                dir="ltr"
                className="text-[9px] tracking-[0.12em] uppercase opacity-55"
                style={{ fontFamily: 'var(--yap-mono)' }}
              >
                {quote.speaker} · {quote.date}
              </p>
              <p dir="auto" className="mt-1 text-[13px] leading-relaxed opacity-85">
                {quote.text}
              </p>
            </Panel>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/** One quotation, pulled out at size, when a slide wants the line itself. */
function PulledQuote({ quote }: { quote: Quote }) {
  return (
    <blockquote dir="auto" className="mt-4">
      <Panel>
        <p className="text-[15px] leading-relaxed italic opacity-85">“{quote.text}”</p>
        <p
          dir="ltr"
          className="mt-2 text-[9px] tracking-[0.12em] uppercase opacity-50"
          style={{ fontFamily: 'var(--yap-mono)' }}
        >
          {quote.speaker} · {quote.date}
        </p>
      </Panel>
    </blockquote>
  );
}

/* ------------------------------------------------------------------ *
 * Formats
 * ------------------------------------------------------------------ */

/**
 * Splits a body into its lines.
 *
 * Several formats are written as short labelled lines — "Charge: …", "CEO: …",
 * "- fixed the thing". The writer returns them newline-separated inside one
 * `body` rather than as a structured array, because a schema with a different
 * shape per format is a schema a model gets wrong on the fourth slide. Parsing
 * back out here is the cheaper half of that trade.
 */
function lines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** `Label: value` when a line has one, otherwise the whole line as the value. */
function splitLabel(line: string): { label: string | null; value: string } {
  const idx = line.indexOf(':');
  // A colon late in a long line is punctuation, not a label.
  if (idx > 0 && idx <= 24) {
    return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  }
  return { label: null, value: line.replace(/^[-•*]\s*/, '') };
}

function LabelledLines({ body, mono = false }: { body: string; mono?: boolean }) {
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {lines(body).map((line, i) => {
        const { label, value } = splitLabel(line);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.07 * i, duration: 0.35 }}
          >
            {label && (
              <p
                dir="auto"
                className="text-[10px] tracking-[0.16em] uppercase"
                style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
              >
                {label}
              </p>
            )}
            <p
              dir="auto"
              className={`${label ? 'mt-0.5' : ''} text-[15px] leading-snug`}
              style={mono ? { fontFamily: 'var(--yap-mono)' } : undefined}
            >
              {value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function BulletLines({ body }: { body: string }) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {lines(body).map((line, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06 * i, duration: 0.3 }}
          dir="auto"
          className="flex gap-2 text-[14px] leading-snug"
        >
          <span aria-hidden style={{ color: 'var(--slide-accent)' }}>
            ·
          </span>
          <span>{line.replace(/^[-•*]\s*/, '')}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function Body({ children }: { children: string }) {
  return (
    <motion.p
      dir="auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-4 text-[15px] leading-[1.6] opacity-85"
    >
      {children}
    </motion.p>
  );
}

/* ------------------------------------------------------------------ *
 * The slide
 * ------------------------------------------------------------------ */

export function ReportSlide({ slide }: { slide: SlideModel }) {
  const quote = slide.quotes[0];

  switch (slide.format) {
    case 'court_case':
      return (
        <>
          <Eyebrow>In the matter of</Eyebrow>
          <Headline>{slide.title}</Headline>
          <LabelledLines body={slide.body} />
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'breaking_news':
      return (
        <>
          <Eyebrow>Breaking</Eyebrow>
          {/* The headline is shouted; the line underneath is not. That contrast
              is the entire joke of this format, so the two must not share a
              weight. */}
          <Headline>{slide.title.toLocaleUpperCase()}</Headline>
          {slide.subtitle && (
            <p dir="auto" className="mt-2 text-[13px] tracking-wide uppercase opacity-60">
              {slide.subtitle}
            </p>
          )}
          <Body>{slide.body}</Body>
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'scientific_report':
      return (
        <>
          <Eyebrow>Findings</Eyebrow>
          <Headline>{slide.title}</Headline>
          {slide.subtitle && (
            <p dir="auto" className="mt-1 text-[12px] italic opacity-60">
              {slide.subtitle}
            </p>
          )}
          <Body>{slide.body}</Body>
          {slide.stats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {slide.stats.map((stat) => (
                <Tag key={stat.label}>
                  {stat.label}: {String(stat.value)}
                </Tag>
              ))}
            </div>
          )}
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'company_structure':
      return (
        <>
          <Eyebrow>Org chart</Eyebrow>
          <Headline>{slide.title}</Headline>
          <LabelledLines body={slide.body} />
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'patch_notes':
      return (
        <>
          <Eyebrow>Patch notes{slide.subtitle ? ` · ${slide.subtitle}` : ''}</Eyebrow>
          <Headline>{slide.title}</Headline>
          <BulletLines body={slide.body} />
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'documentary':
      return (
        <>
          <Eyebrow>Field notes</Eyebrow>
          {/* Narration, so it gets the serif Reg's prose uses elsewhere. */}
          <RegProse>{slide.title}</RegProse>
          <Body>{slide.body}</Body>
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'eulogy':
      return (
        <>
          <Eyebrow>In loving memory</Eyebrow>
          <RegProse>{slide.title}</RegProse>
          <Body>{slide.body}</Body>
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'dictionary_entry':
      return (
        <>
          <Eyebrow>Glossary</Eyebrow>
          <Headline>{slide.title}</Headline>
          {slide.subtitle && (
            <p dir="auto" className="mt-1 text-[13px] italic opacity-60">
              {slide.subtitle}
            </p>
          )}
          <Body>{slide.body}</Body>
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'leaderboard':
      return (
        <>
          <Eyebrow>The standings</Eyebrow>
          <Headline>{slide.title}</Headline>
          <div className="mt-4 flex flex-col gap-2">
            {slide.stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.35 }}
                className="flex items-baseline justify-between gap-3"
              >
                <span dir="auto" className="truncate text-[15px] font-semibold">
                  {stat.label}
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 text-[15px]"
                  style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
                >
                  {String(stat.value)}
                </span>
              </motion.div>
            ))}
          </div>
          <Body>{slide.body}</Body>
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'timeline':
      return (
        <>
          <Eyebrow>{slide.subtitle || 'How it went'}</Eyebrow>
          <Headline>{slide.title}</Headline>
          <LabelledLines body={slide.body} mono />
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'receipt':
      return (
        <>
          <Eyebrow>Itemised</Eyebrow>
          <Headline>{slide.title}</Headline>
          <div style={{ fontFamily: 'var(--yap-mono)' }}>
            <BulletLines body={slide.body} />
          </div>
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'plain':
    default:
      return (
        <>
          <Eyebrow>{slide.subtitle || 'Noted'}</Eyebrow>
          <Headline>{slide.title}</Headline>
          <Body>{slide.body}</Body>
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );
  }
}

/** The inside-joke dictionary, which is a list rather than one big idea. */
export function DictionarySlide({ entries }: { entries: DictionaryEntry[] }) {
  return (
    <>
      <Eyebrow>Words that mean nothing outside this chat</Eyebrow>
      <div className="mt-4 flex flex-col gap-4">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.phrase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
          >
            <p dir="auto" className="text-xl leading-tight font-semibold">
              {entry.phrase}
            </p>
            {entry.partOfSpeech && (
              <p dir="auto" className="text-[12px] italic opacity-55">
                {entry.partOfSpeech}
              </p>
            )}
            <p dir="auto" className="mt-1 text-[14px] leading-relaxed opacity-80">
              {entry.definition}
            </p>
            {entry.origin && (
              <p dir="auto" className="mt-1 text-[12px] leading-relaxed opacity-55">
                {entry.origin}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Deck assembly
 * ------------------------------------------------------------------ */

export interface ReportDeckSlide {
  id: string;
  backdrop: Backdrop;
  render: () => React.ReactNode;
}

/**
 * Grounds rotate so that consecutive slides never share one, which is the rule
 * the statistics deck already follows. Prose formats are kept on the two grounds
 * that carry a serif well rather than joining the rotation.
 */
const ROTATION: Backdrop[] = ['lime', 'purple', 'orange', 'teal', 'pink', 'navy', 'red'];
const PROSE_GROUNDS: Backdrop[] = ['paper', 'ink'];
const PROSE_FORMATS = new Set(['documentary', 'eulogy']);

export function reportSlidesFor(
  slides: SlideModel[],
  dictionary: DictionaryEntry[] = [],
): ReportDeckSlide[] {
  const out: ReportDeckSlide[] = [];
  let rotation = 0;
  let prose = 0;

  for (const slide of slides) {
    const backdrop = PROSE_FORMATS.has(slide.format)
      ? PROSE_GROUNDS[prose++ % PROSE_GROUNDS.length]!
      : ROTATION[rotation++ % ROTATION.length]!;

    out.push({
      id: slide.id,
      backdrop,
      render: () => <ReportSlide slide={slide} />,
    });
  }

  // Three at a time: the entries are short but each is four lines, and a slide
  // in this deck does not scroll.
  const PER_SLIDE = 3;
  for (let page = 0; page * PER_SLIDE < dictionary.length; page++) {
    const slice = dictionary.slice(page * PER_SLIDE, (page + 1) * PER_SLIDE);
    out.push({
      id: `dictionary-${page}`,
      backdrop: page % 2 === 0 ? 'navy' : 'teal',
      render: () => <DictionarySlide entries={slice} />,
    });
  }

  return out;
}
