import { describe, expect, test } from 'bun:test';
import { keyRules, quotaText, type LeaveTypeTextInput } from './leaveTypeText';

const base: LeaveTypeTextInput = {
  code: 'X', defaultQuota: 0, pwdQuota: null, accrual: 'yearly', isDebited: true, isPaid: true, debitFromTypeId: '', debitFactor: 1,
  lifetimeMax: 0, maxConsecutiveDays: 0, maxSpellsPerYear: 0, minServiceMonths: 0, approvalStages: 1, hodAfterDays: 0, halfDayAllowed: false,
  combineWith: 'none', carryForward: false, maxCarryForward: 0, certificateRequired: false, medicalCertDays: 0, offDaysOnly: false, purposes: [],
  gender: 'all', pwdOnly: false,
};
const nameOf = (id: string) => (id === '7' ? 'Half Pay Leave' : id);

describe('quotaText', () => {
  test('never says who sets the balance', () => {
    for (const t of [base, { ...base, isDebited: false }, { ...base, code: 'MAT', isDebited: false }]) {
      expect(quotaText(t, nameOf)).not.toMatch(/Balance Manager/i);
    }
  });
  test('yearly and half-yearly quotas', () => {
    expect(quotaText({ ...base, code: 'CL', defaultQuota: 8 }, nameOf)).toBe('8 days a year');
    expect(quotaText({ ...base, code: 'EL', defaultQuota: 30, accrual: 'half_yearly' }, nameOf)).toBe('30 days a year (15 + 15 half-yearly)');
  });
  test('leaves without a yearly balance', () => {
    expect(quotaText({ ...base, code: 'UL', isDebited: false, isPaid: false }, nameOf)).toBe('No limit');
    expect(quotaText({ ...base, code: 'MAT', isDebited: false }, nameOf)).toBe('180 days per child');
    expect(quotaText({ ...base, code: 'CCL', isDebited: false, lifetimeMax: 730 }, nameOf)).toBe('730 days in service');
    expect(quotaText({ ...base, code: 'COMM', isDebited: false, debitFromTypeId: '7', debitFactor: 2 }, nameOf)).toBe('Uses Half Pay Leave (2 days for each day)');
    expect(quotaText({ ...base, code: 'LND', isDebited: false, debitFromTypeId: '7', lifetimeMax: 360 }, nameOf)).toBe('360 days in service, from Half Pay Leave');
    expect(quotaText({ ...base, code: 'RH', isDebited: false, maxSpellsPerYear: 2 }, nameOf)).toBe('2 a year');
  });
});

describe('keyRules', () => {
  test('two-stage leave counts holidays and names the HoD', () => {
    const rules = Object.fromEntries(keyRules({ ...base, approvalStages: 2, hodAfterDays: 3 }, nameOf).map((r) => [r.label, r.value]));
    expect(rules.Approval).toBe('Reporting Manager → HoD (above 3 days)');
    expect(rules['Holidays inside']).toBe('Counted');
  });
});
