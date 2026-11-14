import { describe, expect, test } from 'bun:test';
import { allowsStages, combineProblem, type CombinePolicy, type Neighbour } from './combine';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const cl = { id: 1, name: 'Casual Leave', stages: 1 as const, combineWith: 'single' as const };
const el = { id: 2, name: 'Earned Leave', stages: 2 as const, combineWith: 'double' as const };
const sl = { id: 3, name: 'Special Leave', stages: 1 as const, combineWith: 'single' as const };
const open = { id: 4, name: 'Open Leave', stages: 1 as const, combineWith: 'both' as const };
const none = { id: 5, name: 'Solo Leave', stages: 1 as const, combineWith: 'none' as const };
const at = (p: CombinePolicy, start: string, end: string): Neighbour => ({ ...p, start, end });
const check = (p: CombinePolicy, start: string, end: string, others: Neighbour[], worked: string[] = [], gazetted: string[] = []) =>
  combineProblem(p, start, end, others, WEEK, new Set(gazetted), new Set(worked));

describe('combining leaves', () => {
  test('which stages each setting allows', () => {
    expect(allowsStages('both', 1) && allowsStages('both', 2)).toBe(true);
    expect([allowsStages('single', 1), allowsStages('single', 2)]).toEqual([true, false]);
    expect([allowsStages('double', 1), allowsStages('double', 2)]).toEqual([false, true]);
    expect([allowsStages('none', 1), allowsStages('none', 2)]).toEqual([false, false]);
  });

  test('CL on 29-30 Oct, EL from Mon 2 Nov is refused; the weekend does not break the chain', () => {
    expect(check(el, '2026-11-02', '2026-11-04', [at(cl, '2026-10-29', '2026-10-30')])).toContain('cannot be taken straight after Casual Leave');
    expect(check(cl, '2026-10-29', '2026-10-30', [at(el, '2026-11-02', '2026-11-04')])).toContain('straight before Earned Leave');
  });

  test('allowed once the employee has worked a day with a punch in between', () => {
    expect(check(el, '2026-11-03', '2026-11-04', [at(cl, '2026-10-29', '2026-10-30')], ['2026-11-02'])).toBeNull();
  });

  test('a working day without a punch does not count as a gap', () => {
    expect(check(el, '2026-11-03', '2026-11-04', [at(cl, '2026-10-29', '2026-10-30')], [])).not.toBeNull();
  });

  test('a punch on a weekly off or a holiday does not count as a gap', () => {
    expect(check(el, '2026-11-03', '2026-11-04', [at(cl, '2026-10-29', '2026-10-30')], ['2026-10-31'])).not.toBeNull();
    expect(check(el, '2026-11-03', '2026-11-04', [at(cl, '2026-10-29', '2026-10-30')], ['2026-11-02'], ['2026-11-02'])).not.toBeNull();
  });

  test('same stage joins, and the same leave type always joins', () => {
    expect(check(cl, '2026-11-02', '2026-11-02', [at(sl, '2026-10-29', '2026-10-30')])).toBeNull();
    expect(check(cl, '2026-11-02', '2026-11-02', [at(cl, '2026-10-29', '2026-10-30')])).toBeNull();
  });

  test('both sides must agree', () => {
    expect(check(open, '2026-11-02', '2026-11-02', [at(none, '2026-10-29', '2026-10-30')])).not.toBeNull();
    expect(check(none, '2026-11-02', '2026-11-02', [at(open, '2026-10-29', '2026-10-30')])).not.toBeNull();
    expect(check(open, '2026-11-02', '2026-11-02', [at(el, '2026-10-29', '2026-10-30')])).not.toBeNull(); // Earned Leave takes 2-stage leaves only
    expect(check(open, '2026-11-02', '2026-11-02', [at({ ...open, id: 6 }, '2026-10-29', '2026-10-30')])).toBeNull();
  });

  test('a leave far away is not joined', () => {
    expect(check(el, '2026-12-20', '2026-12-21', [at(cl, '2026-10-29', '2026-10-30')])).toBeNull();
  });
});

describe('Casual Leave and regular leave never in one chain', () => {
  const casual = { id: 11, name: 'Casual Leave', stages: 1 as const, combineWith: 'single' as const, casual: true };
  const scl = { id: 12, name: 'Special Casual Leave', stages: 1 as const, combineWith: 'both' as const };
  const earned = { id: 13, name: 'Earned Leave', stages: 2 as const, combineWith: 'both' as const };
  const on = (p: CombinePolicy, start: string, end: string): Neighbour => ({ ...p, start, end });

  test('SCL between CL and EL is refused (Tue CL, Wed SCL, Thu EL)', () => {
    expect(check(scl, '2026-11-04', '2026-11-04', [on(casual, '2026-11-03', '2026-11-03'), on(earned, '2026-11-05', '2026-11-05')])).toContain('not both');
  });
  test('EL after a CL + SCL chain is refused too', () => {
    expect(check(earned, '2026-11-05', '2026-11-05', [on(casual, '2026-11-03', '2026-11-03'), on(scl, '2026-11-04', '2026-11-04')])).toContain('Casual Leave and Earned Leave');
  });
  test('SCL with only CL, or only EL, is fine', () => {
    expect(check(scl, '2026-11-04', '2026-11-04', [on(casual, '2026-11-03', '2026-11-03')])).toBeNull();
    expect(check(scl, '2026-11-04', '2026-11-04', [on(earned, '2026-11-05', '2026-11-05')])).toBeNull();
  });
});
