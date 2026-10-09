'use client';

import { motion } from 'framer-motion';
import { Fragment, useState, type ReactNode } from 'react';
import type { DictionaryEntry, Quote, Slide as SlideModel } from '@wrapped/core';
import { useCopy } from '@/lib/copy';
import {
  courtLines,
  lines,
  orgLines,
  receiptLine,
  splitLabel,
  splitTitle,
  timelineLines,
} from '@/lib/reportLines';
import { DossierSlide } from './DossierSlide';
import { Portrait } from './photos';
import {
  Badge,
  Bubble,
  Glass,
  GlassCard,
  INK,
  Mono,
  Narration,
  NIGHT,
  Note,
  Poster,
  Prose,
  Stamp,
  Sticker,
  TONES,
  big,
  fade,
  punch,
  slideIn,
  up,
  upSm,
  type BloomAt,
  type Dress,
  type Tone,
} from './ReportGround';
import { AnimatedNumber, Eyebrow, posterFace, type Backdrop, type SlideAlign } from './Shell';

/**
 * The written deck.
 *
 * Every string here is model-written in the group's own language, so every text
 * node carries `dir="auto"`: a Hebrew paragraph inside an LTR block pushes its
 * full stop, dashes and trailing emoji to the wrong edge.
 *
 * Thirteen formats, thirteen shapes. This file used to draw eleven of them as
 * the same thing — an eyebrow, a headline, a paragraph — on a rotation of flat
 * colours, and a reader who had paid for it called it what it was: a template
 * with the words swapped. The design's second deck is the answer. Every slide
 * sits on the same near-black with one colour blooming in from an edge, and
 * each format is its own object: a court case is a docket with a rubber stamp,
 * a receipt is a till receipt, a timeline is the chat itself, breaking news has
 * a ticker. The dossier keeps its paper and is the one slide this file does not
 * draw; see `DossierSlide`.
 *
 * Nothing here is a layout engine. Each format is typography and one or two
 * props — a tilt, a tone, a side — and the same seven colours do all of it.
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
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  if (quotes.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-full border px-3 py-1.5 text-[10px] uppercase transition hover:opacity-80 ${copy.rtl ? 'tracking-[0.04em]' : 'tracking-[0.14em]'}`}
        style={{
          fontFamily: 'var(--yap-mono)',
          background: 'rgb(255 255 255 / 0.10)',
          borderColor: 'rgb(255 255 255 / 0.16)',
          color: 'currentColor',
        }}
      >
        {open
          ? copy.t('report.hideReceipts')
          : copy.t('report.showReceipts', { n: quotes.length })}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 flex flex-col gap-1.5 overflow-hidden"
        >
          {quotes.map((quote, i) => (
            <Fragment key={`${quote.messageId}-${quote.text.slice(0, 12)}`}>
              <Bubble side={i % 2 ? 'end' : 'start'} delay={0.05 * i}>
                {quote.text}
              </Bubble>
              <Mono dir="ltr" className={`text-[9px] opacity-50 ${i % 2 ? 'self-end' : 'self-start'}`}>
                {quote.speaker} · {quote.date}
              </Mono>
            </Fragment>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/** One quotation as a message bubble, with who sent it underneath. */
function PulledQuote({
  quote,
  tone,
  side = 'end',
  delay = 0.7,
}: {
  quote: Quote;
  tone: Tone;
  side?: 'start' | 'end';
  delay?: number;
}) {
  return (
    <div className="mt-4 flex flex-col gap-1">
      <Bubble side={side} tone={side === 'end' ? tone : 'glass'} delay={delay}>
        {quote.text}
      </Bubble>
      <Mono
        dir="ltr"
        className={`text-[9px] opacity-50 ${side === 'end' ? 'self-end' : 'self-start'}`}
      >
        {quote.speaker} · {quote.date}
      </Mono>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

/** A person named in an eyebrow: their face, then their name. */
function Subject({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Portrait name={name} size={22} />
      <span dir="auto">{children ?? name}</span>
    </span>
  );
}

/**
 * A title with its turn in colour. `splitTitle` finds the turn; this draws the
 * head in white and the tail in the slide's tone, or on a stamp when the slide
 * wants the louder version.
 */
function Title({
  title,
  tone,
  size = 'lg',
  stamp = false,
  delay = 0.1,
}: {
  title: string;
  tone: Tone;
  size?: 'lg' | 'md';
  stamp?: boolean;
  delay?: number;
}) {
  const { head, tail } = splitTitle(title);
  return (
    <motion.div {...up(delay)}>
      <Poster text={title} size={size}>
        {head && (
          <>
            {head}
            <br />
          </>
        )}
        {stamp ? <Stamp tone={tone}>{tail}</Stamp> : <span style={{ color: NIGHT[tone] }}>{tail}</span>}
      </Poster>
    </motion.div>
  );
}

/** The invented ratings on a group slide, as the design's sticker pills. */
function Verdicts({ scores, tone, delay = 0.3 }: { scores: SlideModel['jokeScores']; tone: Tone; delay?: number }) {
  if (!scores || scores.length === 0) return null;
  const start = Math.max(0, TONES.indexOf(tone));
  const tilt = [-2, 1.5, -1, 2, -1.5];
  return (
    <div className="mt-4 flex flex-col gap-[7px]">
      {scores.slice(0, 5).map((score, i) => (
        <Sticker
          key={`${score.label}-${i}`}
          label={score.label}
          value={score.value}
          tone={i === 4 ? 'white' : TONES[(start + i) % TONES.length]!}
          side={i % 2 ? 'end' : 'start'}
          rotate={tilt[i % tilt.length]!}
          delay={delay + i * 0.13}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Formats
 * ------------------------------------------------------------------ */

/**
 * The cover. The design's: a badge naming the group, the total at poster size
 * in the tone, the writer's line with its last beat on a white stamp, and the
 * prose under it. Bottom-aligned, over the group photo when there is one.
 */
function OpeningSlide({
  slide,
  tone,
  group,
}: {
  slide: SlideModel;
  tone: Tone;
  group?: Context;
}) {
  const copy = useCopy();
  const total = slide.stats.find((s) => typeof s.value === 'number');

  return (
    <>
      {(group?.groupName || group?.participantCount) && (
        <Badge tone={tone}>
          {group.groupName && (
            <Mono className="truncate normal-case">{group.groupName}</Mono>
          )}
          {group.participantCount ? (
            <Mono className="shrink-0 opacity-60">
              {group.groupName ? '· ' : ''}
              {copy.t('report.suspects', { n: group.participantCount })}
            </Mono>
          ) : null}
        </Badge>
      )}

      {total && typeof total.value === 'number' && (
        <motion.div {...big(0.15)} className="mt-4">
          <div dir="ltr">
            <Poster size="xl" tone={tone}>
              <span style={{ textShadow: `0 20px 60px color-mix(in srgb, ${NIGHT[tone]} 35%, transparent)` }}>
                <AnimatedNumber value={total.value} locale={copy.locale} />
              </span>
            </Poster>
          </div>
        </motion.div>
      )}

      <div className="mt-2.5">
        <Title title={slide.title} tone="white" size="md" stamp delay={0.35} />
      </div>

      {slide.body && (
        <Prose delay={0.7} className="mt-5 max-w-[28ch] text-[15.5px]">
          {slide.body}
        </Prose>
      )}
    </>
  );
}

/** The closing frame, should the writer ever be asked for one. */
function FinaleSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  return (
    <>
      <Eyebrow>{slide.subtitle || copy.t('report.noted')}</Eyebrow>
      <Title title={slide.title} tone={tone} stamp />
      {slide.body && (
        <Prose delay={0.75} className="mt-4 max-w-[30ch]">
          {slide.body}
        </Prose>
      )}
      {slide.closer && (
        <Narration size="lg" delay={0.95} className="mt-3.5">
          {slide.closer}
        </Narration>
      )}
      <motion.div
        {...punch(1.2, -1)}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-white py-2 ps-2 pe-3.5"
        style={{ color: '#0B0B0F' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reg.png" alt="" className="block h-5 w-5 rounded-full" />
        <Mono>{copy.t('report.roastedBy')}</Mono>
      </motion.div>
    </>
  );
}

/** The poster. A headline with its turn in colour, the verdicts, the line. */
function PlainSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const subject = slide.people.length === 1 ? slide.people[0]! : null;
  const quote = slide.quotes[0];
  return (
    <>
      <Eyebrow>
        {subject ? <Subject name={subject}>{slide.subtitle || subject}</Subject> : slide.subtitle || copy.t('report.noted')}
      </Eyebrow>
      <Title title={slide.title} tone={tone} />
      <Verdicts scores={slide.jokeScores} tone={tone} />
      {slide.body && <Prose delay={0.45} className="mt-4">{slide.body}</Prose>}
      {quote && <PulledQuote quote={quote} tone={tone} />}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/**
 * The docket. The charge as a headline, the evidence as the message it was, the
 * verdict as a rubber stamp, the sentence on a note. Read by position: the
 * writer is briefed to return the four lines in that order, and the labels are
 * in whatever language the deck is in.
 */
function CourtCaseSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const { charge, evidence, verdict, sentence } = courtLines(slide.body);
  const defendant = slide.people.length === 1 ? slide.people[0]! : null;
  const quote = slide.quotes[0];
  const face = posterFace(verdict?.value ?? '', copy.rtl);

  return (
    <>
      <Eyebrow>
        {defendant ? (
          <Subject name={defendant}>{copy.t('report.caseAgainst', { name: defendant })}</Subject>
        ) : (
          copy.t('report.matterOf')
        )}
      </Eyebrow>
      <motion.div {...up(0.1)}>
        <Poster size="md">{slide.title}</Poster>
      </motion.div>

      <div className="mt-5 flex flex-col gap-3.5">
        {charge && (
          <motion.div {...slideIn(0.3, copy.rtl)}>
            {charge.label && <Mono tone={tone}>{charge.label}</Mono>}
            <p dir="auto" className="mt-0.5 text-[15px] leading-snug" style={{ textWrap: 'pretty' }}>
              {charge.value}
            </p>
          </motion.div>
        )}

        {evidence && (
          <div className="flex flex-col gap-1">
            {evidence.label && <Mono className="opacity-60">{evidence.label}</Mono>}
            <Bubble side="start" delay={0.45} className="text-[13.5px]">
              {evidence.value}
            </Bubble>
          </div>
        )}

        {verdict && (
          <motion.div {...punch(0.65, -4)} className="self-end">
            {verdict.label && (
              <Mono className="mb-1 block text-end opacity-60">{verdict.label}</Mono>
            )}
            {/* A rubber stamp: a double border in the tone, inked unevenly by
                the tilt. The one place on the docket the colour is loud. */}
            <div
              dir="auto"
              className="rounded-md border-[3px] px-3 py-1 text-[clamp(20px,6.5vw,28px)] leading-none"
              style={{
                ...face,
                textTransform: face.fontFamily === 'var(--yap-heb)' ? undefined : 'uppercase',
                borderColor: NIGHT[tone],
                color: NIGHT[tone],
                outline: `2px solid ${NIGHT[tone]}`,
                outlineOffset: 3,
                maxWidth: '18ch',
                textWrap: 'balance',
              }}
            >
              {verdict.value}
            </div>
          </motion.div>
        )}

        {sentence && (
          <div className="flex flex-col gap-1">
            {sentence.label && <Mono className="opacity-60">{sentence.label}</Mono>}
            <div>
              <Note tone="orange" rotate={-1.5} delay={0.9}>
                {sentence.value}
              </Note>
            </div>
          </div>
        )}
      </div>

      {quote && <PulledQuote quote={quote} tone={tone} side="start" delay={1.05} />}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** A tabloid front page: ticker, live dot, shouted headline, deadpan line. */
function BreakingNewsSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const quote = slide.quotes[0];
  const ticker = `${copy.t('report.breaking')} ● ${slide.subtitle || slide.title} ● `;

  return (
    <>
      {/* Breaks out of the column's gutter on a phone, which is the screen it
          was drawn for. One copy of the text per half so the loop has no seam. */}
      <motion.div
        {...fade(0)}
        className="-mx-7 overflow-hidden py-1.5 sm:-mx-14"
        style={{ background: NIGHT[tone], color: INK[tone] }}
        aria-hidden="true"
      >
        <div dir="ltr" className="yap-ticker flex w-max whitespace-nowrap">
          {[0, 1].map((half) => (
            <span
              key={half}
              className="text-[10px] font-bold tracking-[0.18em] uppercase"
              style={{ fontFamily: 'var(--yap-mono)' }}
            >
              {ticker.repeat(4)}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div {...upSm(0.1)} className="mt-5 flex items-center gap-2">
        <span className="yap-blink h-2 w-2 rounded-full" style={{ background: NIGHT[tone] }} />
        <Mono tone={tone}>{copy.t('report.live')}</Mono>
        {slide.subtitle && <Mono className="truncate opacity-60">· {slide.subtitle}</Mono>}
      </motion.div>

      {/* The headline is shouted; the line underneath is not. That contrast is
          the entire joke of this format, so the two must not share a weight. */}
      <motion.div {...up(0.2)} className="mt-2">
        <Poster size="lg">{slide.title}</Poster>
      </motion.div>
      {slide.body && <Prose delay={0.5} className="mt-4">{slide.body}</Prose>}
      {quote && <PulledQuote quote={quote} tone={tone} side="start" />}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** A paper. Serif title, the journal in mono, the findings as a glass grid. */
function ScientificSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const scores = (slide.jokeScores ?? []).slice(0, 6);
  const cardTones: Tone[] = [tone, 'sun', 'pink', tone, 'white', 'teal'];
  const tilt = [-1, 1, 1, -1, -1, 1];

  return (
    <>
      <Eyebrow>{copy.t('report.findings')}</Eyebrow>
      <Narration size="lg" italic={false} delay={0.1}>
        {slide.title}
      </Narration>
      {slide.subtitle && (
        <motion.div {...fade(0.3)} className="mt-2">
          <Mono className="opacity-60">{slide.subtitle}</Mono>
        </motion.div>
      )}
      {slide.body && <Prose delay={0.4} className="mt-4">{slide.body}</Prose>}

      {scores.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {scores.map((score, i) => (
            <GlassCard
              key={`${score.label}-${i}`}
              value={score.value}
              label={score.label}
              tone={cardTones[i % cardTones.length]!}
              rotate={tilt[i % tilt.length]! * 0.8}
              delay={0.5 + i * 0.1}
            />
          ))}
        </div>
      )}

      {slide.stats.length > 0 && (
        <motion.div {...fade(0.7)} className="mt-4 flex flex-wrap gap-2">
          {slide.stats.map((stat) => (
            <Glass key={stat.label} className="flex items-baseline gap-2 rounded-full px-3 py-1.5">
              <Mono className="opacity-60">{stat.label}</Mono>
              <span dir="ltr" className="text-[12px] tabular-nums" style={{ fontFamily: 'var(--yap-mono)' }}>
                {String(stat.value)}
              </span>
            </Glass>
          ))}
        </motion.div>
      )}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** An org chart drawn as one: the top job alone, everyone else wired beneath. */
function OrgChartSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const { rows, closing } = orgLines(slide.body);
  const [top, ...rest] = rows;
  const wire = 'rgb(255 255 255 / 0.3)';
  const isPerson = (name: string) => slide.people.includes(name);

  return (
    <>
      <Eyebrow>{copy.t('report.orgChart')}</Eyebrow>
      <motion.div {...up(0.1)}>
        <Poster size="md">{slide.title}</Poster>
      </motion.div>

      {top && (
        <div className="mt-5 flex flex-col items-center">
          <motion.div
            {...punch(0.3, -1.5)}
            className="flex max-w-full items-center gap-3 rounded-2xl py-2.5 ps-3 pe-4"
            style={{ background: NIGHT[tone], color: INK[tone] }}
          >
            {isPerson(top.name) && <Portrait name={top.name} size={34} />}
            <div className="min-w-0">
              {/* Roles wrap rather than truncate: a job title this chat invents
                  is the joke, and "Minister of foreign aff…" is not one. */}
              <Mono className="line-clamp-2 block leading-snug opacity-70">{top.role}</Mono>
              <div
                dir="auto"
                className="mt-0.5 line-clamp-2 text-[20px] leading-none"
                style={posterFace(top.name, copy.rtl)}
              >
                {top.name}
              </div>
            </div>
          </motion.div>

          {rest.length > 0 && (
            <>
              <div className="h-4 w-px" style={{ background: wire }} />
              <div className={`relative grid w-full gap-2 ${rest.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {rest.length > 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute top-0 right-1/4 left-1/4 h-px"
                    style={{ background: wire }}
                  />
                )}
                {rest.map((row, i) => (
                  <motion.div key={`${row.role}-${i}`} {...up(0.45 + i * 0.1)} className="flex flex-col items-center">
                    <div className="h-3 w-px" style={{ background: wire }} />
                    <Glass className="h-full w-full px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isPerson(row.name) && <Portrait name={row.name} size={26} />}
                        <div className="min-w-0">
                          <Mono tone={tone} className="line-clamp-3 block text-[9px] leading-snug">
                            {row.role}
                          </Mono>
                          <div dir="auto" className="mt-0.5 line-clamp-2 text-[14px] leading-tight font-bold">
                            {row.name}
                          </div>
                        </div>
                      </div>
                    </Glass>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {closing && (
        <Narration size="sm" delay={0.5 + rows.length * 0.1} className="mt-4 opacity-90">
          {closing}
        </Narration>
      )}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** A changelog in a terminal window. */
function PatchNotesSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const tags: Tone[] = [tone, 'teal', 'pink', 'sun'];

  return (
    <>
      <Eyebrow>
        {copy.t('report.patchNotes')}
        {slide.subtitle ? ` · ${slide.subtitle}` : ''}
      </Eyebrow>
      <motion.div {...up(0.1)}>
        <Poster size="md">{slide.title}</Poster>
      </motion.div>

      <motion.div {...upSm(0.3)} className="mt-5">
        <Glass className="overflow-hidden">
          <div
            className="flex items-center gap-1.5 border-b px-3.5 py-2"
            style={{ borderColor: 'rgb(255 255 255 / 0.1)' }}
          >
            {(['pink', 'sun', 'lime'] as const).map((dot) => (
              <span key={dot} className="h-2.5 w-2.5 rounded-full" style={{ background: NIGHT[dot] }} />
            ))}
            {slide.subtitle && (
              <Mono dir="ltr" className="ms-2 truncate opacity-50">
                {slide.subtitle}
              </Mono>
            )}
          </div>
          <ul className="flex flex-col gap-2.5 px-3.5 py-3">
            {lines(slide.body).map((line, i) => {
              const { label, value } = splitLabel(line);
              const tag = tags[i % tags.length]!;
              return (
                <motion.li key={i} {...slideIn(0.4 + i * 0.09, copy.rtl)} className="flex items-start gap-2.5">
                  <span
                    dir="auto"
                    className="mt-[2px] shrink-0 rounded px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.08em] uppercase"
                    style={{
                      fontFamily: 'var(--yap-mono)',
                      background: `color-mix(in srgb, ${NIGHT[tag]} 18%, transparent)`,
                      color: NIGHT[tag],
                    }}
                  >
                    {label ?? '+'}
                  </span>
                  <span dir="auto" className="text-[14px] leading-snug" style={{ textWrap: 'pretty' }}>
                    {value}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </Glass>
      </motion.div>
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** Wildlife footage: letterboxed, a REC light, the subject framed, narration in serif. */
function DocumentarySlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const subject = slide.people.length === 1 ? slide.people[0]! : null;
  const quote = slide.quotes[0];
  const corner = `2px solid ${NIGHT[tone]}`;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>{copy.t('report.fieldNotes')}</Eyebrow>
        <span className="flex items-center gap-1.5">
          <span className="yap-blink h-2 w-2 rounded-full bg-[#FF3B3B]" />
          <Mono dir="ltr" className="opacity-70">
            rec
          </Mono>
        </span>
      </div>

      {subject && (
        <motion.div {...fade(0.1)} className="relative inline-block p-2">
          <Portrait name={subject} size={64} />
          {/* The viewfinder's corner brackets. */}
          <span aria-hidden="true" className="absolute top-0 left-0 h-3 w-3" style={{ borderTop: corner, borderLeft: corner }} />
          <span aria-hidden="true" className="absolute top-0 right-0 h-3 w-3" style={{ borderTop: corner, borderRight: corner }} />
          <span aria-hidden="true" className="absolute bottom-0 left-0 h-3 w-3" style={{ borderBottom: corner, borderLeft: corner }} />
          <span aria-hidden="true" className="absolute right-0 bottom-0 h-3 w-3" style={{ borderBottom: corner, borderRight: corner }} />
        </motion.div>
      )}

      <Narration size="lg" delay={0.2} className="mt-3">
        {slide.title}
      </Narration>
      {slide.body && (
        <Narration size="sm" italic={false} delay={0.5} className="mt-4 opacity-85">
          {slide.body}
        </Narration>
      )}
      {quote && <PulledQuote quote={quote} tone={tone} delay={0.8} />}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** A memorial card: double rules, a candle, serif, centred. */
function EulogySlide({ slide }: { slide: SlideModel }) {
  const copy = useCopy();
  const rule = { borderColor: 'rgb(255 255 255 / 0.25)' };

  return (
    <div className="mx-auto w-full max-w-[340px] text-center">
      <motion.div {...fade(0)} className="flex justify-center">
        <span
          aria-hidden="true"
          className="yap-blink mb-3 block h-2.5 w-2.5 rounded-full"
          style={{
            background: NIGHT.sun,
            boxShadow: `0 0 18px 4px color-mix(in srgb, ${NIGHT.sun} 55%, transparent)`,
          }}
        />
      </motion.div>
      <motion.div {...fade(0.05)} className="border-y py-[3px]" style={rule}>
        <div className="border-y py-1.5" style={rule}>
          <Mono className="opacity-70">{copy.t('report.memoriam')}</Mono>
        </div>
      </motion.div>

      <Narration size="lg" italic={false} delay={0.2} className="mt-6">
        {slide.title}
      </Narration>
      <div className="mx-auto mt-5 h-px w-12" style={{ background: 'rgb(255 255 255 / 0.35)' }} />
      {slide.body && (
        <Narration size="sm" delay={0.5} className="mt-5 opacity-85">
          {slide.body}
        </Narration>
      )}
      {slide.closer && (
        <Narration size="sm" italic={false} delay={0.7} className="mt-4 opacity-70">
          {slide.closer}
        </Narration>
      )}

      <motion.div {...fade(0.6)} className="mt-6 border-y py-[3px]" style={rule}>
        <div className="border-y py-1.5" style={rule} />
      </motion.div>
      <div className="text-start">
        <Receipts quotes={slide.quotes} />
      </div>
    </div>
  );
}

/** One glossary entry, as a dictionary sets it. */
function Entry({
  n,
  phrase,
  partOfSpeech,
  definition,
  origin,
  tone,
  delay,
}: {
  n: number;
  phrase: string;
  partOfSpeech: string;
  definition: string;
  origin: string;
  tone: Tone;
  delay: number;
}) {
  return (
    <motion.div {...up(delay)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Poster size="md" text={phrase}>
          {phrase}
        </Poster>
        {partOfSpeech && (
          <span dir="auto" className="text-[13px] italic opacity-60" style={{ fontFamily: 'var(--yap-serif)' }}>
            {partOfSpeech}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2.5">
        <Mono dir="ltr" tone={tone} className="shrink-0 pt-[3px] text-[11px]">
          {n}.
        </Mono>
        <p dir="auto" className="text-[14.5px] leading-[1.5]" style={{ textWrap: 'pretty' }}>
          {definition}
        </p>
      </div>
      {origin && (
        <p
          dir="auto"
          className="mt-1.5 ps-6 text-[12.5px] leading-relaxed italic opacity-55"
          style={{ fontFamily: 'var(--yap-serif)', textWrap: 'pretty' }}
        >
          {origin}
        </p>
      )}
    </motion.div>
  );
}

function DictionaryEntrySlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const quote = slide.quotes[0];
  return (
    <>
      <Eyebrow>{copy.t('report.glossary')}</Eyebrow>
      <Entry
        n={1}
        phrase={slide.title}
        partOfSpeech={slide.subtitle}
        definition={slide.body}
        origin=""
        tone={tone}
        delay={0.1}
      />
      {quote && <PulledQuote quote={quote} tone={tone} />}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** The inside-joke dictionary, which is a list rather than one big idea. */
export function DictionarySlide({ entries, tone = 'pink' }: { entries: DictionaryEntry[]; tone?: Tone }) {
  const copy = useCopy();
  return (
    <>
      <Eyebrow>{copy.t('report.insideWords')}</Eyebrow>
      <div className="flex flex-col">
        {entries.map((entry, i) => (
          <div
            key={entry.phrase}
            className={i > 0 ? 'mt-4 border-t pt-4' : ''}
            style={i > 0 ? { borderColor: 'rgb(255 255 255 / 0.12)' } : undefined}
          >
            <Entry
              n={i + 1}
              phrase={entry.phrase}
              partOfSpeech={entry.partOfSpeech}
              definition={entry.definition}
              origin={entry.origin}
              tone={tone}
              delay={0.1 + i * 0.12}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The board. The design's: rank in mono, the name at a size that falls with the
 * rank, the count pinned to the trailing edge, and the commentary on a tilted
 * note underneath. Faces only for rows that are people — a leaderboard can
 * rank phrases too, and a phrase does not get an animal.
 */
function LeaderboardSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const rows = slide.stats.slice(0, 7);
  const isPerson = (name: string) => slide.people.includes(name);

  return (
    <>
      <Eyebrow>{copy.t('report.standings')}</Eyebrow>
      <motion.div {...up(0.1)}>
        <Poster size="md">{slide.title}</Poster>
      </motion.div>

      <div className="mt-3.5 flex flex-col">
        {rows.map((row, i) => (
          <motion.div
            key={`${row.label}-${i}`}
            {...slideIn(0.2 + i * 0.09, copy.rtl)}
            className={`flex items-center gap-2.5 border-b ${i < 3 ? 'py-1.5' : 'py-1'}`}
            style={{ borderColor: 'rgb(255 255 255 / 0.12)' }}
          >
            <Mono dir="ltr" className="min-w-[20px] opacity-50">
              {String(i + 1).padStart(2, '0')}
            </Mono>
            {isPerson(row.label) && <Portrait name={row.label} size={i === 0 ? 30 : 22} />}
            <span
              dir="auto"
              className="min-w-0 flex-1 truncate"
              style={{
                ...posterFace(row.label, copy.rtl),
                fontSize:
                  i === 0
                    ? 'clamp(30px,10vw,44px)'
                    : i < 3
                      ? 'clamp(23px,7.5vw,32px)'
                      : i < 5
                        ? '21px'
                        : '17px',
                lineHeight: 0.98,
                color: i === 0 ? NIGHT[tone] : i < 3 ? '#fff' : 'rgb(255 255 255 / 0.6)',
              }}
            >
              {row.label}
            </span>
            <span
              dir="ltr"
              className="shrink-0 text-[12px] tabular-nums"
              style={{
                fontFamily: 'var(--yap-mono)',
                color: i === 0 ? NIGHT[tone] : i < 3 ? '#fff' : 'rgb(255 255 255 / 0.6)',
              }}
            >
              {String(row.value)}
            </span>
          </motion.div>
        ))}
      </div>

      {slide.body && (
        <div className="mt-4">
          <Note tone="orange" delay={0.3 + rows.length * 0.09}>
            {slide.body}
          </Note>
        </div>
      )}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** The chat itself: day dividers and bubbles, one per beat, alternating sides. */
function TimelineSlide({ slide, tone }: { slide: SlideModel; tone: Tone }) {
  const copy = useCopy();
  const beats = timelineLines(slide.body);

  return (
    <>
      <Eyebrow>{slide.subtitle || copy.t('report.howItWent')}</Eyebrow>
      <motion.div {...up(0.1)}>
        <Poster size="md">{slide.title}</Poster>
      </motion.div>

      <div className="mt-4 flex flex-col gap-[5px]">
        {beats.map((beat, i) => (
          <Fragment key={i}>
            {beat.date && (
              <Bubble side="center" delay={0.25 + i * 0.14} className={i > 0 ? 'mt-1.5' : ''}>
                {beat.date}
              </Bubble>
            )}
            <Bubble side={i % 2 ? 'end' : 'start'} tone={i % 2 ? tone : 'glass'} delay={0.3 + i * 0.14}>
              {beat.beat}
            </Bubble>
          </Fragment>
        ))}
      </div>

      {slide.closer && (
        <Narration size="sm" delay={0.45 + beats.length * 0.14} className="mt-4">
          {slide.closer}
        </Narration>
      )}
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/** The torn bottom edge of a till receipt, as a clip path. */
const TORN_EDGE = (() => {
  const teeth = 22;
  const points = ['0 0', '100% 0'];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    points.push(`${x.toFixed(2)}% ${i % 2 === 0 ? '100%' : 'calc(100% - 9px)'}`);
  }
  return `polygon(${points.join(', ')})`;
})();

/** A till receipt: cream paper, mono, dashed rules, a total, a barcode. */
function ReceiptSlide({ slide }: { slide: SlideModel }) {
  const copy = useCopy();
  const all = lines(slide.body);
  const items = all.slice(0, -1).map(receiptLine);
  const total = all.length > 0 ? receiptLine(all[all.length - 1]!) : null;
  const ink = '#15251C';

  return (
    <>
      <Eyebrow>{copy.t('report.itemised')}</Eyebrow>
      <motion.div
        {...punch(0.15, -1.5)}
        className="mx-auto w-full max-w-[330px]"
        style={{ filter: 'drop-shadow(0 24px 40px rgb(0 0 0 / 0.5))' }}
      >
        <div
          className="px-5 pt-6 pb-8"
          style={{
            background: '#F6EFE4',
            color: ink,
            fontFamily: 'var(--yap-mono)',
            clipPath: TORN_EDGE,
          }}
        >
          <div className="text-center">
            <div
              dir="auto"
              className="text-[22px] leading-[0.95]"
              style={{
                ...posterFace(slide.title, copy.rtl),
                textTransform: posterFace(slide.title, copy.rtl).fontFamily === 'var(--yap-heb)' ? undefined : 'uppercase',
                textWrap: 'balance',
              }}
            >
              {slide.title}
            </div>
            {slide.subtitle && (
              <p dir="auto" className="mt-1.5 text-[10px] tracking-[0.12em] uppercase opacity-60">
                {slide.subtitle}
              </p>
            )}
          </div>

          <div className="my-3 border-t border-dashed" style={{ borderColor: `${ink}66` }} />

          {items.map((item, i) => (
            <motion.div
              key={i}
              {...fade(0.4 + i * 0.1)}
              className="flex items-baseline gap-3 py-[5px] text-[12.5px] leading-snug"
            >
              <span dir="auto" className="min-w-0 flex-1" style={{ textWrap: 'pretty' }}>
                {item.item}
              </span>
              {item.qty && (
                <span dir="ltr" className="shrink-0 tabular-nums">
                  {item.qty}
                </span>
              )}
            </motion.div>
          ))}

          <div className="my-3 border-t-2 border-dashed" style={{ borderColor: `${ink}99` }} />

          {total && (
            <motion.div
              {...punch(0.5 + items.length * 0.1)}
              className="flex items-baseline gap-3 text-[15px] leading-snug font-medium"
            >
              <span dir="auto" className="min-w-0 flex-1" style={{ textWrap: 'pretty' }}>
                {total.item}
              </span>
              {total.qty && (
                <span dir="ltr" className="shrink-0 tabular-nums">
                  {total.qty}
                </span>
              )}
            </motion.div>
          )}

          <div
            aria-hidden="true"
            className="mt-5 h-9 w-full opacity-85"
            style={{
              background: `repeating-linear-gradient(90deg, ${ink} 0 2px, transparent 2px 4px, ${ink} 4px 5px, transparent 5px 8px, ${ink} 8px 11px, transparent 11px 13px, ${ink} 13px 14px, transparent 14px 17px)`,
            }}
          />
          <p dir="ltr" className="mt-1.5 text-center text-[9px] tracking-[0.2em] uppercase opacity-50">
            yapped
          </p>
        </div>
      </motion.div>
      <Receipts quotes={slide.quotes} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The slide
 * ------------------------------------------------------------------ */

export function ReportSlide({
  slide,
  tone = 'lime',
  exhibit,
  context,
}: {
  slide: SlideModel;
  tone?: Tone;
  exhibit?: { n: number; of: number };
  /** The chat, for the cover. */
  context?: Context;
}) {
  if (slide.format === 'profile') return <DossierSlide slide={slide} exhibit={exhibit} />;
  if (slide.type === 'opening') return <OpeningSlide slide={slide} tone={tone} group={context} />;
  if (slide.type === 'finale') return <FinaleSlide slide={slide} tone={tone} />;

  switch (slide.format) {
    case 'court_case':
      return <CourtCaseSlide slide={slide} tone={tone} />;
    case 'breaking_news':
      return <BreakingNewsSlide slide={slide} tone={tone} />;
    case 'scientific_report':
      return <ScientificSlide slide={slide} tone={tone} />;
    case 'company_structure':
      return <OrgChartSlide slide={slide} tone={tone} />;
    case 'patch_notes':
      return <PatchNotesSlide slide={slide} tone={tone} />;
    case 'documentary':
      return <DocumentarySlide slide={slide} tone={tone} />;
    case 'eulogy':
      return <EulogySlide slide={slide} />;
    case 'dictionary_entry':
      return <DictionaryEntrySlide slide={slide} tone={tone} />;
    case 'leaderboard':
      return <LeaderboardSlide slide={slide} tone={tone} />;
    case 'timeline':
      return <TimelineSlide slide={slide} tone={tone} />;
    case 'receipt':
      return <ReceiptSlide slide={slide} />;
    case 'plain':
    default:
      return <PlainSlide slide={slide} tone={tone} />;
  }
}

/* ------------------------------------------------------------------ *
 * Deck assembly
 * ------------------------------------------------------------------ */

/** What the cover knows about the chat that the slide itself does not carry. */
export interface Context {
  groupName: string | null;
  participantCount: number;
}

export interface ReportDeckSlide extends Partial<Dress> {
  id: string;
  backdrop: Backdrop;
  align: SlideAlign;
  render: () => ReactNode;
}

/**
 * Each format's own colour and where it bleeds in from. `plain` has no colour
 * of its own and takes the next one in the rotation instead — it is the one
 * repeatable format, and five plain slides in one colour is a template again.
 */
const DRESS: Partial<Record<SlideModel['format'], Dress>> = {
  court_case: { tone: 'sun', at: 'left' },
  breaking_news: { tone: 'pink', at: 'top' },
  scientific_report: { tone: 'teal', at: 'right' },
  company_structure: { tone: 'sun', at: 'top' },
  patch_notes: { tone: 'teal', at: 'right' },
  documentary: { tone: 'teal', at: 'right', letterbox: true },
  eulogy: { tone: 'violet', at: 'top' },
  dictionary_entry: { tone: 'pink', at: 'top' },
  leaderboard: { tone: 'orange', at: 'left' },
  timeline: { tone: 'violet', at: 'right' },
  receipt: { tone: 'lime', at: 'bottom' },
};

const BLOOM_AT: readonly BloomAt[] = ['bottom', 'top', 'right', 'left'];

export function reportSlidesFor(
  slides: SlideModel[],
  dictionary: DictionaryEntry[] = [],
  context?: Context,
): ReportDeckSlide[] {
  const out: ReportDeckSlide[] = [];

  // Numbered across the whole deck rather than per slide, so a card can say
  // "Exhibit 03 of 05" and mean it. Counted up front because the third dossier
  // has to know how many follow it.
  const dossiers = slides.filter((s) => s.format === 'profile').length;
  let dossier = 0;

  // Consecutive slides never share a tone, which is the rule the statistics
  // deck already keeps for its grounds. The rotation only advances for slides
  // that have no colour of their own.
  let previous: Tone | null = null;
  let rotation = 0;

  for (const slide of slides) {
    if (slide.format === 'profile') {
      const exhibit = { n: ++dossier, of: dossiers };
      out.push({
        // Always the same stock — a case file that changed colour every person
        // would be a set of posters, not a file. The accent rotates instead.
        id: slide.id,
        backdrop: 'paper',
        align: 'center',
        render: () => <ReportSlide slide={slide} exhibit={exhibit} />,
      });
      previous = null;
      continue;
    }

    let dress: Dress;
    if (slide.type === 'opening') {
      dress = { tone: 'lime', at: 'bottom', align: 'end', photo: 'opener' };
    } else if (slide.type === 'finale') {
      dress = { tone: 'pink', at: 'bottom', align: 'end', photo: 'verdict' };
    } else if (DRESS[slide.format]) {
      dress = { ...DRESS[slide.format]! };
      // The loudest day gets the photo the reader chose for it.
      if (slide.id === 'stat-chaos-day') dress.photo = 'chaos';
    } else {
      dress = { tone: TONES[rotation % TONES.length]!, at: BLOOM_AT[rotation % BLOOM_AT.length]! };
      rotation++;
    }
    if (dress.tone === previous) {
      dress.tone = TONES[(TONES.indexOf(dress.tone) + 1) % TONES.length]!;
    }
    previous = dress.tone;

    const { tone } = dress;
    out.push({
      ...dress,
      id: slide.id,
      backdrop: 'night',
      align: dress.align ?? 'start',
      render: () => <ReportSlide slide={slide} tone={tone} context={context} />,
    });
  }

  // Three at a time: the entries are short but each is four lines, and a slide
  // in this deck does not scroll.
  const PER_SLIDE = 3;
  for (let page = 0; page * PER_SLIDE < dictionary.length; page++) {
    const slice = dictionary.slice(page * PER_SLIDE, (page + 1) * PER_SLIDE);
    const tone: Tone = page % 2 === 0 ? 'pink' : 'teal';
    out.push({
      id: `dictionary-${page}`,
      backdrop: 'night',
      align: 'start',
      tone,
      at: page % 2 === 0 ? 'top' : 'right',
      render: () => <DictionarySlide entries={slice} tone={tone} />,
    });
  }

  return out;
}
