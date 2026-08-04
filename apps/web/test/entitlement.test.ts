import { describe, expect, it } from 'vitest';
import { chatFingerprint, mint, verify } from '../lib/entitlement';

/**
 * The paywall is only real if these pass. Everything else about premium — the
 * prompt, the slides, the layout — is cosmetic next to the question of whether
 * a stranger can generate a paid report without paying for it.
 */

const SECRET = 'test-secret-at-least-16-chars';

const CHAT_A = chatFingerprint({
  totalMessages: 173319,
  spanLabel: 'Apr 2017 – Aug 2026',
  participantCount: 18,
});
const CHAT_B = chatFingerprint({
  totalMessages: 412,
  spanLabel: 'Mar 2024',
  participantCount: 4,
});

describe('entitlement', () => {
  it('accepts a token for the chat it was minted for', () => {
    expect(verify(mint(CHAT_A, SECRET), CHAT_A, SECRET).ok).toBe(true);
  });

  it('refuses a token minted for a different chat', () => {
    // The replay that actually costs money: unlock a four-message test chat,
    // then present that token against a 173k-message export.
    const cheap = mint(CHAT_B, SECRET);
    const result = verify(cheap, CHAT_A, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-chat');
  });

  it('refuses a token signed with a different secret', () => {
    const forged = mint(CHAT_A, 'some-other-secret-16chars');
    const result = verify(forged, CHAT_A, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature');
  });

  it('refuses a tampered payload whose signature no longer matches', () => {
    const token = mint(CHAT_A, SECRET);
    const [body, mac] = token.split('.');
    const claims = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as {
      chat: string;
      exp: number;
    };
    claims.exp += 10 * 365 * 24 * 60 * 60 * 1000;
    const rewritten = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${mac}`;
    expect(verify(rewritten, CHAT_A, SECRET).ok).toBe(false);
  });

  it('refuses an expired token', () => {
    const token = mint(CHAT_A, SECRET, 0);
    const result = verify(token, CHAT_A, SECRET, Date.now());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('refuses garbage without throwing', () => {
    // timingSafeEqual throws on a length mismatch, which is exactly the shape a
    // forged token arrives in — so the length check has to come first.
    for (const junk of ['', '.', 'nope', 'a.b', 'a.'.repeat(50)]) {
      expect(() => verify(junk, CHAT_A, SECRET)).not.toThrow();
      expect(verify(junk, CHAT_A, SECRET).ok).toBe(false);
    }
  });

  it('fingerprints differ when the chat differs', () => {
    expect(CHAT_A).not.toBe(CHAT_B);
  });
});
