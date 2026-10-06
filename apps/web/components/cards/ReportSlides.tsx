'use client';

import { motion } from 'framer-motion';
import { useCopy } from '@/lib/copy';
import { useState } from 'react';
import type { DictionaryEntry, Quote, Slide as SlideModel } from '@wrapped/core';
import { DOSSIER, Eyebrow, Headline, Panel, RegProse, Tag, type Backdrop } from './Shell';
import { AnimalFace } from './AnimalFace';
import { usePhoto } from './photos';

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

/** A line without the bullet a writer sometimes puts in front of it anyway. */
function unbullet(line: string): string {
  return line.replace(/^[-•*·]\s*/, '');
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
  // A two-line headline at poster leading sits almost on top of the first
  // label at the old margin; the charge needs air under the name of the crime.
  return (
    <div className="mt-6 flex flex-col gap-2.5">
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
 * The dossier
 * ------------------------------------------------------------------ */

const HEBREW = /[֐-׿]/;

/** Their photo, or the animal that stands in for it. Never both, never neither. */
function Plate({ name, accent }: { name: string; accent: string }) {
  const url = usePhoto(name);

  return (
    <div
      aria-hidden="true"
      className="relative grid h-[120px] w-[96px] shrink-0 place-items-center overflow-hidden"
      style={{ background: DOSSIER.plate }}
    >
      {url ? (
        // Greyscale, as the design has it: a case file does not carry a colour
        // photograph, and the accent is the only coloured thing on the sheet.
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${url})`, filter: 'grayscale(1) contrast(1.1)' }}
        />
      ) : (
        /*
          Not greyscaled with the photos: the design's own report draws the
          stand-in face in colour, and a grey animal on grey stock is a smudge.

          Its own fur rather than the exhibit accent, though the design passes
          the accent — an accent is chosen to stamp a cream sheet, so it is dark
          by construction, and every animal wears its eyes and brows as ink
          drawn onto fur. `#1D3A2A` behind them is 1.3:1. The accent still
          stamps this plate, along its bottom edge, and the fur is the one the
          same person wears on every other slide.
        */
        <AnimalFace name={name} size={96} height={120} radius="0" bg={DOSSIER.plate} />
      )}
      {/* A hairline in the accent along the bottom edge, so the plate belongs to
          the same document as the rule under the name. */}
      <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: accent }} />
    </div>
  );
}

/**
 * One person's case file.
 *
 * A name, an epithet, three measured facts, three or four beats of roast, a
 * few invented ratings, and the official title at the foot. The beats are the
 * card now. They used to be five measured bars with a renamed axis beside each
 * — "Explanation addiction ——— 97" — which were honest and which nobody
 * reading the card could parse: a number out of a hundred, of what, against
 * whom. The measurements still exist and still reach the writer, as material
 * for what is unusual about this person; what the card shows is the sentence
 * that material produced, in words, with the person's own lines quoted back at
 * them.
 *
 * The whole sheet is laid out top-to-bottom with the official title pushed to
 * the foot by `mt-auto`, exactly as the design has it — the verdict sits at the
 * bottom of a case file, under everything that argues for it.
 */
function DossierSlide({
  slide,
  exhibit,
}: {
  slide: SlideModel;
  /** Position among the deck's dossiers, for the "Exhibit 02 of 05" line. */
  exhibit?: { n: number; of: number };
}) {
  const copy = useCopy();
  const name = slide.people[0] ?? slide.title;
  const accent = DOSSIER.accents[((exhibit?.n ?? 1) - 1) % DOSSIER.accents.length]!;
  // The first three, in the order the planner set: how much they said, how they
  // say it, how often they turn up. The rest were prose material.
  const facts = slide.stats.slice(0, 3);
  // The roast, one beat per line. Four is the most the card holds.
  const beats = lines(slide.body).map(unbullet).slice(0, 4);
  const verdicts = (slide.jokeScores ?? []).slice(0, 5);

  const pad = (n: number) => String(n).padStart(2, '0');
  const hebrew = HEBREW.test(slide.title);

  return (
    <div
      className="mx-auto flex w-full max-w-[380px] flex-col"
      style={{
        color: DOSSIER.ink,
        /*
          What pushes the verdict to the foot of the sheet, the way the design
          does — `mt-auto` needs somewhere to push against.

          Capped by the viewport rather than fixed at 520px, because `Slide`
          spends 12rem on padding: a flat 520 needs a 712px-tall screen, and on
          a 375×667 phone the card would run past the fold. `Slide` is
          `overflow-y-auto`, so it would not clip — it would scroll, and this
          deck is tapped, never scrolled. Below that height the sheet simply
          sits at its natural height and the verdict follows the bars.
        */
        minHeight: 'min(520px, calc(100dvh - 13rem))',
      }}
    >
      <div
        className="flex items-center justify-between text-[9.5px] tracking-[0.18em] uppercase"
        style={{ fontFamily: 'var(--yap-mono)', color: DOSSIER.muted }}
      >
        <span>{exhibit ? `Exhibit ${pad(exhibit.n)} of ${pad(exhibit.of)}` : 'Exhibit'}</span>
        {facts[0] && <span dir="ltr">{String(facts[0].value)} msgs</span>}
      </div>
      <div className="mt-[9px] h-px" style={{ background: DOSSIER.rule }} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-4 flex gap-3.5"
      >
        <Plate name={name} accent={accent} />
        <div className="min-w-0">
          <p
            dir="auto"
            className={hebrew ? 'text-[27px] leading-[0.96]' : 'text-[30px] leading-[0.92] uppercase'}
            style={{
              fontFamily: hebrew ? 'var(--yap-heb)' : 'var(--yap-poster)',
              fontWeight: hebrew ? 900 : 400,
            }}
          >
            {slide.title}
          </p>
          <div className="mt-2 h-1 w-[34px]" style={{ background: accent }} />
          {slide.subtitle && (
            <p
              dir="auto"
              className="mt-2.5 text-[17px] leading-[1.14] italic"
              style={{ fontFamily: 'var(--yap-serif)', color: DOSSIER.body }}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      </motion.div>

      {facts.length > 0 && (
        <div
          className="mt-4 flex"
          style={{ borderTop: `1px solid ${DOSSIER.rule}`, borderBottom: `1px solid ${DOSSIER.rule}` }}
        >
          {facts.map((fact, i) => (
            <div
              key={fact.label}
              className="min-w-0 flex-1 px-2 py-[9px]"
              // No divider before the first cell: the strip is columns inside one
              // ruled band, not three boxes pushed together.
              style={i > 0 ? { borderLeft: `1px solid ${DOSSIER.rule}` } : undefined}
            >
              <p
                dir="auto"
                className="truncate text-[14px] font-medium tabular-nums"
                style={{ fontFamily: 'var(--yap-mono)' }}
              >
                {String(fact.value)}
              </p>
              <p
                dir="auto"
                className="mt-[3px] truncate text-[8px] tracking-[0.08em] uppercase"
                style={{ fontFamily: 'var(--yap-mono)', color: DOSSIER.muted }}
              >
                {fact.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {beats.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {beats.map((beat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.35 }}
              className="flex gap-2.5"
            >
              {/* The exhibit's one coloured mark, repeated: the same square
                  that stamps the plate and underlines the name. */}
              <span
                aria-hidden="true"
                className="mt-[8px] h-[6px] w-[6px] shrink-0"
                style={{ background: accent }}
              />
              <p
                dir="auto"
                className="text-[15px] leading-[1.42]"
                style={{ fontFamily: 'var(--yap-serif)', textWrap: 'pretty' }}
              >
                {beat}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invented ratings. Deliberately drawn without a bar: a bar is the visual
          grammar of something measured, and these are jokes. `∞/100` has no
          width, and giving one a track would be the product claiming it counted
          something it did not. Rules on the right, like a scoreboard. */}
      {verdicts.length > 0 && (
        <div className="mt-3 flex flex-col">
          {verdicts.map((verdict, i) => (
            <motion.div
              key={`${verdict.label}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + (beats.length + i) * 0.08, duration: 0.3 }}
              className="flex items-baseline gap-1.5 py-1.5"
              style={{ borderBottom: `1px dotted ${DOSSIER.leader}` }}
            >
              <span dir="auto" className="text-[12.5px] leading-tight" style={{ color: DOSSIER.body }}>
                {verdict.label}
              </span>
              <span className="flex-1" />
              <span
                dir="ltr"
                className="shrink-0 text-right text-[12px] font-medium tabular-nums"
                style={{ fontFamily: 'var(--yap-mono)', color: accent }}
              >
                {verdict.value}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {slide.closer && (
        <div className="mt-auto pt-3">
          <p
            dir="auto"
            className="text-[8.5px] tracking-[0.16em] uppercase"
            style={{ fontFamily: 'var(--yap-mono)', color: DOSSIER.muted }}
          >
            {copy.t('report.officialTitle')}
          </p>
          <p
            dir="auto"
            className="mt-[5px] text-[19px] leading-[1.14]"
            style={{ fontFamily: 'var(--yap-serif)', textWrap: 'pretty' }}
          >
            {slide.closer}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The slide
 * ------------------------------------------------------------------ */

export function ReportSlide({
  slide,
  exhibit,
}: {
  slide: SlideModel;
  exhibit?: { n: number; of: number };
}) {
  const copy = useCopy();
  const quote = slide.quotes[0];

  switch (slide.format) {
    case 'profile':
      return <DossierSlide slide={slide} exhibit={exhibit} />;

    case 'court_case': {
      // The defendant is named on the eyebrow so the headline can be the
      // charge itself. "The Group v. Person E" told the reader there was a case
      // and nothing about what it was for — the writer is now told to put the
      // act in the title and this line puts the name above it.
      const defendant = slide.people.length === 1 ? slide.people[0]! : null;
      return (
        <>
          <Eyebrow>
            {defendant
              ? copy.t('report.caseAgainst', { name: defendant })
              : copy.t('report.matterOf')}
          </Eyebrow>
          <Headline>{slide.title}</Headline>
          <LabelledLines body={slide.body} />
          {quote && <PulledQuote quote={quote} />}
          <Receipts quotes={slide.quotes} />
        </>
      );
    }

    case 'breaking_news':
      return (
        <>
          <Eyebrow>{copy.t('report.breaking')}</Eyebrow>
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
          <Eyebrow>{copy.t('report.findings')}</Eyebrow>
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
          <Eyebrow>{copy.t('report.orgChart')}</Eyebrow>
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
          <Eyebrow>{copy.t('report.fieldNotes')}</Eyebrow>
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
          <Eyebrow>{copy.t('report.memoriam')}</Eyebrow>
          <RegProse>{slide.title}</RegProse>
          <Body>{slide.body}</Body>
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'dictionary_entry':
      return (
        <>
          <Eyebrow>{copy.t('report.glossary')}</Eyebrow>
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
          <Eyebrow>{copy.t('report.standings')}</Eyebrow>
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
          <Eyebrow>{slide.subtitle || copy.t('report.howItWent')}</Eyebrow>
          <Headline>{slide.title}</Headline>
          <LabelledLines body={slide.body} mono />
          <Receipts quotes={slide.quotes} />
        </>
      );

    case 'receipt':
      return (
        <>
          <Eyebrow>{copy.t('report.itemised')}</Eyebrow>
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
  const copy = useCopy();
  return (
    <>
      <Eyebrow>{copy.t('report.insideWords')}</Eyebrow>
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

  // Numbered across the whole deck rather than per slide, so a card can say
  // "Exhibit 03 of 05" and mean it. Counted up front because the third dossier
  // has to know how many follow it.
  const dossiers = slides.filter((s) => s.format === 'profile').length;
  let dossier = 0;

  for (const slide of slides) {
    if (slide.format === 'profile') {
      const exhibit = { n: ++dossier, of: dossiers };
      out.push({
        // Always the same stock — a case file that changed colour every person
        // would be a set of posters, not a file. The accent rotates instead.
        id: slide.id,
        backdrop: 'paper',
        render: () => <ReportSlide slide={slide} exhibit={exhibit} />,
      });
      continue;
    }

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
