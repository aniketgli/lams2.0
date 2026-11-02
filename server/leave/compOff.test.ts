import { describe, expect, test } from 'bun:test';
import { type Credit, balanceFromCredits, creditProblem, creditValidUntil } from './compOffRules';

const credit = (over: Partial<Credit> = {}): Credit => ({ date: '2026-11-08', in: '09:05', out: '17:30', hours: 8.42, reason: 'Weekly off', validUntil: '2026-12-09', usedBy: null, usedStatus: null, ...over });

describe('validity', () => {
  test('policy example: worked 8 Nov (Sun) is usable up to 9 Dec', () => {
    expect(creditValidUntil('2026-11-08')).toBe('2026-12-09');
  });
  test('end of month and year', () => {
    expect(creditValidUntil('2026-01-31')).toBe('2026-03-01'); // 28 Feb + 1
    expect(creditValidUntil('2026-12-31')).toBe('2027-02-01');
    expect(creditValidUntil('2026-12-08')).toBe('2027-01-09');
  });
});
describe('taking a credit', () => {
  test('a valid single day after the work day', () => {
    expect(creditProblem(credit(), '2026-11-20', '2026-11-20', 1)).toBeNull();
    expect(creditProblem(credit(), '2026-12-09', '2026-12-09', 1)).toBeNull();
  });
  test('refused: none chosen, used, many days, before the work day, after validity', () => {
    expect(creditProblem(undefined, '2026-11-20', '2026-11-20', 1)).toContain('Choose');
    expect(creditProblem(credit({ usedBy: 5 }), '2026-11-20', '2026-11-20', 1)).toContain('already used');
    expect(creditProblem(credit(), '2026-11-20', '2026-11-21', 2)).toContain('single full day');
    expect(creditProblem(credit(), '2026-11-08', '2026-11-08', 1)).toContain('after the day you worked');
    expect(creditProblem(credit(), '2026-12-10', '2026-12-10', 1)).toContain('valid up to 2026-12-09');
  });
});
test('balance counts valid credits, taken and waiting', () => {
  const b = balanceFromCredits([credit(), credit({ date: '2026-11-09', usedStatus: 'approved', usedBy: 1 }), credit({ date: '2026-11-15', usedStatus: 'pending', usedBy: 2 })]);
  expect(b).toEqual({ total: 3, carryForward: 0, used: 1, pending: 1, available: 1 });
});
