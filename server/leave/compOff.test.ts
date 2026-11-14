import { describe, expect, test } from 'bun:test';
import { type Credit, balanceFromCredits, creditLateUntil, creditValidUntil, matchCredits, monthlyProblem } from './compOffRules';

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
describe('matching worked days to leave days', () => {
  const c = (date: string, validUntil: string, over: Partial<Credit> = {}) => credit({ date, validUntil, ...over });
  const pool = [c('2026-11-01', '2026-12-02'), c('2026-11-08', '2026-12-09'), c('2026-11-15', '2026-12-16')];
  test('two days together, earliest with earliest', () => {
    const r = matchCredits(pool, ['2026-11-08', '2026-11-01'], ['2026-11-20', '2026-11-23']);
    expect(r.problem).toBeNull();
    expect(r.pairs).toEqual([{ work: '2026-11-01', leave: '2026-11-20', late: false }, { work: '2026-11-08', leave: '2026-11-23', late: false }]);
  });
  test('the number of worked days must equal the leave days', () => {
    expect(matchCredits(pool, ['2026-11-01'], ['2026-11-20', '2026-11-23']).problem).toContain('exactly 2');
    expect(matchCredits(pool, [], ['2026-11-20']).problem).toContain('Choose');
  });
  test('refused: unknown, used, repeated, too early, expired', () => {
    expect(matchCredits(pool, ['2026-10-01'], ['2026-11-20']).problem).toContain('not a worked');
    expect(matchCredits([c('2026-11-01', '2026-12-02', { usedBy: 3 })], ['2026-11-01'], ['2026-11-20']).problem).toContain('already used');
    expect(matchCredits(pool, ['2026-11-01', '2026-11-01'], ['2026-11-20', '2026-11-23']).problem).toContain('twice');
    expect(matchCredits(pool, ['2026-11-08'], ['2026-11-08']).problem).toContain('after the day you worked');
    expect(matchCredits(pool, ['2026-11-01'], ['2026-12-03']).problem).toContain('up to 2026-12-02');
  });
});
describe('monthly limit counts days by the month of the leave day', () => {
  test('within the limit', () => {
    expect(monthlyProblem(['2026-11-20', '2026-11-23'], {}, 2)).toBeNull();
    expect(monthlyProblem(['2026-11-30', '2026-12-01'], { '2026-11': 1, '2026-12': 1 }, 2)).toBeNull();
  });
  test('a leave over a month end is charged to each month', () => {
    expect(monthlyProblem(['2026-11-30', '2026-12-01'], { '2026-11': 2 }, 2)).toContain('2026-11');
    expect(monthlyProblem(['2026-11-30', '2026-12-01'], { '2026-12': 2 }, 2)).toContain('2026-12');
  });
  test('three days in one month are over the limit of two; no limit set means none', () => {
    expect(monthlyProblem(['2026-11-20', '2026-11-23', '2026-11-24'], {}, 2)).toContain('at most 2');
    expect(monthlyProblem(['2026-11-20', '2026-11-23', '2026-11-24'], {}, 0)).toBeNull();
  });
});
test('balance counts valid credits, taken and waiting', () => {
  const b = balanceFromCredits([credit(), credit({ date: '2026-11-09', usedStatus: 'approved', usedBy: 1 }), credit({ date: '2026-11-15', usedStatus: 'pending', usedBy: 2 })]);
  expect(b).toEqual({ total: 3, carryForward: 0, used: 1, pending: 1, available: 1 });
});

describe('late compensatory off', () => {
  const base = { in: '09:00', out: '17:00', hours: 8, reason: 'Worked', usedBy: null, usedStatus: null } as const;
  test('after the month it can still be taken to the end of the next calendar month', () => {
    expect(creditLateUntil('2026-11-08')).toBe('2027-01-31');
    expect(creditLateUntil('2026-01-31')).toBe('2026-04-30');
  });
  test('within the month: not late; after it: late; after the late window: lapsed', () => {
    const credit = { ...base, date: '2026-11-08', validUntil: creditValidUntil('2026-11-08'), lateUntil: creditLateUntil('2026-11-08') };
    expect(matchCredits([credit], ['2026-11-08'], ['2026-12-01']).pairs[0].late).toBe(false);
    expect(matchCredits([credit], ['2026-11-08'], ['2026-12-15']).pairs[0].late).toBe(true);
    expect(matchCredits([credit], ['2026-11-08'], ['2027-02-01']).problem).toContain('lapsed');
  });
});
