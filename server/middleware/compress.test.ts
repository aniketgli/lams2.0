import { describe, expect, test } from 'bun:test';
import { shouldGzip } from './compress';

describe('shouldGzip', () => {
  test('only big bodies for clients that accept gzip', () => {
    expect(shouldGzip('gzip, deflate, br', 5000)).toBe(true);
    expect(shouldGzip('gzip', 100)).toBe(false);
    expect(shouldGzip('br', 5000)).toBe(false);
    expect(shouldGzip(undefined, 5000)).toBe(false);
  });
});
