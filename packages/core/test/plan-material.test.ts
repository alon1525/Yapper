import { describe, expect, it } from 'vitest';
import { createPseudonymizer } from '../src/anonymize/anonymize';
import { detectLanguage } from '../src/lang/language';
import { parseChat } from '../src/parse/parse';
import { analyzeCommitments, findStalledPlans } from '../src/patterns/commitments';
import { analyzeInteractions } from '../src/patterns/interactions';
import { analyzePhrases } from '../src/patterns/phrases';
import { planDeck, type PlanInput, type SlideBrief } from '../src/report/plan';
import type { Finding, SlideFormat } from '../src/report/schema';
import { computeStats, dayKey } from '../src/stats/stats';
import type { ParseResult } from '../src/types';

/**
 * What the writer is handed to write *from*.
 *
 * A statistic slide used to reach the writer as an angle, a token and two
 * figures, and came back as the two figures in costume. These tests are about
 * the material the planner now attaches to each event it can locate in the
 * chat — the last words before a silence, the hour a loud day peaked — and
 * about the deck not wearing the same costume twice.
 */

/** Three people; a ghost, a loud day and a group silence, built to order. */
function chat(): string {
  const lines: string[] = [];
  const line = (d: number, m: number, h: number, min: number, who: string, text: string) =>
    lines.push(
      `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2023, ` +
        `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} - ${who}: ${text}`,
    );

  // Ten quiet evenings in January. Cy signs off on the tenth.
  for (let d = 1; d <= 10; d++) {
    line(d, 1, 20, 0, 'Ann', `evening plan ${d}`);
    line(d, 1, 20, 5, 'Bo', `fine by me ${d}`);
    line(d, 1, 20, 10, 'Cy', d === 10 ? 'going offline for a while, bye' : `ok ${d}`);
  }
  // Then nothing for three weeks, then forty messages in one hour. Cy is absent.
  for (let i = 0; i < 40; i++) {
    line(1, 2, 21, i, i % 2 ? 'Bo' : 'Ann', i === 0 ? 'who has the keys' : `keys message ${i}`);
  }
  // March: Cy returns.
  line(20, 3, 12, 0, 'Cy', 'wait what did I miss');
  line(20, 3, 12, 1, 'Ann', 'everything');
  return lines.join('\n');
}

function build(
  text: string,
  findings: { finding: Finding; strength: number }[] = [],
  withMessages = true,
): { input: PlanInput; parsed: ParseResult } {
  const parsed = parseChat(text);
  const language = detectLanguage(parsed.messages);
  const p = createPseudonymizer(parsed.participants);
  return {
    parsed,
    input: {
      stats: computeStats(parsed, { language }),
      interactions: analyzeInteractions(parsed),
      commitments: analyzeCommitments(parsed, language),
      phrases: analyzePhrases(parsed, language, { minCount: 3, minSignatureUses: 3 }),
      stalledPlans: findStalledPlans(parsed, language),
      findings,
      tokenOf: (name) => p.tokenFor(name),
      ...(withMessages ? { messages: parsed.messages } : {}),
    },
  };
}

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'f1',
  kind: 'custom_slide',
  claim: 'They have been almost booking one holiday for three years',
  detail: '',
  people: ['Person A'],
  evidenceMessageIds: [0, 3, 6],
  quotes: [],
  confidence: 0.9,
  comedy: 0.9,
  recognition: 0.9,
  uniqueness: 0.9,
  sensitivity: 'low',
  suggestedTitle: '',
  ...over,
});

const brief = (plan: ReturnType<typeof planDeck>, id: string): SlideBrief => {
  const found = plan.briefs.find((b) => b.id === id);
  if (!found) throw new Error(`no brief ${id}; have ${plan.briefs.map((b) => b.id).join(', ')}`);
  return found;
};

describe('material for the writer', () => {
  it('hands the ghost slide their last words and their return', () => {
    const { input, parsed } = build(chat());
    const plan = planDeck(input);
    const ghost = brief(plan, 'stat-ghost');

    const bodies = ghost.evidenceMessageIds.map((id) => parsed.messages[id]!.body);
    expect(bodies).toContain('going offline for a while, bye');
    expect(bodies).toContain('wait what did I miss');
    // Only their own lines: the silence is theirs.
    for (const id of ghost.evidenceMessageIds) expect(parsed.messages[id]!.sender).toBe('Cy');
  });

  it('hands the loud day how it started and the hour it peaked', () => {
    const { input, parsed } = build(chat());
    const plan = planDeck(input);
    const loud = brief(plan, 'stat-chaos-day');

    expect(loud.evidenceMessageIds.length).toBeGreaterThanOrEqual(6);
    for (const id of loud.evidenceMessageIds) expect(dayKey(parsed.messages[id]!)).toBe('2023-02-01');
    expect(parsed.messages[loud.evidenceMessageIds[0]!]!.body).toBe('who has the keys');
    // A scene wants more than four lines.
    expect(loud.quoteBudget).toBeGreaterThanOrEqual(12);
  });

  it('hands the group silence the last word before it and the line that broke it', () => {
    const { input, parsed } = build(chat());
    const plan = planDeck(input);
    const silence = brief(plan, 'stat-silence');

    // The longest group silence runs from the loud day to Cy's return.
    const days = silence.evidenceMessageIds.map((id) => dayKey(parsed.messages[id]!));
    expect(days).toContain('2023-02-01');
    expect(days).toContain('2023-03-20');
    const bodies = silence.evidenceMessageIds.map((id) => parsed.messages[id]!.body);
    expect(bodies).toContain('wait what did I miss');
  });

  it('pairs each conversation the killer ended with what they ended', () => {
    const { input, parsed } = build(chat());
    const plan = planDeck(input);
    const killer = brief(plan, 'stat-killer');

    // Cy closed every January evening. Each cited kill comes with the line
    // before it, by somebody else.
    const senders = killer.evidenceMessageIds.map((id) => parsed.messages[id]!.sender);
    expect(senders).toContain('Cy');
    expect(senders.some((s) => s !== 'Cy')).toBe(true);
  });

  it('still briefs every slide from figures alone when the chat is not handed over', () => {
    const { input } = build(chat(), [], false);
    const plan = planDeck(input);
    const ghost = brief(plan, 'stat-ghost');

    expect(ghost.evidenceMessageIds).toEqual([]);
    expect(ghost.stats.length).toBeGreaterThan(0);
  });

  it('budgets quotes by what the slide is', () => {
    const { input } = build(chat(), [
      { finding: finding({ id: 'scene', kind: 'legendary_moment' }), strength: 0.9 },
      { finding: finding({ id: 'claim', kind: 'custom_slide' }), strength: 0.9 },
    ]);
    const plan = planDeck(input);

    expect(brief(plan, 'custom-scene').quoteBudget).toBe(14);
    expect(brief(plan, 'custom-claim').quoteBudget).toBe(6);
    // The opener summarises the strongest findings, so with any to summarise
    // it borrows a couple of their lines each.
    expect(brief(plan, 'stat-opening').quoteBudget).toBe(6);
    expect(brief(plan, 'stat-opening').angle).toContain('(1)');
    for (const b of plan.briefs.filter((b) => b.format === 'profile')) {
      expect(b.quoteBudget).toBe(8);
    }
    // The last slide ranks everyone who got a card, and asks for no lines.
    const rankings = brief(plan, 'stat-rankings');
    expect(rankings.format).toBe('rankings');
    expect(rankings.quoteBudget).toBe(0);
    expect(plan.briefs[plan.briefs.length - 1]!.id).toBe('stat-rankings');
  });

  it('keeps the opener to the totals when nothing was discovered', () => {
    const { input } = build(chat(), []);
    const plan = planDeck(input);
    expect(brief(plan, 'stat-opening').quoteBudget).toBe(0);
    expect(brief(plan, 'stat-opening').angle).not.toContain('(1)');
  });
});

describe('costumes', () => {
  const REPEATABLE = new Set<SlideFormat>(['plain', 'profile', 'dictionary_entry']);

  it('wears no costume twice in one deck', () => {
    const { input } = build(chat(), [
      { finding: finding({ id: 'c1', kind: 'contradiction' }), strength: 0.9 },
      { finding: finding({ id: 'c2', kind: 'contradiction' }), strength: 0.85 },
      { finding: finding({ id: 'c3', kind: 'contradiction' }), strength: 0.8 },
      { finding: finding({ id: 'm1', kind: 'legendary_moment' }), strength: 0.75 },
    ]);
    const plan = planDeck(input);

    const worn = plan.briefs.map((b) => b.format).filter((f) => !REPEATABLE.has(f));
    expect(new Set(worn).size).toBe(worn.length);
  });

  it('lets a discovered slide keep its best fit and dresses the statistics around it', () => {
    const { input } = build(chat(), [
      { finding: finding({ id: 'c1', kind: 'contradiction' }), strength: 0.9 },
    ]);
    const plan = planDeck(input);

    expect(brief(plan, 'custom-c1').format).toBe('breaking_news');
    // Every statistic slide that also wanted the front page stepped aside.
    for (const b of plan.briefs) {
      if (b.id !== 'custom-c1') expect(b.format, b.id).not.toBe('breaking_news');
    }
  });

  it('alternates discovered and measured slides after the opener', () => {
    const { input } = build(chat(), [
      { finding: finding({ id: 'c1', kind: 'contradiction' }), strength: 0.9 },
      { finding: finding({ id: 'c2', kind: 'recurring_topic', people: [] }), strength: 0.85 },
    ]);
    const plan = planDeck(input);

    expect(plan.briefs[0]!.type).toBe('opening');
    expect(plan.briefs[1]!.id.startsWith('custom-')).toBe(true);
    expect(plan.briefs[2]!.id.startsWith('stat-')).toBe(true);
    expect(plan.briefs[3]!.id.startsWith('custom-')).toBe(true);
  });
});
