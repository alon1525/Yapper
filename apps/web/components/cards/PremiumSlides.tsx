'use client';

import { motion } from 'framer-motion';
import type { PremiumReport } from '@/lib/premiumPrompt';
import { Eyebrow, Headline, Panel, Poster, RegProse, type Backdrop } from './Shell';

/**
 * The paid slides.
 *
 * Every string on these slides is model-written in the chat's own language, so
 * every one of them carries `dir="auto"` — a Hebrew paragraph inside an LTR
 * block pushes its full stop, dashes and trailing emoji to the wrong edge.
 * There are a dozen such nodes on a character slide alone.
 *
 * Nothing here names a colour. Each slide inherits its ground from `Slide` and
 * reaches for `--slide-accent` / `--slide-panel`, which is what lets the same
 * markup sit on lime and on navy without a second look.
 */

/*
  Both paginations are set by what fits a phone, not by what looks balanced in
  a schema. Measured on a 430×932 screen with the column at its real 366px
  measure: four character cards run 1,084px against 740px of usable height, and
  eight awards run 1,088px. A slide in this deck does not scroll — it is tapped
  — so anything past the fold is simply not read.

  Character cards are much the taller of the two — five fields each, three of
  them prose — so they page in twos and awards in fours. Three cards still ran
  106px past the fold on a real report, and the card is the piece each person
  screenshots for themselves, so it is the last thing that should be clipped.
*/
const CARDS_PER_SLIDE = 2;
const AWARDS_PER_SLIDE = 4;

export interface PremiumSlide {
  id: string;
  backdrop: Backdrop;
  render: () => React.ReactNode;
}

/** Memories are Reg narrating, so they get the serif the free AI slide uses. */
function MemorySlide({
  memory,
  index,
}: {
  memory: PremiumReport['memories'][number];
  index: number;
}) {
  return (
    <>
      <Eyebrow>Remember when · {index + 1}</Eyebrow>
      <RegProse>{memory.title}</RegProse>
      <motion.p
        dir="auto"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-4 text-[14.5px] leading-[1.6] opacity-85"
      >
        {memory.story}
      </motion.p>
      {memory.quote && (
        <motion.blockquote
          dir="auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-5"
        >
          <Panel>
            <p className="text-[15px] leading-relaxed italic opacity-85">“{memory.quote}”</p>
          </Panel>
        </motion.blockquote>
      )}
    </>
  );
}

function CharacterSlide({
  characters,
  page,
  pages,
}: {
  characters: PremiumReport['characters'];
  page: number;
  pages: number;
}) {
  return (
    <>
      <Eyebrow>
        The cast · {page + 1} of {pages}
      </Eyebrow>
      <div className="mt-3 flex flex-col gap-2.5">
        {characters.map((character, i) => (
          <motion.div
            key={character.sender}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
          >
            <Panel>
              <p dir="auto" className="text-lg leading-tight font-semibold">
                {character.sender}
              </p>
              <p
                dir="auto"
                className="mt-0.5 text-[10px] tracking-[0.16em] uppercase"
                style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
              >
                {character.title}
              </p>
              <p dir="auto" className="mt-2 text-sm leading-relaxed opacity-80">
                {character.description}
              </p>
              <p dir="auto" className="mt-2 text-sm opacity-65 italic">
                “{character.catchphrase}”
              </p>
              <p dir="auto" className="mt-2 text-[13px] leading-relaxed opacity-55">
                {character.verdict}
              </p>
            </Panel>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function AwardsSlide({
  awards,
  page,
  pages,
}: {
  awards: PremiumReport['awards'];
  page: number;
  pages: number;
}) {
  return (
    <>
      <Eyebrow>
        The awards{pages > 1 ? ` · ${page + 1} of ${pages}` : ''}
      </Eyebrow>
      {/* The headline is the joke, and a joke does not get told twice — later
          pages go straight to the winners. */}
      {page === 0 && <Headline>Nobody asked for these</Headline>}
      <div className="mt-5 flex flex-col gap-3.5">
        {awards.map((award, i) => (
          <motion.div
            key={award.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.4 }}
          >
            <p
              dir="auto"
              className="text-[10px] tracking-[0.16em] uppercase"
              style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
            >
              {award.name}
            </p>
            <p dir="auto" className="mt-1 text-xl leading-tight font-semibold">
              {award.winner}
            </p>
            <p dir="auto" className="mt-1 text-sm leading-relaxed opacity-70">
              {award.reason}
            </p>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function ErasSlide({ eras }: { eras: PremiumReport['eras'] }) {
  return (
    <>
      <Eyebrow>Your years, charted</Eyebrow>
      <div className="mt-4 flex flex-col gap-2.5">
        {eras.map((era, i) => (
          <motion.div
            key={era.year}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35 }}
            className="flex gap-3"
          >
            <span
              className="w-11 shrink-0 pt-1 text-sm"
              style={{ fontFamily: 'var(--yap-mono)', color: 'var(--slide-accent)' }}
            >
              &apos;{String(era.year).slice(2)}
            </span>
            <div className="min-w-0">
              <p dir="auto" className="font-semibold">
                {era.title}
              </p>
              <p dir="auto" className="mt-0.5 text-sm leading-relaxed opacity-70">
                {era.summary}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

/**
 * The closing paragraph, alone on its ground.
 *
 * It used to sit under the years, which made the deck's last word a footnote to
 * a table — and on a phone it was the part that fell off the bottom. It is the
 * one piece of the report written about the group as a whole, so it gets the
 * screen.
 */
function NarrativeSlide({ narrative }: { narrative: string }) {
  return (
    <>
      <Eyebrow>What it all adds up to</Eyebrow>
      <RegProse>{narrative}</RegProse>
    </>
  );
}

/**
 * Flattens a report into deck slides. Character cards go four to a slide rather
 * than one each: eighteen consecutive single-person slides is a chore to swipe
 * through, and four at a time is still one screen of large type.
 */
export function premiumSlidesFor(report: PremiumReport, demo = false): PremiumSlide[] {
  const slides: PremiumSlide[] = [];

  // Memories are Reg's prose, so they alternate between the two grounds that
  // carry a serif well rather than joining the colour rotation.
  const memoryGrounds: Backdrop[] = ['paper', 'ink'];
  const castGrounds: Backdrop[] = ['purple', 'navy'];

  report.memories.forEach((memory, i) => {
    slides.push({
      id: `premium-memory-${i}`,
      backdrop: memoryGrounds[i % memoryGrounds.length]!,
      render: () => (
        <>
          {/* Labelled on the first paid slide only: enough that nobody mistakes
              a deterministic sample for written work, not so much that it
              interrupts every screen of the deck. */}
          {demo && i === 0 && (
            <p
              className="mb-4 w-fit rounded-lg px-3 py-1.5 text-[11px] leading-relaxed opacity-70"
              style={{ fontFamily: 'var(--yap-mono)', background: 'var(--slide-panel)' }}
            >
              Sample report — no API key configured, so this was built from your
              statistics rather than written.
            </p>
          )}
          <MemorySlide memory={memory} index={i} />
        </>
      ),
    });
  });

  const pages = Math.ceil(report.characters.length / CARDS_PER_SLIDE);
  for (let page = 0; page < pages; page++) {
    const slice = report.characters.slice(page * CARDS_PER_SLIDE, (page + 1) * CARDS_PER_SLIDE);
    slides.push({
      id: `premium-cast-${page}`,
      backdrop: castGrounds[page % castGrounds.length]!,
      render: () => <CharacterSlide characters={slice} page={page} pages={pages} />,
    });
  }

  const awardPages = Math.ceil(report.awards.length / AWARDS_PER_SLIDE);
  const awardGrounds: Backdrop[] = ['orange', 'red'];
  for (let page = 0; page < awardPages; page++) {
    const slice = report.awards.slice(page * AWARDS_PER_SLIDE, (page + 1) * AWARDS_PER_SLIDE);
    slides.push({
      id: `premium-awards-${page}`,
      backdrop: awardGrounds[page % awardGrounds.length]!,
      render: () => <AwardsSlide awards={slice} page={page} pages={awardPages} />,
    });
  }

  if (report.eras.length > 1) {
    slides.push({
      id: 'premium-eras',
      backdrop: 'teal',
      render: () => <ErasSlide eras={report.eras} />,
    });
  }

  slides.push({
    id: 'premium-narrative',
    backdrop: 'paper',
    render: () => <NarrativeSlide narrative={report.narrative} />,
  });

  return slides;
}
