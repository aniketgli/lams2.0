import { describe, expect, test } from 'bun:test';
import { trustProxySetting } from './proxy.config';

describe('trust proxy setting', () => {
  test('off by default, so X-Forwarded-For cannot reset the per-address sign-in limit', () => {
    expect(trustProxySetting(undefined)).toBe(false);
    expect(trustProxySetting('')).toBe(false);
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('0')).toBe(false);
  });
  test('a hop count, true, or an address list when a reverse proxy is configured', () => {
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('99')).toBe(10);
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('loopback, 10.0.0.5')).toBe('loopback, 10.0.0.5');
  });
});
