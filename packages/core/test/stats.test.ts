import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { computeStats } from '../src/stats/stats';
import { ATTACHMENTS, SYSTEM_LINES } from './fixtures';

const stats = (raw: string, fileName?: string) =>
  computeStats(parseChat(raw), fileName ? { fileName } : {});

/** Builds an Android-format export from compact `[day, time, sender, body]`. */
function build(rows: [string, string, string, string][]): string {
  return rows.map(([d, t, s, b]) => `${d}, ${t} - ${s}: ${b}`).join('\n');
}

describe('totals', () => {
  it('excludes system messages from every per-person figure', () => {
    const s = stats(SYSTEM_LINES);
    expect(s.totalMessages).toBe(1);
    expect(s.totalSystemMessages).toBe(6);
    expect(s.people).toHaveLength(1);
    expect(s.people[0]!.messages).toBe(1);
  });

  it('does not count media placeholders as words', () => {
    const s = stats(ATTACHMENTS);
    // Only "a normal message" is real text.
    expect(s.totalWords).toBe(3);
    expect(s.totalAttachments).toBe(6);
    expect(s.totalDeleted).toBe(1);
  });
});

describe('response times', () => {
  it('ignores gaps beyond the reply window', () => {
    const s = stats(
      build([
        ['13/01/2023', '09:00', 'Alon', 'first'],
        ['13/01/2023', '09:01', 'Sarah', 'one minute later'],
        ['13/01/2023', '23:00', 'Alon', 'fourteen hours later'],
      ]),
    );
    const sarah = s.people.find((p) => p.name === 'Sarah')!;
    const alon = s.people.find((p) => p.name === 'Alon')!;
    expect(sarah.medianResponseMs).toBe(60_000);
    // Alon's 14-hour "reply" is really just the next evening — not a reply.
    expect(alon.responseSamples).toBe(0);
    expect(alon.medianResponseMs).toBeNull();
  });

  it('does not count a person replying to themselves', () => {
    const s = stats(
      build([
        ['13/01/2023', '09:00', 'Alon', 'one'],
        ['13/01/2023', '09:01', 'Alon', 'two'],
        ['13/01/2023', '09:02', 'Alon', 'three'],
      ]),
    );
    expect(s.people[0]!.responseSamples).toBe(0);
  });
});

describe('night owl', () => {
  it('uses local hours so the result cannot move with the runtime timezone', () => {
    const s = stats(
      build([
        ['13/01/2023', '02:30', 'Owl', 'still awake'],
        ['13/01/2023', '03:15', 'Owl', 'very awake'],
        ['13/01/2023', '14:00', 'Normal', 'good afternoon'],
        ['14/01/2023', '15:00', 'Normal', 'hello again'],
      ]),
    );
    expect(s.awards.nightOwl).toBeNull(); // under the 5-message minimum
    const owl = s.people.find((p) => p.name === 'Owl')!;
    expect(owl.nightMessages).toBe(2);
    expect(owl.nightShare).toBe(1);
  });

  it('requires a minimum sample before handing out an award', () => {
    const rows: [string, string, string, string][] = [];
    for (let i = 0; i < 6; i++) rows.push(['13/01/2023', `0${i}:30`, 'Owl', `msg ${i}`]);
    for (let i = 0; i < 6; i++) rows.push(['14/01/2023', `1${i}:00`, 'Normal', `msg ${i}`]);
    const s = stats(build(rows));
    expect(s.awards.nightOwl).toBe('Owl');
  });
});

describe('ghost award', () => {
  it('counts a trailing disappearance, not just mid-chat gaps', () => {
    const s = stats(
      build([
        ['01/01/2023', '09:00', 'Ghost', 'I am here'],
        ['01/01/2023', '09:01', 'Alon', 'hi'],
        ['01/06/2023', '09:00', 'Alon', 'anyone still alive'],
      ]),
    );
    const ghost = s.people.find((p) => p.name === 'Ghost')!;
    expect(Math.round(ghost.longestSilenceDays)).toBe(151);
    expect(ghost.stillGone).toBe(true);
    expect(s.awards.ghost).toBe('Ghost');
  });
});

describe('chaotic day', () => {
  it('finds the spike relative to the chat baseline', () => {
    const rows: [string, string, string, string][] = [];
    for (let d = 1; d <= 20; d++) {
      rows.push([`${String(d).padStart(2, '0')}/01/2023`, '10:00', 'Alon', 'normal day']);
    }
    for (let i = 0; i < 40; i++) {
      rows.push(['21/01/2023', `${String(9 + (i % 12)).padStart(2, '0')}:00`, 'Alon', `chaos ${i}`]);
    }
    const s = stats(build(rows));
    expect(s.busiestDay!.day).toBe('2023-01-21');
    expect(s.busiestDay!.count).toBe(40);
    expect(s.explosions[0]!.day).toBe('2023-01-21');
    expect(s.explosions[0]!.zScore).toBeGreaterThan(2);
  });
});

describe('streaks and silences', () => {
  it('finds the longest run of consecutive active days', () => {
    const s = stats(
      build([
        ['01/01/2023', '10:00', 'Alon', 'a'],
        ['02/01/2023', '10:00', 'Alon', 'b'],
        ['03/01/2023', '10:00', 'Alon', 'c'],
        ['20/01/2023', '10:00', 'Alon', 'd'],
      ]),
    );
    expect(s.longestStreak).toEqual({ days: 3, from: '2023-01-01', to: '2023-01-03' });
    expect(s.silences[0]!.days).toBe(17);
    expect(s.silences[0]!.brokenBy!.body).toBe('d');
  });
});

describe('span', () => {
  it('reports the real export range rather than a calendar year', () => {
    const s = stats(
      build([
        ['15/03/2021', '10:00', 'Alon', 'first ever'],
        ['02/08/2026', '10:00', 'Alon', 'still going'],
      ]),
    );
    expect(s.span.first).toBe('2021-03-15');
    expect(s.span.last).toBe('2026-08-02');
    expect(s.span.label).toBe('Mar 2021 – Aug 2026');
  });
});

describe('group name', () => {
  it('recovers the name from the export filename', () => {
    const s = stats(SYSTEM_LINES, 'WhatsApp Chat with The Boys.txt');
    expect(s.groupName).toBe('The Boys');
  });

  it('falls back to the created-group notice', () => {
    const s = stats(SYSTEM_LINES);
    expect(s.groupName).toBe('Test Group');
  });
});

describe('emoji', () => {
  it('counts ZWJ sequences and skin tones as one emoji', () => {
    const s = stats(
      build([
        ['13/01/2023', '10:00', 'Alon', 'family 👨‍👩‍👧 thumbs 👍🏽 flag 🇮🇱'],
      ]),
    );
    expect(s.totalEmoji).toBe(3);
    // All three tie at one use, so ordering falls back to localeCompare.
    expect(s.topEmoji.map((e) => e.value).sort()).toEqual(
      ['👍🏽', '👨‍👩‍👧', '🇮🇱'].sort(),
    );
  });

  it('keeps a zero-width-joined emoji whole rather than counting its parts', () => {
    const s = stats(
      build([['13/01/2023', '10:00', 'Alon', 'deploying \u{1F468}‍\u{1F4BB} again']]),
    );
    expect(s.totalEmoji).toBe(1);
    expect(s.topEmoji[0]!.value).toBe('\u{1F468}‍\u{1F4BB}');
  });
});
