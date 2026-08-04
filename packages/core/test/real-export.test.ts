import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChat } from '../src/parse/parse';
import { computeStats } from '../src/stats/stats';
import { findCandidateMoments } from '../src/moments/moments';
import { anonymizeMessages, createPseudonymizer } from '../src/anonymize/anonymize';

/**
 * Verification against a genuine WhatsApp export.
 *
 * Real exports are private data and are never committed, so this suite is opt-in:
 *
 *   WRAPPED_REAL_EXPORT="C:\path\to\WhatsApp Chat with X.txt" npm test
 *
 * Without the variable the suite skips. Synthetic fixtures cannot catch the
 * things that actually break a parser — locale-specific date order, invisible
 * characters, dialects of system notice — which is why this exists at all.
 */
const exportPath = process.env.WRAPPED_REAL_EXPORT;
const suite = exportPath ? describe : describe.skip;

suite('real export', () => {
  const raw = exportPath ? readFileSync(exportPath, 'utf8') : '';
  const parsed = parseChat(raw);

  it('accounts for every line in the file', () => {
    const d = parsed.diagnostics;
    // The invariant that actually catches parser bugs: no line may go missing,
    // be double-counted, or land in a bucket we did not intend.
    expect(d.headerLines + d.continuationLines + d.orphanLines).toBe(d.totalLines);
    expect(d.orphanLines).toBe(0);
    expect(d.headerLines).toBeGreaterThan(0);
  });

  it('resolves the date order from evidence, not a guess', () => {
    expect(parsed.dateOrderConfidence).toBe('certain');
  });

  it('is chronological apart from WhatsApp\'s own ordering quirks', () => {
    // Real exports are NOT perfectly sorted, and assuming otherwise is a trap:
    //  - the end-to-end-encryption notice carries the *export* date, so it can
    //    sit at the top dated years after the first real message;
    //  - messages sent within the same minute from different devices land in
    //    delivery order, not clock order.
    // A real export shows a handful of these in six figures of messages. What
    // matters is that they stay negligible, since the date-order tiebreak and
    // every gap calculation are built to tolerate a few but not a flood.
    let previous = -Infinity;
    let backwards = 0;
    for (const m of parsed.messages) {
      const t = m.ts.getTime();
      if (t < previous) backwards++;
      previous = t;
    }
    expect(backwards / parsed.messages.length).toBeLessThan(0.001);
  });

  it('keeps every calendar field inside its legal range', () => {
    // One pass with plain comparisons: an `expect` per field across six figures
    // of messages is slow enough to time the suite out on its own.
    const offenders = parsed.messages.filter(
      (m) =>
        m.localMonth < 1 ||
        m.localMonth > 12 ||
        m.localDay < 1 ||
        m.localDay > 31 ||
        m.localHour < 0 ||
        m.localHour > 23 ||
        m.localMinute < 0 ||
        m.localMinute > 59 ||
        m.localWeekday < 0 ||
        m.localWeekday > 6,
    );
    expect(offenders.map((m) => m.lineStart)).toEqual([]);
  });

  it('never attributes a system notice to a participant', () => {
    for (const m of parsed.messages) {
      if (m.kind === 'system') expect(m.sender).toBeNull();
      else expect(m.sender).not.toBeNull();
    }
  });

  it('finds no unrecognised export dialect', () => {
    // A `suspicious-sender` warning means lines exist that are neither a
    // message nor a system notice we know about — i.e. a dialect to handle.
    const suspicious = parsed.warnings.find((w) => w.code === 'suspicious-sender');
    expect(suspicious?.lines ?? []).toEqual([]);
  });

  it('computes stats and moments without throwing', () => {
    const stats = computeStats(parsed);
    expect(stats.totalMessages).toBeGreaterThan(0);
    expect(stats.people.length).toBeGreaterThan(0);
    expect(stats.span.days).toBeGreaterThan(0);

    // Shares must sum to 1 — a cheap check that no message was double-counted
    // or dropped between the parser and the per-person accumulators.
    const shareSum = stats.people.reduce((s, p) => s + p.share, 0);
    expect(shareSum).toBeCloseTo(1, 6);

    const messageSum = stats.people.reduce((s, p) => s + p.messages, 0);
    expect(messageSum).toBe(stats.totalMessages);

    expect(findCandidateMoments(parsed).length).toBeGreaterThan(0);
  });

  it('puts no real name in a sender field', () => {
    // The hard guarantee: whatever happens inside message text, the sender
    // column that structures the whole prompt is always tokenised.
    const p = createPseudonymizer(parsed.participants);
    const anonymized = anonymizeMessages(
      parsed.messages.filter((m) => m.kind !== 'system'),
      p,
    );
    const senders = new Set(anonymized.map((m) => m.sender));
    for (const sender of senders) expect(sender).toMatch(/^Person [A-Z]+$/);
  });

  it('redacts display names out of message bodies', () => {
    const p = createPseudonymizer(parsed.participants);
    const sample = parsed.messages.filter((m) => m.kind !== 'system').slice(0, 20_000);
    const bodies = anonymizeMessages(sample, p)
      .map((m) => m.text)
      .join('\n');

    // Standalone occurrences of a display name — including Hebrew's glued-on
    // prefixes (לנדב, ונדב) — must be gone.
    for (const name of parsed.participants) {
      for (const part of name.split(/[\s._-]+/)) {
        if (part.length < 3) continue;
        const standalone = new RegExp(
          `(?<![\\p{L}\\p{N}])[\\u05D5\\u05D4\\u05D1\\u05DC\\u05DE\\u05E9\\u05DB]{0,2}${part.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          )}(?![\\p{L}\\p{N}])`,
          'giu',
        );
        expect(bodies.match(standalone) ?? []).toEqual([]);
      }
    }
  });

  it('documents what redaction cannot reach', () => {
    // Stated as a test so the limit stays visible rather than becoming a
    // surprise: only WhatsApp *display names* are derivable from an export.
    // Groups address each other by invented nicknames that appear nowhere in
    // the participant list, and no amount of regex recovers those. The landing
    // copy must not claim otherwise.
    expect(parsed.participants.length).toBeGreaterThan(0);
  });
});
