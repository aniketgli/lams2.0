import { describe, expect, test } from 'bun:test';
import { addMonths, matchPurpose, paternityEnd, parsePurposes, paternityDaysProblem, paternityProblems, paternityWindow, purposesProblem } from './specialLeave';

describe('purposes', () => {
  test('one per line, trimmed, blanks and repeats dropped', () => {
    expect(parsePurposes(' Bandh \n\nFamily  planning\r\nbandh\n')).toEqual(['Bandh', 'Family planning']);
    expect(parsePurposes(null)).toEqual([]);
  });
  test('only a listed purpose is accepted, stored as listed', () => {
    const list = ['National sports / cultural event', 'Bandh'];
    expect(matchPurpose(list, '  bandh ')).toBe('Bandh');
    expect(matchPurpose(list, 'Wedding')).toBeNull();
  });
  test('limits', () => {
    expect(purposesProblem(['a'.repeat(151)])).toContain('150');
    expect(purposesProblem(Array.from({ length: 21 }, (_, i) => `p${i}`))).toContain('20');
    expect(purposesProblem(['Bandh'])).toBeNull();
  });
});

describe('addMonths', () => {
  test('keeps the day, or the last day of a shorter month', () => {
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
  });
});

describe('paternity leave', () => {
  const birth = { event: 'delivery' as const, eventDate: '2026-12-10', birthDate: null, survivingChildren: 1 };

  test('birth: from 15 days before up to 6 months after the delivery', () => {
    expect(paternityWindow(birth)).toEqual({ from: '2026-11-25', to: '2027-06-10' });
    expect(paternityProblems(birth, '2026-11-25', '2026-12-09')).toEqual({});
    expect(paternityProblems(birth, '2026-11-24', '2026-12-05').startDate).toContain('25-11-2026');
    expect(paternityProblems(birth, '2027-06-05', '2027-06-11').endDate).toContain('lapses');
  });

  test('two or more surviving children: not eligible', () => {
    expect(paternityProblems({ ...birth, survivingChildren: 2 }, '2026-12-10', '2026-12-20').survivingChildren).toContain('less than two');
    expect(paternityProblems({ ...birth, survivingChildren: 0 }, '2026-12-10', '2026-12-20')).toEqual({});
  });

  test('missing details are asked for', () => {
    const e = paternityProblems({ event: null, eventDate: null, birthDate: null, survivingChildren: null }, '2026-12-10', '2026-12-20');
    expect(Object.keys(e).sort()).toEqual(['childEvent', 'childEventDate', 'survivingChildren']);
  });

  test('adoption: child under one year, leave after the adoption date', () => {
    const adoption = { event: 'adoption' as const, eventDate: '2026-12-01', birthDate: '2026-03-01', survivingChildren: 0 };
    expect(paternityProblems(adoption, '2026-12-01', '2026-12-15')).toEqual({});
    expect(paternityProblems(adoption, '2026-11-30', '2026-12-10').startDate).toContain('date of adoption');
    expect(paternityProblems({ ...adoption, birthDate: '2025-12-01' }, '2026-12-01', '2026-12-10').childBirthDate).toContain('less than one year');
    expect(paternityProblems({ ...adoption, birthDate: '2026-12-05' }, '2026-12-01', '2026-12-10').childBirthDate).toContain('after the date of adoption');
    expect(paternityProblems({ ...adoption, birthDate: null }, '2026-12-01', '2026-12-10').childBirthDate).toBeDefined();
  });

  test('taken in one go: To is From + 14 days, across months and years', () => {
    expect(paternityEnd('2026-11-25')).toBe('2026-12-09');
    expect(paternityEnd('2026-12-20')).toBe('2027-01-03');
  });

  test('15 days for one birth / adoption', () => {
    expect(paternityDaysProblem(0, 15)).toBeNull();
    expect(paternityDaysProblem(10, 5)).toBeNull();
    expect(paternityDaysProblem(10, 6)).toContain('5 left');
  });
});
