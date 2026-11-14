import { describe, expect, test } from 'bun:test';
import { LOGO_ERROR, LOGO_MAX_BYTES, logoProblem } from './logoRules';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const url = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;

describe('organization logo upload limits', () => {
  test('a real small PNG is accepted; no logo is fine', () => {
    expect(logoProblem(url('image/png', PNG))).toBeNull();
    expect(logoProblem(null)).toBeNull();
  });
  test('the label must match the bytes (HTML / SVG / script named .png is refused)', () => {
    expect(logoProblem(url('image/png', Buffer.from('<svg onload=alert(1)>')))).toBe(LOGO_ERROR);
    expect(logoProblem(url('image/jpeg', PNG))).toBe(LOGO_ERROR);
    expect(logoProblem(url('image/svg+xml', PNG))).toBe(LOGO_ERROR);
    expect(logoProblem('javascript:alert(1)')).toBe(LOGO_ERROR);
  });
  test('more than 1 MB is refused', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(logoProblem(url('image/png', big))).toBe(LOGO_ERROR);
  });
});
