import { describe, expect, it } from 'vitest';
import { computeStats, findCandidateMoments, parseChat } from '@wrapped/core';
import type { Brief } from '@/lib/brief';
import { excerptChars } from '@/lib/guard';
import { buildPremiumPayload } from '@/lib/premiumPayload';
import { premiumPrompt, premiumSystem } from '@/lib/premiumPrompt';
import { RequestSchema } from '@/lib/premiumRequest';

/**
 * What the paid report is built from.
 *
 * Everything here guards a failure that is invisible at runtime: the request
 * still validates, the model still answers, the schema still parses, and the
 * report is quietly generic again. There is no error to notice, so these are
 * the only place the difference is recorded.
 */

function build(rows: [string, string, string, string][]): string {
  return rows.map(([d, t, s, b]) => `${d}, ${t} - ${s}: ${b}`).join('\n');
}

/*
  Three years, real conversation in each, so the year-coverage pass has
  something to cover and the quiet years are genuinely quieter.

  Deliberately more bursts than the payload will keep. An earlier version of
  this fixture produced 39 windows against a limit of 120, which meant the
  round-trip test below passed just as happily against the *old* `.max(48)` —
  a test for a cap that the fixture never reached. The day/month arithmetic has
  period 84, so each year's days stay distinct.
*/
function chat(): string {
  const rows: [string, string, string, string][] = [];
  const volume: Record<string, number> = { '2021': 30, '2022': 84, '2023': 40 };
  for (const [year, days] of Object.entries(volume)) {
    for (let d = 1; d <= days; d++) {
      const day = `${String((d % 28) + 1).padStart(2, '0')}/${String((d % 12) + 1).padStart(2, '0')}/${year}`;
      // Inside one ten-minute window, or each line is its own burst and falls
      // under the six-message floor — which is how this fixture first came back
      // with no candidate moments at all.
      for (let i = 0; i < 8; i++) {
        rows.push([day, `10:0${i}`, i % 2 ? 'ליאת🕎' : 'Alon', `talking about the thing on day ${d} line ${i}`]);
      }
    }
  }
  return build(rows);
}

function analysisOf(raw: string) {
  const parsed = parseChat(raw);
  const stats = computeStats(parsed, {});
  return { parsed, stats, moments: findCandidateMoments(parsed), fileName: 'chat.txt' };
}

const brief: Brief = {
  language: 'he',
  kind: 'Friends group',
  tone: 'roast',
  notes: 'ליאת🕎 never replies because she works nights',
  photos: {},
  groupPhotos: {},
};

describe('the paid payload carries real people', () => {
  const payload = buildPremiumPayload(analysisOf(chat()), brief);

  it('sends real display names, emoji and all', () => {
    // The whole reason this route exists in its current form. A regression to
    // `Person A` here generates and validates exactly as before.
    expect(payload.people.map((p) => p.sender)).toContain('ליאת🕎');
    const senders = payload.moments.flatMap((m) => m.messages.map((x) => x.sender));
    expect(senders).toContain('ליאת🕎');
    expect(senders.every((s) => !/^Person [A-Z]+$/.test(s))).toBe(true);
  });

  it('leaves the notes unscrubbed, so they match the transcript', () => {
    // Scrubbing here would brief the model about `Person C` while handing it a
    // transcript in which nobody is called that.
    expect(payload.brief?.notes).toContain('ליאת🕎');
  });

  it('gives every person their own messages to be written from', () => {
    for (const person of payload.people) {
      expect(person.samples.length).toBeGreaterThan(0);
      for (const sample of person.samples) expect(sample.sender).toBe(person.sender);
    }
  });

  it('carries the tone the reader picked', () => {
    expect(payload.brief?.tone).toBe('roast');
  });
});

describe('the material is spread across the whole history', () => {
  const payload = buildPremiumPayload(analysisOf(chat()), brief);

  it('represents every year, not just the loudest', () => {
    // Pure score ranking gave the busiest year most of the slots and left the
    // quiet ones with none, so the eras section was written from nothing.
    const years = new Set(payload.moments.flatMap((m) => m.messages.map((x) => x.date.slice(0, 4))));
    expect(years).toContain('2021');
    expect(years).toContain('2022');
    expect(years).toContain('2023');
  });

  it('hands the model a transcript that runs forwards', () => {
    const starts = payload.moments.map((m) => m.messages[0]!.id);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe('the excerpt ceiling covers what the payload actually sends', () => {
  const payload = buildPremiumPayload(analysisOf(chat()), brief);

  it('counts the per-person spread', () => {
    // `excerptChars` is the aggregate ceiling the route enforces. The
    // per-person section is the part this change deliberately grew, so a
    // ceiling blind to it is a ceiling that no longer covers the largest thing
    // under it.
    const sampleChars = payload.people.reduce(
      (n, p) => n + p.samples.reduce((m, s) => m + s.text.length, 0),
      0,
    );
    expect(sampleChars).toBeGreaterThan(0);

    const withoutSamples = excerptChars({
      ...payload,
      people: payload.people.map((p) => ({ ...p, samples: [] })),
    });
    expect(excerptChars(payload)).toBe(withoutSamples + sampleChars);
  });

  it('stays under the route’s ceiling on an ordinary chat', () => {
    expect(excerptChars(payload)).toBeLessThan(600_000);
  });
});

describe('the route accepts what the client builds', () => {
  /*
    Every bound in `premiumRequest.ts` is a number written twice — once there
    and once in `premiumPayload.ts`. When they disagree the failure is a 400
    "Malformed request." on a request that has already been paid for, so it is
    the one mismatch in this product that must never reach a person. This is
    that assertion, and it is why the schema does not live inside the route.
  */
  it('parses a real payload against the real schema', () => {
    const result = RequestSchema.safeParse({
      ...buildPremiumPayload(analysisOf(chat()), brief),
      token: 'test-token',
    });
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('cuts a message too long for the schema rather than letting it 400', () => {
    // WhatsApp allows 65,536 characters in one message and the schema rejects
    // over 4,000. Nothing upstream truncates, so one pasted essay inside one
    // selected burst used to be enough.
    const rows: [string, string, string, string][] = [];
    for (let i = 0; i < 8; i++) {
      rows.push(['12/01/2023', `10:0${i}`, i % 2 ? 'Sarah' : 'Alon', `line ${i} of the conversation`]);
    }
    rows.push(['12/01/2023', '10:08', 'Alon', 'x'.repeat(9000)]);
    rows.push(['12/01/2023', '10:09', 'Sarah', 'what on earth was that']);

    const payload = buildPremiumPayload(analysisOf(build(rows)), brief);
    const texts = payload.moments.flatMap((m) => m.messages.map((x) => x.text));
    expect(texts.some((t) => t.endsWith('…[cut]'))).toBe(true);
    for (const text of texts) expect(text.length).toBeLessThanOrEqual(4000);

    expect(RequestSchema.safeParse({ ...payload, token: 'test-token' }).success).toBe(true);
  });
});

describe('the voice the report is written in', () => {
  it('defaults to the roast and refuses to hedge', () => {
    const system = premiumSystem('roast');
    expect(system).toContain('roast');
    expect(system).toContain('No compliment sandwiches');
  });

  it('changes when the reader asks it to', () => {
    expect(premiumSystem('gentle')).not.toContain('No compliment sandwiches');
    expect(premiumSystem('gentle')).toContain('landing warm');
  });

  it('never lets the chat kind become a second tone control', () => {
    // `kind` used to carry the register too ("Family: gentler roast"), which
    // meant a reader who picked Family and left the roast on sent the model two
    // instructions that disagreed.
    const prompt = premiumPrompt(buildPremiumPayload(analysisOf(chat()), { ...brief, kind: 'Family' }));
    expect(prompt).toContain('it does not tell you how hard to go');
  });

  it('puts the transcript in front of the model, not just the figures', () => {
    const prompt = premiumPrompt(buildPremiumPayload(analysisOf(chat()), brief));
    expect(prompt).toContain('in their own words');
    expect(prompt).toContain('=== WHAT HAPPENED ===');
  });
});
