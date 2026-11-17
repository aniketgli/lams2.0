import { describe, expect, test } from 'bun:test';
import { cycleYearFor, daysToAdd, entitlement, leaveYearRange, monthsTouched, proRataDays, spanLabel } from './proRataRules';
import { spanForNewEmployee, spansForExtension } from './proRataRules';

const FY26 = leaveYearRange(2026, 'FY');
const CY26 = leaveYearRange(2026, 'CY');

describe('pro-rata leave quota', () => {
  test('leave years', () => {
    expect(FY26).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    expect(CY26).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(cycleYearFor('2027-02-10', 'FY')).toBe(2026);
    expect(cycleYearFor('2027-04-01', 'FY')).toBe(2027);
    expect(cycleYearFor('2027-02-10', 'CY')).toBe(2027);
  });

  test('every started month counts, only inside the leave year', () => {
    expect(monthsTouched({ from: '2026-10-31', to: '2026-11-01' }, CY26).size).toBe(2);
    expect(monthsTouched({ from: '2026-11-17', to: '2027-06-30' }, FY26).size).toBe(5); // Nov–Mar
    expect(monthsTouched({ from: '2025-01-01', to: '2030-12-31' }, FY26).size).toBe(12);
    expect(monthsTouched({ from: '2027-05-01', to: '2027-06-30' }, FY26).size).toBe(0);
  });

  test('quota × months ÷ 12, nearest half day', () => {
    expect(proRataDays(20, 4)).toBe(6.5);   // 6.67
    expect(proRataDays(30, 5)).toBe(12.5);
    expect(proRataDays(8, 5)).toBe(3.5);    // 3.33
    expect(proRataDays(20, 12)).toBe(20);
    expect(proRataDays(20, 0)).toBe(0);
  });

  test('new employee', () => {
    expect(entitlement(20, [spanForNewEmployee('2026-11-17', '2027-06-30')], FY26)).toEqual({ months: 5, days: 8.5 });
  });

  test('extension adds only the new months, a month is never counted twice', () => {
    const ext = spansForExtension('2026-04-10', '2026-10-15', '2027-03-31', false, '2026-10-01')!;
    expect(ext.added.from).toBe('2026-10-16');
    const r = daysToAdd(20, ext.before, ext.added, FY26);
    expect(r.monthsBefore).toBe(7);  // Apr–Oct
    expect(r.monthsAfter).toBe(12);
    expect(r.days).toBe(20 - 11.5);  // 20 − round(11.67)
    expect(spanLabel(ext.added, FY26)).toBe('Oct 2026 – Mar 2027');
  });

  test('expired account extended: the expired gap earns nothing', () => {
    const ext = spansForExtension('2026-04-01', '2026-07-31', '2026-12-31', true, '2026-11-17')!;
    expect(ext.added.from).toBe('2026-11-17');
    expect(daysToAdd(12, ext.before, ext.added, FY26)).toEqual({ days: 6 - 4, monthsBefore: 4, monthsAfter: 6 });
  });

  test('shortened or unchanged validity adds nothing', () => {
    expect(spansForExtension('2026-04-01', '2026-12-31', '2026-10-31', false, '2026-05-01')).toBeNull();
    expect(spansForExtension('2026-04-01', '2026-12-31', '2026-12-31', false, '2026-05-01')).toBeNull();
  });
});
