import { describe, expect, test } from 'bun:test';
import { genderKey } from './gender';

describe('genderKey', () => {
  test('reads Male / Female / M / F in any case', () => {
    expect(genderKey('Female')).toBe('female');
    expect(genderKey(' f ')).toBe('female');
    expect(genderKey('MALE')).toBe('male');
    expect(genderKey('M')).toBe('male');
  });
  test('anything else is other, so it gets neither MAT nor PAT', () => {
    expect(genderKey('Other')).toBe('other');
    expect(genderKey('')).toBe('other');
  });
});
