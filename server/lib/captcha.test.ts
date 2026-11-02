import { beforeEach, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createCaptcha, drawCaptcha, resetCaptchaForTests, verifyCaptcha } from './captcha';

// The answer is not exposed, so the tests rebuild it the way a solver would: by reading it from a token they made themselves.
const secret = process.env.SESSION_SECRET || 'local-development-only-captcha-key';
function tokenFor(answer: string, expiresInMs = 60_000, nonce = Math.random().toString(36).slice(2)): string {
  const expiresAt = Date.now() + expiresInMs;
  return `${expiresAt}.${nonce}.${createHmac('sha256', secret).update(`${expiresAt}.${nonce}.${answer}`).digest('base64url')}`;
}

beforeEach(resetCaptchaForTests);

describe('captcha', () => {
  test('the right text passes, case and spaces ignored', () => {
    expect(verifyCaptcha(tokenFor('K7M2QX'), 'k7m2qx')).toBe(true);
    expect(verifyCaptcha(tokenFor('K7M2QX'), '  K7M2QX ')).toBe(true);
  });
  test('wrong, empty and non-text answers fail', () => {
    expect(verifyCaptcha(tokenFor('K7M2QX'), 'K7M2QY')).toBe(false);
    expect(verifyCaptcha(tokenFor('K7M2QX'), '')).toBe(false);
    expect(verifyCaptcha(tokenFor('K7M2QX'), undefined)).toBe(false);
    expect(verifyCaptcha(tokenFor('K7M2QX'), 123)).toBe(false);
  });
  test('a token works once, even after a wrong guess', () => {
    const token = tokenFor('K7M2QX');
    expect(verifyCaptcha(token, 'WRONG1')).toBe(false);
    expect(verifyCaptcha(token, 'K7M2QX')).toBe(false);
    const solved = tokenFor('K7M2QX');
    expect(verifyCaptcha(solved, 'K7M2QX')).toBe(true);
    expect(verifyCaptcha(solved, 'K7M2QX')).toBe(false);
  });
  test('an expired, forged or malformed token fails', () => {
    expect(verifyCaptcha(tokenFor('K7M2QX', -1), 'K7M2QX')).toBe(false);
    expect(verifyCaptcha(`${Date.now() + 60_000}.abc.forgedsignature`, 'K7M2QX')).toBe(false);
    for (const bad of [undefined, null, '', 'a.b', 'a.b.c.d', 42, 'x'.repeat(500)]) expect(verifyCaptcha(bad, 'K7M2QX')).toBe(false);
  });
  test('a token cannot be moved to another answer', () => {
    expect(verifyCaptcha(tokenFor('AAAAAA'), 'BBBBBB')).toBe(false);
  });
  test('a created captcha is an svg that does not contain a readable answer in its token', () => {
    const { token, svg } = createCaptcha();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(token.split('.')).toHaveLength(3);
    expect(verifyCaptcha(token, 'AAAAAA')).toBe(false);
  });
  test('the picture is escaped text only', () => {
    expect(drawCaptcha('ABC234')).toContain('>A<');
    expect(drawCaptcha('ABC234')).not.toContain('<script');
  });
});
