'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStorySound } from '@/lib/useStorySound';

/**
 * The sample story, playing in a phone.
 *
 * This is the only place on the landing page that shows what the product
 * actually is, so it is the real thing rather than a mockup: sixteen slides
 * from one nine-year group chat, tappable, with the same left/right hit areas,
 * progress ticks and soundtrack as the deck itself — literally the same
 * `useStorySound`, because the landing page is a promise about what the deck
 * will be. Everything in it is fixed sample content; the reader's own numbers
 * only exist after they upload.
 */

const HOURS = [
  4702, 2467, 1338, 779, 261, 390, 545, 1084, 2478, 4111, 5336, 6808, 9396, 10285, 10961, 11647,
  11828, 12504, 13480, 14108, 13332, 14619, 12143, 8717,
];

const YEARS: [number, number][] = [
  [2017, 23997],
  [2018, 37191],
  [2019, 29901],
  [2020, 14288],
  [2021, 5519],
  [2022, 9549],
  [2023, 10188],
  [2024, 16967],
  [2025, 17978],
  [2026, 7741],
];

const TOTAL = 16;
const LAST = TOTAL - 1;

/* Every slide fills the screen and animates in the same way; only the palette
   and the vertical alignment change. */
const slide = (background: string, color: string, justify: 'center' | 'flex-end'): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  background,
  color,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: justify,
  padding: '34px 26px 74px',
  animation: 'yapPop .45s ease',
});

const eyebrow = (color?: string): CSSProperties => ({
  fontFamily: 'var(--yap-mono)',
  fontSize: 11,
  letterSpacing: '.18em',
  textTransform: 'uppercase',
  ...(color ? { color } : null),
});

const poster = (size: number, extra?: CSSProperties): CSSProperties => ({
  fontFamily: 'var(--yap-poster)',
  fontSize: size,
  lineHeight: 0.86,
  ...extra,
});

const heb = (size: number, extra?: CSSProperties): CSSProperties => ({
  fontFamily: 'var(--yap-heb)',
  fontWeight: 900,
  fontSize: size,
  ...extra,
});

const body = (extra?: CSSProperties): CSSProperties => ({
  fontSize: 15,
  lineHeight: 1.5,
  marginTop: 18,
  maxWidth: '26ch',
  ...extra,
});

const chrome: CSSProperties = {
  border: 0,
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 999,
  background: 'rgba(255,255,255,.16)',
  color: '#fff',
  fontSize: 12,
  display: 'grid',
  placeItems: 'center',
};

function Rank({
  n,
  name,
  count,
  size,
  nameSize,
  opacity,
  gold,
}: {
  n: number;
  name: string;
  count: string;
  size: number;
  nameSize: number;
  opacity?: number;
  gold?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, opacity }}>
      <span
        style={{
          fontFamily: 'var(--yap-poster)',
          fontSize: size,
          ...(gold ? { color: '#C9F24D' } : null),
          ...(n === 2 ? { opacity: 0.85 } : n === 3 ? { opacity: 0.72 } : null),
        }}
      >
        {n}
      </span>
      <span dir="rtl" style={heb(nameSize)}>
        {name}
      </span>
      <span
        style={{
          fontFamily: 'var(--yap-mono)',
          fontSize: 12,
          marginLeft: 'auto',
          ...(n <= 3 ? { color: '#C9B6FF' } : null),
        }}
      >
        {count}
      </span>
    </div>
  );
}

function MediaRow({ name, note }: { name: string; note: string }) {
  return (
    <div style={{ background: '#180410', borderRadius: 14, padding: '12px 14px' }}>
      <div dir="rtl" style={heb(21, { color: '#fff' })}>
        {name}
      </div>
      <div
        style={{ fontFamily: 'var(--yap-mono)', fontSize: 11, marginTop: 4, color: '#FF9DCB' }}
      >
        {note}
      </div>
    </div>
  );
}

function Award({ name, line }: { name: string; line: string }) {
  return (
    <div>
      <div dir="rtl" style={heb(23)}>
        {name}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.4 }}>{line}</div>
    </div>
  );
}

export function StoryPreview({
  autoAdvance = false,
  slideSeconds = 5,
}: {
  autoAdvance?: boolean;
  slideSeconds?: number;
}) {
  const [i, setI] = useState(0);
  const sound = useStorySound();
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(LAST, n));
      setI(next);
      // The last slide is the paywall, so it resolves on a chord rather than
      // the single note every other slide gets.
      sound.sting(next, next === LAST);
    },
    [sound],
  );

  useEffect(() => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (!autoAdvance || i >= LAST) return;
    advanceRef.current = setTimeout(() => go(i + 1), slideSeconds * 1000);
    return () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
    };
  }, [autoAdvance, slideSeconds, i, go]);

  const maxHour = Math.max(...HOURS);
  const counter = `${String(i + 1).padStart(2, '0')} / ${TOTAL}`;

  return (
    <div className="yap-phone">
      <div className="yap-phone-scale">
        {/* A second, still phone sitting behind the floating one — it is what
            keeps the drift from reading as the whole page wobbling. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 38,
            left: 31,
            width: 330,
            height: 600,
            borderRadius: 44,
            background: '#E4D5BB',
          }}
        />
        <div style={{ position: 'relative', animation: 'yapFloat 7s ease-in-out infinite' }}>
          <div
            style={{
              position: 'relative',
              width: 392,
              padding: 12,
              borderRadius: 52,
              background: '#20221E',
              boxShadow: '0 34px 70px rgba(30,20,8,.34),inset 0 0 0 2px #3A3C36',
            }}
          >
            <div
              role="group"
              aria-label={`Sample story, slide ${i + 1} of ${TOTAL}`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(i + 1);
                if (e.key === 'ArrowLeft') go(i - 1);
              }}
              style={{
                position: 'relative',
                width: 368,
                height: 654,
                borderRadius: 42,
                overflow: 'hidden',
                background: '#10130E',
              }}
            >
              {/* progress ticks */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  display: 'flex',
                  gap: 4,
                  padding: '12px 14px 0',
                }}
              >
                {Array.from({ length: TOTAL }, (_, k) => (
                  <div
                    key={k}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,.28)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ height: '100%', background: '#fff', width: k <= i ? '100%' : 0 }} />
                  </div>
                ))}
              </div>

              {/* chrome */}
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/reg.png"
                    alt=""
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      display: 'block',
                      boxShadow: '0 0 0 1.5px rgba(255,255,255,.55)',
                    }}
                  />
                  <div
                    style={{
                      fontFamily: 'var(--yap-mono)',
                      fontSize: 10,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,.78)',
                    }}
                  >
                    Yapped · 2026
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={sound.toggle}
                    aria-label={
                      sound.enabled ? 'Mute the sample story' : 'Play sound with the sample story'
                    }
                    style={chrome}
                  >
                    {sound.enabled ? '♪' : '✕'}
                  </button>
                  <button
                    type="button"
                    onClick={() => go(0)}
                    aria-label="Restart the sample story"
                    style={chrome}
                  >
                    ↺
                  </button>
                </div>
              </div>

              {/* 01 */}
              {i === 0 && (
                <div style={slide('#C9F24D', '#10130E', 'flex-end')}>
                  <div style={eyebrow()}>League of Virgins · since Aug 2016</div>
                  <div
                    style={poster(70, {
                      letterSpacing: '-.02em',
                      marginTop: 14,
                      textTransform: 'uppercase',
                    })}
                  >
                    Nine years.
                    <br />
                    One group.
                    <br />
                    No cure.
                  </div>
                  <div style={body()}>
                    Reg read all 173,319 messages so you never have to. Tap through. Volume up.
                  </div>
                </div>
              )}

              {/* 02 */}
              {i === 1 && (
                <div style={slide('#FF4FA3', '#180410', 'center')}>
                  <div style={eyebrow()}>Total damage</div>
                  <div
                    style={poster(88, { lineHeight: 0.82, letterSpacing: '-.03em', marginTop: 10 })}
                  >
                    173,319
                  </div>
                  <div
                    style={poster(32, {
                      lineHeight: 0.95,
                      textTransform: 'uppercase',
                      marginTop: 8,
                    })}
                  >
                    messages · 18 people
                  </div>
                  <div style={body({ marginTop: 20 })}>
                    That&apos;s 52 messages a day, every day, for nine years. Including the years
                    you claim you were &quot;busy&quot;.
                  </div>
                </div>
              )}

              {/* 03 */}
              {i === 2 && (
                <div style={slide('#4B1BD1', '#F1ECFF', 'center')}>
                  <div style={eyebrow('#C9B6FF')}>The yap leaderboard</div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 11,
                      marginTop: 20,
                    }}
                  >
                    <Rank n={1} name="בבלי" count="30,554" size={40} nameSize={27} gold />
                    <Rank n={2} name="עומר סמורו" count="26,837" size={32} nameSize={22} />
                    <Rank n={3} name="תמיר הגבר" count="17,910" size={27} nameSize={19} />
                    <Rank n={4} name="פקולה" count="17,826" size={22} nameSize={17} opacity={0.6} />
                    <Rank n={5} name="שחר דק" count="17,296" size={20} nameSize={16} opacity={0.5} />
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 20, color: '#DCD2FF' }}>
                    פקולה lost 4th place by 84 messages and will never recover from it.
                  </div>
                </div>
              )}

              {/* 04 */}
              {i === 3 && (
                <div style={slide('#FF6B1A', '#1A0A00', 'flex-end')}>
                  <div style={eyebrow()}>Chief yapper</div>
                  <div dir="rtl" style={heb(72, { lineHeight: 0.9, marginTop: 12 })}>
                    בבלי
                  </div>
                  <div style={body({ fontSize: 16, marginTop: 16, maxWidth: '27ch' })}>
                    733,515 characters. 3,801 questions. 3,075 separate messages that were just
                    laughing. 18% of everything ever said here.
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      display: 'inline-flex',
                      alignSelf: 'flex-start',
                      background: '#1A0A00',
                      color: '#FFB25E',
                      fontFamily: 'var(--yap-mono)',
                      fontSize: 11,
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      padding: '8px 14px',
                      borderRadius: 999,
                    }}
                  >
                    Has never left a chat unread
                  </div>
                </div>
              )}

              {/* 05 */}
              {i === 4 && (
                <div style={slide('#10130E', '#EFEFE6', 'center')}>
                  <div style={eyebrow('#8FA07C')}>Certified ghost</div>
                  <div
                    dir="rtl"
                    style={heb(52, { lineHeight: 0.95, marginTop: 12, color: '#C9F24D' })}
                  >
                    תמיר הגבר
                  </div>
                  <div style={poster(44, { lineHeight: 0.9, marginTop: 12, color: '#C9F24D' })}>
                    70 min
                    <br />
                    <span style={{ fontSize: 22 }}>average reply</span>
                  </div>
                  <div style={body({ marginTop: 16, maxWidth: '27ch', color: '#C6C9BC' })}>
                    Slowest replier in the group — twice as slow as anyone else. Also sent 1,022
                    messages between 1 and 5 AM. So he&apos;s awake. He&apos;s just ignoring you.
                  </div>
                </div>
              )}

              {/* 06 */}
              {i === 5 && (
                <div style={slide('#16E0C8', '#04211D', 'center')}>
                  <div style={eyebrow()}>Fastest trigger finger</div>
                  <div dir="rtl" style={heb(56, { lineHeight: 0.95, marginTop: 10 })}>
                    פקולה
                  </div>
                  <div style={poster(60, { lineHeight: 0.85, marginTop: 8 })}>16.7 min</div>
                  <div style={body({ marginTop: 16, maxWidth: '27ch' })}>
                    Fastest replier of anyone with real volume — and the author of a single
                    10,500-character message. That&apos;s not a text, that&apos;s a dissertation.
                  </div>
                </div>
              )}

              {/* 07 */}
              {i === 6 && (
                <div style={slide('#121A3A', '#E7EBFF', 'center')}>
                  <div style={eyebrow('#8E9BD6')}>When you yap</div>
                  <div
                    style={poster(46, {
                      lineHeight: 0.9,
                      textTransform: 'uppercase',
                      marginTop: 12,
                    })}
                  >
                    Peak hour:
                    <br />
                    <span style={{ color: '#C9F24D' }}>21:00</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 3,
                      height: 150,
                      marginTop: 22,
                    }}
                  >
                    {HOURS.map((v, k) => (
                      <div
                        key={k}
                        style={{
                          flex: 1,
                          borderRadius: '3px 3px 0 0',
                          // The late-night hours are the point of the slide, so
                          // they are the only ones given the accent.
                          background: k >= 19 || k <= 1 ? '#C9F24D' : 'rgba(231,235,255,.5)',
                          height: `${Math.max(4, Math.round((v / maxHour) * 100))}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--yap-mono)',
                      fontSize: 10,
                      color: '#8E9BD6',
                      marginTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>00h</span>
                    <span>12h</span>
                    <span>23h</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 14, color: '#C3CBF2' }}>
                    4,702 messages were sent at midnight. 261 at 4 AM. Someone is always up.
                  </div>
                </div>
              )}

              {/* 08 */}
              {i === 7 && (
                <div style={slide('#FF2E2E', '#FFF3F3', 'flex-end')}>
                  <div style={eyebrow()}>Peak chaos</div>
                  <div
                    style={poster(66, {
                      lineHeight: 0.85,
                      textTransform: 'uppercase',
                      marginTop: 12,
                    })}
                  >
                    29 Sep
                    <br />
                    2017
                  </div>
                  <div style={poster(26, { lineHeight: 1, marginTop: 14 })}>
                    761 messages in one day
                  </div>
                  <div style={body({ marginTop: 14, maxWidth: '27ch' })}>
                    Your busiest day ever, and 232 of them were from one person. Reg reconstructed
                    it.
                  </div>
                </div>
              )}

              {/* 09 */}
              {i === 8 && (
                <div style={slide('#F6EFE4', '#15251C', 'center')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/reg.png"
                      alt=""
                      style={{ width: 26, height: 26, borderRadius: 999, display: 'block' }}
                    />
                    <div style={eyebrow('#8A7B63')}>Reg&apos;s account of that night</div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--yap-serif)',
                      fontSize: 33,
                      lineHeight: 1.1,
                      marginTop: 14,
                    }}
                  >
                    &quot;It began with יניב stuck outside the commune at 1 AM asking if anyone
                    wanted to come out for an hour.&quot;
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 14, color: '#4E4536' }}>
                    Nobody came out. Instead: 761 messages, 232 of them from פקולה, a spelling
                    correction war led by עומר, and a debate about who got discharged first that
                    lasted until morning.
                  </div>
                </div>
              )}

              {/* 10 */}
              {i === 9 && (
                <div style={slide('#C9F24D', '#10130E', 'center')}>
                  <div style={eyebrow()}>Your entire vocabulary</div>
                  <div
                    dir="rtl"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      gap: 12,
                      marginTop: 18,
                      fontFamily: 'var(--yap-heb)',
                      fontWeight: 900,
                    }}
                  >
                    {[
                      ['זה', 52],
                      ['לא', 44],
                      ['אני', 38],
                      ['מה', 30],
                      ['אבל', 34],
                      ['מישהו', 26],
                      ['לול', 30],
                    ].map(([word, size]) => (
                      <span key={word as string} style={{ fontSize: size as number, lineHeight: 0.9 }}>
                        {word}
                      </span>
                    ))}
                  </div>
                  <div style={body({ marginTop: 20, maxWidth: '27ch' })}>
                    &quot;חחחח&quot; appears 2,156 times as its own word. &quot;לול&quot; 1,996
                    times. Nine years of language, three syllables.
                  </div>
                </div>
              )}

              {/* 11 */}
              {i === 10 && (
                <div style={slide('#4B1BD1', '#F1ECFF', 'center')}>
                  <div style={eyebrow('#C9B6FF')}>Emoji podium</div>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 24 }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48 }}>👀</div>
                      <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 24, color: '#C9F24D' }}>
                        5,339
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', opacity: 0.85 }}>
                      <div style={{ fontSize: 34 }}>😂</div>
                      <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 18 }}>1,141</div>
                    </div>
                    <div style={{ textAlign: 'center', opacity: 0.7 }}>
                      <div style={{ fontSize: 28 }}>🥳</div>
                      <div style={{ fontFamily: 'var(--yap-poster)', fontSize: 16 }}>1,053</div>
                    </div>
                  </div>
                  <div style={body({ marginTop: 22, maxWidth: '27ch', color: '#DCD2FF' })}>
                    👀 beat 😂 five to one. This group would rather stare than laugh.
                  </div>
                </div>
              )}

              {/* 12 */}
              {i === 11 && (
                <div style={slide('#FF4FA3', '#180410', 'center')}>
                  <div style={eyebrow()}>The content farm</div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}
                  >
                    <MediaRow name="תמיר הגבר" note="2,051 photos & videos · unpaid, unstoppable" />
                    <MediaRow name="עידן וינברג" note="1,282 · quality unverified" />
                    <MediaRow name="עומר סמורו" note="964 · mostly screenshots of this chat" />
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 16 }}>
                    9,378 media files total. WhatsApp deleted most of them. Reg mourns them.
                  </div>
                </div>
              )}

              {/* 13 */}
              {i === 12 && (
                <div style={slide('#FF6B1A', '#1A0A00', 'center')}>
                  <div style={eyebrow()}>The 2026 awards</div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 16 }}
                  >
                    <Award name="בבלי" line="Laughed 3,075 times. At his own jokes, mostly." />
                    <Award name="תמיר הגבר" line="Awake at 3 AM, unreachable at 3 PM" />
                    <Award name="פקולה" line="Longest message in recorded history" />
                    <Award name="Turtle" line="Founded the group, then stopped showing up" />
                  </div>
                </div>
              )}

              {/* 14 */}
              {i === 13 && (
                <div style={slide('#16E0C8', '#04211D', 'center')}>
                  <div style={eyebrow()}>Nine years, charted</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                    {YEARS.map(([year, n]) => (
                      <div key={year} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontFamily: 'var(--yap-mono)', fontSize: 10, width: 26 }}>
                          {`'${String(year).slice(2)}`}
                        </div>
                        <div
                          style={{
                            height: 13,
                            borderRadius: 3,
                            background: '#04211D',
                            // Bars are scaled against 2018, the peak year, so the
                            // 2021 collapse reads at a glance.
                            width: `${Math.round((n / 37191) * 78)}%`,
                          }}
                        />
                        <div style={{ fontFamily: 'var(--yap-mono)', fontSize: 10, opacity: 0.7 }}>
                          {n.toLocaleString('en-GB')}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={body({ fontSize: 14.5, marginTop: 16, maxWidth: '28ch' })}>
                    2018 was the golden age. 2021 you nearly died — 5,519 messages, an 85% collapse.
                    Then you came back.
                  </div>
                </div>
              )}

              {/* 15 */}
              {i === 14 && (
                <div style={slide('#10130E', '#EFEFE6', 'center')}>
                  <div style={eyebrow('#8FA07C')}>Group verdict</div>
                  <div
                    style={poster(56, {
                      lineHeight: 0.88,
                      textTransform: 'uppercase',
                      marginTop: 12,
                      color: '#C9F24D',
                    })}
                  >
                    The comeback
                    <br />
                    nobody
                    <br />
                    asked for
                  </div>
                  <div
                    style={body({
                      lineHeight: 1.55,
                      marginTop: 18,
                      maxWidth: '28ch',
                      color: '#C6C9BC',
                    })}
                  >
                    You survived a three-year decline, four wars of attrition over who replies
                    slowest, and 9,378 media files. Nine years in and you still talk every day.
                    That&apos;s love, technically.
                  </div>
                </div>
              )}

              {/* 16 */}
              {i === 15 && (
                /*
                  The only slide with controls on it. Every slide animates in
                  with a transform, which makes it its own stacking context —
                  so a z-index on the buttons cannot lift them out from under
                  the story-tap hit areas (z-index 25). The whole slide has to
                  sit above them instead. Tapping to go back is lost here, but
                  this is the last slide and the ↺ in the chrome still works.
                */
                <div style={{ ...slide('#1D3A2A', '#F6EFE4', 'center'), zIndex: 26 }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(80% 60% at 50% 0%,rgba(245,179,36,.20),transparent 70%)',
                    }}
                  />
                  <div style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/reg.png"
                      alt=""
                      style={{ width: 64, height: 64, borderRadius: 999, display: 'block' }}
                    />
                    <div style={{ ...eyebrow('#F5B324'), marginTop: 14 }}>Preview over</div>
                    <div
                      style={{
                        fontFamily: 'var(--yap-serif)',
                        fontSize: 42,
                        lineHeight: 1.02,
                        marginTop: 8,
                      }}
                    >
                      Reg wrote 24 more slides about you.
                    </div>
                    <div
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.55,
                        marginTop: 12,
                        color: '#D6CDBB',
                        maxWidth: '28ch',
                      }}
                    >
                      A roast report for all 18 of you, the full story of 29 September, the private
                      awards, and a 9:16 pack you can post.
                    </div>
                    <div
                      style={{
                        marginTop: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Sample story: the real unlock lives at the end of the
                          reader's own deck, so this only sends them there. */}
                      <a
                        href="#upload"
                        style={{
                          background: '#F5B324',
                          color: '#221600',
                          fontFamily: 'var(--yap-sans)',
                          fontWeight: 700,
                          fontSize: 15,
                          padding: 14,
                          borderRadius: 999,
                          boxShadow: '0 6px 0 #B98214',
                          textAlign: 'center',
                        }}
                      >
                        Unlock the full roast — ₪19
                      </a>
                      <button
                        type="button"
                        onClick={() => go(0)}
                        style={{
                          border: '1px solid rgba(246,239,228,.3)',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: '#F6EFE4',
                          fontFamily: 'var(--yap-mono)',
                          fontSize: 11,
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          padding: 11,
                          borderRadius: 999,
                        }}
                      >
                        Replay the preview
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Story-tap hit areas: a narrow strip to go back, the rest to go
                  on — the split every story player on a phone uses. */}
              <button
                type="button"
                onClick={() => go(i - 1)}
                aria-label="Previous slide"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 82,
                  bottom: 64,
                  width: '34%',
                  zIndex: 25,
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                }}
              />
              <button
                type="button"
                onClick={() => go(i + 1)}
                aria-label="Next slide"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 82,
                  bottom: 64,
                  width: '66%',
                  zIndex: 25,
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.45))',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--yap-mono)',
                    fontSize: 10,
                    letterSpacing: '.12em',
                    color: 'rgba(255,255,255,.8)',
                  }}
                >
                  {counter}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--yap-mono)',
                    fontSize: 10,
                    letterSpacing: '.12em',
                    color: 'rgba(255,255,255,.8)',
                  }}
                >
                  tap →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
