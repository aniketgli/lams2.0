import { describe, expect, test } from 'bun:test';
import { isoDate, isoTime, profileData } from './sql';

describe('profileData', () => {
  test('parses text, passes objects, survives rubbish', () => {
    expect(profileData('{"a":1}')).toEqual({ a: 1 });
    expect(profileData({ b: 2 })).toEqual({ b: 2 });
    expect(profileData('not json')).toEqual({});
    expect(profileData(null)).toEqual({});
    expect(profileData('"text"')).toEqual({});
  });
});

describe('isoDate / isoTime', () => {
  test('dates', () => {
    expect(isoDate(new Date(2026, 10, 2))).toBe('2026-11-02');
    expect(isoDate('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
  });
  test('times', () => {
    expect(isoTime(null)).toBeNull();
    expect(isoTime('2026-11-02T10:00:00Z')).toBe('2026-11-02T10:00:00.000Z');
  });
});
