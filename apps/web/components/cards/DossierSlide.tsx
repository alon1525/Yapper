'use client';

import { motion } from 'framer-motion';
import { useCopy } from '@/lib/copy';
import { lines, unbullet } from '@/lib/reportLines';
import type { Slide as SlideModel } from '@wrapped/core';
import { DOSSIER } from './Shell';
import { AnimalFace } from './AnimalFace';
import { usePhoto } from './photos';

/**
 * The dossier: one person's case file.
 *
 * The one written slide that keeps its own stock rather than the night ground.
 * A case file is a *paper* object — printed rules, a dotted leader, a portrait
 * plate — and the design's second deck leaves it exactly as it was while
 * re-skinning everything around it. So it lives in its own file, untouched by
 * that re-skin, and `ReportSlides` only decides when to show it.
 */

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
export function DossierSlide({
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
  const hebrew = copy.rtl || HEBREW.test(slide.title);

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
        className={`flex items-center justify-between text-[9.5px] uppercase ${copy.rtl ? 'tracking-[0.04em]' : 'tracking-[0.18em]'}`}
        style={{ fontFamily: 'var(--yap-mono)', color: DOSSIER.muted }}
      >
        <span>
          {exhibit
            ? copy.t('report.exhibit', { n: pad(exhibit.n), m: pad(exhibit.of) })
            : copy.t('report.exhibitOne')}
        </span>
        {facts[0] && <span>{copy.t('report.msgs', { n: String(facts[0].value) })}</span>}
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
              style={i > 0 ? { borderInlineStart: `1px solid ${DOSSIER.rule}` } : undefined}
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
                className="shrink-0 text-end text-[12px] font-medium tabular-nums"
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
            className={`text-[8.5px] uppercase ${copy.rtl ? 'tracking-[0.04em]' : 'tracking-[0.16em]'}`}
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
