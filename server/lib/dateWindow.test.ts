import { describe, expect, test } from 'bun:test';
import { earliestViewable, historyProblem, monthEnd, monthStart, yearEnd, yearStart } from './dateWindow';

describe('date window', () => {
  test('defaults: this month, this year', () => {
    expect([monthStart('2026-11-10'), monthEnd('2026-11-10')]).toEqual(['2026-11-01', '2026-11-30']);
    expect(monthEnd('2028-02-05')).toBe('2028-02-29');
    expect([yearStart('2026-11-10'), yearEnd('2026-11-10')]).toEqual(['2026-01-01', '2026-12-31']);
  });
  test('administrator: any past date', () => {
    expect(earliestViewable('administrator', '2026-11-10')).toBeNull();
    expect(historyProblem('administrator', '2019-04-01', '2026-11-10')).toBeNull();
  });
  test('everyone else: this year and last year', () => {
    expect(earliestViewable('general_staff', '2026-11-10')).toBe('2025-01-01');
    expect(historyProblem('reporting_manager', '2025-01-01', '2026-11-10')).toBeNull();
    expect(historyProblem('audit', '2024-12-31', '2026-11-10')).toContain('01-01-2025');
  });
});
