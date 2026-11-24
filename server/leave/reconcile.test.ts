import { describe, expect, test } from 'bun:test';
import { expectedCredit } from './proRataRules';

const base = { joining: '2026-04-10', validUpto: '2027-03-31', basis: 'CY' as const };

describe('Reconcile leave: the pro-rata credit by the rule', () => {
  test('CY: joining in April to the end of the year = 9 started months', () => {
    expect(expectedCredit({ ...base, quota: 8, cycleYear: 2026 })?.days).toBe(6); // 8 × 9 / 12
  });
  test('the next leave year runs to "Valid up to"', () => {
    expect(expectedCredit({ ...base, quota: 8, cycleYear: 2027 })?.days).toBe(2); // Jan–Mar: 8 × 3 / 12
  });
  test('FY basis: the leave year from April', () => {
    expect(expectedCredit({ ...base, basis: 'FY', quota: 12, cycleYear: 2026 })?.days).toBe(12); // Apr 2026 – Mar 2027
  });
  test('a year the employee did not work in has no credit', () => {
    expect(expectedCredit({ ...base, quota: 8, cycleYear: 2028 })).toBeNull();
    expect(expectedCredit({ ...base, quota: 8, cycleYear: 2025 })).toBeNull();
  });
});
