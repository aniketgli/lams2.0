import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Sign-in CAPTCHA, generated and checked entirely on the server (no third-party service, no database).
 *
 *   createCaptcha()           -> { token, svg }   a picture of random characters and a signed token
 *   verifyCaptcha(token, text)                    true only for the right text, once, before it expires
 *
 * The answer is never sent to the browser. The token only holds an expiry, a random nonce and an HMAC of
 * (expiry, nonce, answer) made with the server secret, so it cannot be forged or used to read the answer.
 * Each token works for ONE check (right or wrong): the nonce is remembered until the token expires, so a
 * solved picture cannot be replayed and a wrong guess needs a new picture.
 * The remembered nonces are per server process; with several processes a token could be replayed once per
 * process within its short life, which the sign-in rate limits still cover.
 *
 *   LOGIN_CAPTCHA=off   switches it off (local development / automated tests only)
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L: easy to misread
const LENGTH = 6;
const LIFETIME_MS = 5 * 60 * 1000;
const MAX_USED = 50_000; // cap on remembered nonces, so memory stays bounded under attack

export const captchaEnabled = (): boolean => String(process.env.LOGIN_CAPTCHA ?? 'on').toLowerCase() !== 'off';

const secret = (): string => process.env.SESSION_SECRET || 'local-development-only-captcha-key';
const sign = (expiresAt: number, nonce: string, answer: string): string =>
  createHmac('sha256', secret()).update(`${expiresAt}.${nonce}.${answer}`).digest('base64url');

/** Normalises what the user typed: case and surrounding spaces do not matter. */
const clean = (text: unknown): string => (typeof text === 'string' ? text.trim().toUpperCase() : '');

const used = new Map<string, number>(); // nonce -> expiry
function remember(nonce: string, expiresAt: number): void {
  const now = Date.now();
  if (used.size >= MAX_USED) for (const [key, until] of used) if (until <= now) used.delete(key);
  if (used.size >= MAX_USED) used.delete(used.keys().next().value as string); // still full: drop the oldest
  used.set(nonce, expiresAt);
}

const pick = <T>(list: readonly T[]): T => list[randomInt(list.length)];
const between = (min: number, max: number): number => min + randomInt(Math.round((max - min) * 10) + 1) / 10;

/** The picture: tilted, shifted characters in mixed colours over curved lines and dots. */
export function drawCaptcha(text: string): string {
  const width = 190;
  const height = 64;
  const colours = ['#0f172a', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be123c'];
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Verification characters">`,
    `<rect width="${width}" height="${height}" rx="8" fill="#f1f5f9"/>`];
  for (let i = 0; i < 5; i += 1) {
    const y1 = between(6, height - 6);
    const y2 = between(6, height - 6);
    parts.push(`<path d="M0 ${y1} C ${width / 3} ${between(0, height)}, ${(2 * width) / 3} ${between(0, height)}, ${width} ${y2}" stroke="${pick(colours)}" stroke-opacity="0.45" stroke-width="${between(1, 2)}" fill="none"/>`);
  }
  for (let i = 0; i < 30; i += 1) parts.push(`<circle cx="${between(0, width)}" cy="${between(0, height)}" r="${between(0.6, 1.6)}" fill="${pick(colours)}" fill-opacity="0.5"/>`);
  const step = (width - 24) / text.length;
  [...text].forEach((ch, i) => {
    const x = 16 + i * step + between(-2, 2);
    const y = height / 2 + 10 + between(-6, 6);
    parts.push(`<text x="${x}" y="${y}" font-family="Verdana, Arial, sans-serif" font-size="${between(28, 34)}" font-weight="700" fill="${pick(colours)}" transform="rotate(${between(-22, 22)} ${x} ${y})">${ch}</text>`);
  });
  for (let i = 0; i < 2; i += 1) parts.push(`<path d="M0 ${between(10, height - 10)} Q ${width / 2} ${between(0, height)} ${width} ${between(10, height - 10)}" stroke="${pick(colours)}" stroke-opacity="0.7" stroke-width="1.5" fill="none"/>`);
  parts.push('</svg>');
  return parts.join('');
}

export function createCaptcha(): { token: string; svg: string } {
  let answer = '';
  for (let i = 0; i < LENGTH; i += 1) answer += pick([...ALPHABET]);
  const expiresAt = Date.now() + LIFETIME_MS;
  const nonce = randomBytes(12).toString('base64url');
  return { token: `${expiresAt}.${nonce}.${sign(expiresAt, nonce, answer)}`, svg: drawCaptcha(answer) };
}

/** True only when `text` is the answer the token was made for, the token is fresh and has not been checked before. */
export function verifyCaptcha(token: unknown, text: unknown): boolean {
  if (typeof token !== 'string' || token.length > 200) return false;
  const [expiry, nonce, signature, extra] = token.split('.');
  const expiresAt = Number(expiry);
  if (extra !== undefined || !nonce || !signature || !Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;
  if (used.has(nonce)) return false;
  remember(nonce, expiresAt); // spent on the first check, right or wrong
  const expected = Buffer.from(sign(expiresAt, nonce, clean(text)));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Test helper: forgets spent nonces. */
export function resetCaptchaForTests(): void { used.clear(); }
