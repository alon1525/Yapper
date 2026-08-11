import { describe, expect, it } from 'vitest';
import { createPseudonymizer } from '../src/anonymize/anonymize';
import { detectLanguage } from '../src/lang/language';
import { parseChat } from '../src/parse/parse';
import { analyzeCommitments, findStalledPlans } from '../src/patterns/commitments';
import { analyzeInteractions } from '../src/patterns/interactions';
import { analyzePhrases } from '../src/patterns/phrases';
import { planDeck, type PlanInput } from '../src/report/plan';
import { computeStats } from '../src/stats/stats';
import type { Finding } from '../src/report/schema';
import { GYM_GROUP, PING_PONG_GROUP, QUIET_GROUP } from './groups';

/**
 * The planner's job is to say no. These tests are almost entirely about what
 * does *not* end up in the deck — a planner that keeps everything passes any
 * test that only checks what it kept.
 */

function build(text: string, findings: { finding: Finding; strength: number }[] = []): PlanInput {
  const parsed = parseChat(text);
  const language = detectLanguage(parsed.messages);
  const p = createPseudonymizer(parsed.participants);

  return {
    stats: computeStats(parsed, { language }),
    interactions: analyzeInteractions(parsed),
    commitments: analyzeCommitments(parsed, language),
    phrases: analyzePhrases(parsed, language, { minCount: 3, minSignatureUses: 3 }),
    stalledPlans: findStalledPlans(parsed, language),
    findings,
    tokenOf: (name) => p.tokenFor(name),
  };
}

const reason = (plan: ReturnType<typeof planDeck>, id: string) =>
  plan.suppressed.find((s) => s.slide === id)?.reason;

const has = (plan: ReturnType<typeof planDeck>, id: string) =>
  plan.briefs.some((b) => b.id === id);

describe('weak-statistic suppression', () => {
  it('drops the reply-time slide when the export only records minutes', () => {
    // Android exports without seconds: every same-minute reply is a gap of
    // exactly zero, so "replies in 0s" claims precision the file never had.
    const plan = planDeck(build(GYM_GROUP));

    expect(has(plan, 'stat-reply-speed')).toBe(false);
    expect(reason(plan, 'stat-reply-speed')).toMatch(/only to the minute/);
  });

  it('drops the leaderboard when nobody is actually ahead', () => {
    const even = [
      ...Array.from({ length: 30 }, (_, i) =>
        `0${(i % 9) + 1}/03/2023, 1${i % 9}:00 - ${['Ann', 'Bo', 'Cy'][i % 3]}: message ${i}`,
      ),
    ].join('\n');

    const plan = planDeck(build(even));
    expect(has(plan, 'stat-leaderboard')).toBe(false);
    expect(reason(plan, 'stat-leaderboard')).toMatch(/same amount/);
  });

  it('drops the ghost slide when the longest silence is a fortnight', () => {
    const plan = planDeck(build(PING_PONG_GROUP));
    const note = reason(plan, 'stat-ghost');
    if (has(plan, 'stat-ghost')) {
      // If it survived, it must be because somebody really did vanish.
      const brief = plan.briefs.find((b) => b.id === 'stat-ghost')!;
      const days = brief.stats.find((s) => s.label === 'Longest silence, days')!.value as number;
      expect(days).toBeGreaterThanOrEqual(30);
    } else {
      expect(note).toBeDefined();
    }
  });

  it('strips a nearly-empty chat down to almost nothing', () => {
    const plan = planDeck(build(QUIET_GROUP));

    // Four messages cannot support a leaderboard, a ghost, a killer or a
    // monologue. The opener is the only thing that is honestly available.
    expect(plan.briefs.map((b) => b.id)).toContain('stat-opening');
    expect(plan.briefs.length).toBeLessThanOrEqual(3);
    expect(plan.suppressed.length).toBeGreaterThan(5);
  });

  it('records a reason for everything it dropped', () => {
    const plan = planDeck(build(GYM_GROUP));
    for (const note of plan.suppressed) {
      expect(note.reason.length).toBeGreaterThan(0);
      expect(note.slide.length).toBeGreaterThan(0);
    }
  });
});

describe('persona cards', () => {
  it('does not hand a card to somebody with eleven messages', () => {
    const plan = planDeck(build(QUIET_GROUP));
    expect(plan.briefs.filter((b) => b.type === 'persona')).toHaveLength(0);
  });

  it('gives a card only to people with enough material', () => {
    const plan = planDeck(build(PING_PONG_GROUP));
    const personas = plan.briefs.filter((b) => b.type === 'persona');

    expect(personas.length).toBeGreaterThan(0);
    for (const card of personas) {
      // Every card must carry a real figure for the writer to build on, so it
      // cannot be swapped with anybody else's.
      expect(card.stats.length).toBeGreaterThanOrEqual(4);
      expect(card.people).toHaveLength(1);
    }
  });
});

describe('discovered slides', () => {
  const finding = (over: Partial<Finding> = {}): Finding => ({
    id: 'f1',
    kind: 'custom_slide',
    claim: 'The group has been almost booking one holiday for three years',
    detail: '',
    people: ['Person A'],
    evidenceMessageIds: [0, 4, 6],
    quotes: [],
    confidence: 0.9,
    comedy: 0.9,
    recognition: 0.9,
    uniqueness: 0.9,
    sensitivity: 'low',
    ...over,
  });

  it('omits a discovered slide whose evidence is too thin', () => {
    const plan = planDeck(
      build(GYM_GROUP, [
        { finding: finding({ id: 'strong' }), strength: 0.8 },
        { finding: finding({ id: 'weak' }), strength: 0.12 },
      ]),
    );

    expect(has(plan, 'custom-strong')).toBe(true);
    expect(has(plan, 'custom-weak')).toBe(false);
    expect(reason(plan, 'custom-weak')).toMatch(/too thin/);
  });

  it('caps discovered slides and says what it cut', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      finding: finding({ id: `f${i}` }),
      strength: 0.9 - i * 0.01,
    }));
    const plan = planDeck(build(GYM_GROUP, many), { maxCustomSlides: 4 });

    expect(plan.briefs.filter((b) => b.type === 'custom_discovery')).toHaveLength(4);
    expect(plan.suppressed.filter((s) => s.reason.includes('past the cap')).length).toBe(10);
  });

  it('carries every finding evidence id onto the slide that came from it', () => {
    const plan = planDeck(build(GYM_GROUP, [{ finding: finding(), strength: 0.8 }]));
    const brief = plan.briefs.find((b) => b.id === 'custom-f1')!;

    expect(brief.evidenceMessageIds).toEqual([0, 4, 6]);
    expect(brief.findingIds).toEqual(['f1']);
  });

  it('picks a slide shape that suits the kind of finding', () => {
    const plan = planDeck(
      build(GYM_GROUP, [
        { finding: finding({ id: 'joke', kind: 'inside_joke' }), strength: 0.8 },
        { finding: finding({ id: 'liar', kind: 'contradiction' }), strength: 0.8 },
        { finding: finding({ id: 'old', kind: 'nostalgic_moment' }), strength: 0.8 },
      ]),
    );

    const format = (id: string) => plan.briefs.find((b) => b.id === id)?.format;
    expect(format('custom-joke')).toBe('dictionary_entry');
    expect(format('custom-liar')).toBe('court_case');
    expect(format('custom-old')).toBe('timeline');
  });
});

describe('deck shape', () => {
  it('opens on the opener and ends on the personas', () => {
    const plan = planDeck(
      build(GYM_GROUP, [
        {
          finding: {
            id: 'f1',
            kind: 'custom_slide',
            claim: 'x',
            detail: '',
            people: [],
            evidenceMessageIds: [0],
            quotes: [],
            confidence: 0.9,
            comedy: 0.9,
            recognition: 0.9,
            uniqueness: 0.9,
            sensitivity: 'low',
          },
          strength: 0.9,
        },
      ]),
    );

    expect(plan.briefs[0]!.type).toBe('opening');
    const types = plan.briefs.map((b) => b.type);
    if (types.includes('persona')) {
      expect(types.lastIndexOf('persona')).toBe(types.length - 1);
    }
  });

  it('never emits two slides with the same id', () => {
    const plan = planDeck(build(GYM_GROUP));
    const ids = plan.briefs.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Score axes.
 *
 * The dossier's bars are the one thing on a slide that looks measured and could
 * quietly not be. These tests are about the axes that must *not* appear: an axis
 * whose leader never reached a level worth naming draws a bar reading 100 next
 * to a label nobody in the chat has earned, and that is worse than no bar.
 */
describe('score axes', () => {
  /*
    Built here rather than taken from `groups.ts` because these tests are about
    a *distribution*, and the shared fixtures are all deliberately small — under
    `MIN_PERSONA_MESSAGES` nobody gets a dossier at all, so there is nothing to
    score. Three people, a clear volume skew, and every message in the afternoon
    so the night axis has nothing to find.
  */
  const skewed = (counts: Record<string, number>): string => {
    const lines: string[] = [];
    let n = 0;
    for (const [who, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i++) {
        // Spread across months so a standing claim can clear the two-day rule.
        const day = (i % 26) + 1;
        const month = (i % 5) + 1;
        lines.push(
          `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/2024, ` +
            `${String(13 + (i % 6)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} - ` +
            `${who}: message number ${n++} about nothing in particular`,
        );
      }
    }
    return lines.join('\n');
  };

  const SKEWED_GROUP = skewed({ Dana: 120, Eli: 60, Noa: 24 });

  const axesFor = (text: string) => {
    const plan = planDeck(build(text));
    const out = new Map<string, Map<string, number>>();
    for (const brief of plan.briefs.filter((b) => b.format === 'profile')) {
      out.set(brief.people[0]!, new Map(brief.scoreAxes.map((a) => [a.key, a.value])));
    }
    return out;
  };

  it('gives every dossier the same axes, so two cards can be compared', () => {
    const axes = axesFor(SKEWED_GROUP);
    const keys = [...axes.values()].map((m) => [...m.keys()].sort().join(','));

    expect(keys.length).toBeGreaterThan(1);
    expect(new Set(keys).size).toBe(1);
  });

  it('scales the leader of an axis to 100', () => {
    const axes = axesFor(SKEWED_GROUP);
    const volumes = [...axes.values()].map((m) => m.get('volume')).filter((v) => v !== undefined);

    expect(volumes.length).toBeGreaterThan(0);
    expect(Math.max(...(volumes as number[]))).toBe(100);
  });

  it('drops an axis nobody in the group actually scored on', () => {
    // Nobody in the gym group posts after midnight. Relative spread alone would
    // still hand somebody a 100 for being fractionally the most nocturnal of a
    // group of people who are all asleep.
    const axes = axesFor(SKEWED_GROUP);
    expect(axes.size).toBeGreaterThan(0);
    for (const person of axes.values()) expect(person.has('night')).toBe(false);
  });

  it('gives a two-person chat no axes at all', () => {
    // Every axis in a pair is 100 and 0 by construction — a bar chart of which
    // of two people is taller, drawn as if it were a finding.
    const axes = axesFor(PING_PONG_GROUP);
    for (const person of axes.values()) expect(person.size).toBe(0);
  });

  it('gives a chat too small to compare nobody a card to score', () => {
    const plan = planDeck(build(QUIET_GROUP));
    expect(plan.briefs.filter((b) => b.format === 'profile' && b.scoreAxes.length > 0)).toHaveLength(0);
  });
});
