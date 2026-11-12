import { describe, expect, test } from 'bun:test';
import { EOL_GROUNDS, LND_GROUNDS, continuousEol, eolLimitMonths, eolProblems, fixedPurposes, lndProblems, serviceMonths, addMonths, childCareProblems, childCareSpells, matchPurpose, maternityDaysProblem, maternityEnd, maternityProblems, paternityEnd, parsePurposes, paternityDaysProblem, paternityProblems, paternityWindow, purposesProblem } from './specialLeave';

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

describe('maternity leave', () => {
  const today = '2026-11-11';
  const birth = { event: 'delivery' as const, eventDate: '2026-12-10', birthDate: null, survivingChildren: 1 };

  test('birth: 180 days in one go, less than two surviving children', () => {
    expect(maternityEnd('2026-12-01')).toBe('2027-05-29');
    expect(maternityProblems(birth, '2026-12-01', '2027-05-29', today)).toEqual({});
    expect(maternityProblems({ ...birth, survivingChildren: 2 }, '2026-12-01', '2027-05-29', today).survivingChildren).toContain('less than two');
    expect(maternityProblems({ ...birth, survivingChildren: null }, '2026-12-01', '2027-05-29', today).survivingChildren).toBeDefined();
  });

  test('adoption: child under one year, starts on the date of adoption', () => {
    const adoption = { event: 'adoption' as const, eventDate: '2026-12-01', birthDate: '2026-06-01', survivingChildren: 0 };
    expect(maternityProblems(adoption, '2026-12-01', maternityEnd('2026-12-01'), today)).toEqual({});
    expect(maternityProblems(adoption, '2026-12-03', maternityEnd('2026-12-03'), today).startDate).toContain('date of adoption');
    expect(maternityProblems({ ...adoption, birthDate: '2025-11-01' }, '2026-12-01', '2027-05-29', today).childBirthDate).toContain('less than one year');
  });

  test('abortion / miscarriage: after it happened, at most 45 days; surviving children not asked', () => {
    const loss = { event: 'loss' as const, eventDate: '2026-11-05', birthDate: null, survivingChildren: null };
    expect(maternityProblems(loss, '2026-11-05', '2026-12-19', today)).toEqual({});
    expect(maternityProblems(loss, '2026-11-05', '2026-12-20', today).endDate).toContain('45');
    expect(maternityProblems(loss, '2026-11-04', '2026-11-20', today).startDate).toContain('on or after');
    expect(maternityProblems({ ...loss, eventDate: '2026-11-20' }, '2026-11-20', '2026-11-30', today).childEventDate).toContain('after');
  });

  test('the kind must be chosen', () => {
    expect(maternityProblems({ event: null, eventDate: null, birthDate: null, survivingChildren: null }, '2026-12-01', '2026-12-10', today).childEvent).toBeDefined();
  });

  test('180 days for one birth / adoption', () => {
    expect(maternityDaysProblem(0, 180)).toBeNull();
    expect(maternityDaysProblem(10, 180)).toContain('170 left');
  });
});

describe('child care leave', () => {
  const today = '2026-11-11';
  const care = { event: 'care' as const, eventDate: null, birthDate: '2015-03-10', survivingChildren: null, childOrder: 1 as const, childDisabled: false, singleParent: false };

  test('two eldest children below 18 years', () => {
    expect(childCareProblems(care, '2026-12-01', today, false)).toEqual({});
    expect(childCareProblems({ ...care, childOrder: null }, '2026-12-01', today, false).childOrder).toContain('two eldest');
    expect(childCareProblems({ ...care, birthDate: '2008-11-30' }, '2026-12-01', today, false).childBirthDate).toContain('18');
  });

  test('a child with a disability: no age limit', () => {
    expect(childCareProblems({ ...care, birthDate: '2000-01-01', childDisabled: true }, '2026-12-01', today, false)).toEqual({});
  });

  test('only with prior approval: not today or earlier (the administrator may enter an old one)', () => {
    expect(childCareProblems(care, today, today, false).startDate).toContain('after today');
    expect(childCareProblems(care, today, today, true)).toEqual({});
  });

  test('3 spells a year, 6 for a single mother', () => {
    expect(childCareSpells(false)).toBe(3);
    expect(childCareSpells(true)).toBe(6);
  });
});

describe('leave not due', () => {
  const base = { permanent: true, serviceMonths: 60, ground: LND_GROUNDS[0], hasCertificate: true, followsMaternity: false };
  test('permanent: on a medical certificate', () => {
    expect(lndProblems(base)).toEqual({});
    expect(lndProblems({ ...base, hasCertificate: false }).certificate).toContain('medical certificate');
  });
  test('temporary: one year of service and TB / leprosy / cancer / mental illness only', () => {
    expect(lndProblems({ ...base, permanent: false, ground: LND_GROUNDS[1] })).toEqual({});
    expect(lndProblems({ ...base, permanent: false }).purpose).toContain('TB');
    expect(lndProblems({ ...base, permanent: false, serviceMonths: 11, ground: LND_GROUNDS[1] }).leaveTypeId).toContain('one year');
  });
  test('after maternity leave: no certificate, but it must follow one', () => {
    expect(lndProblems({ ...base, ground: LND_GROUNDS[2], hasCertificate: false, followsMaternity: true })).toEqual({});
    expect(lndProblems({ ...base, ground: LND_GROUNDS[2], hasCertificate: false }).purpose).toContain('day after');
  });
  test('the grounds come from the rules, not the master', () => {
    expect(fixedPurposes('LND', ['x'])).toEqual([...LND_GROUNDS]);
    expect(fixedPurposes('EOL', [])).toEqual([...EOL_GROUNDS]);
    expect(fixedPurposes('SCL', ['Bandh'])).toEqual(['Bandh']);
  });
});

describe('extraordinary leave', () => {
  test('service months', () => {
    expect(serviceMonths('2025-11-12', '2026-11-12')).toBe(12);
    expect(serviceMonths('2025-11-13', '2026-11-12')).toBe(11);
    expect(serviceMonths(null, '2026-11-12')).toBe(0);
  });

  test('limits by ground and service', () => {
    expect(eolLimitMonths({ permanent: true, serviceMonths: 1, ground: EOL_GROUNDS[0] }).months).toBe(60);
    expect(eolLimitMonths({ permanent: false, serviceMonths: 1, ground: EOL_GROUNDS[0] }).months).toBe(3);
    expect(eolLimitMonths({ permanent: false, serviceMonths: 12, ground: EOL_GROUNDS[2] }).months).toBe(6);
    expect(eolLimitMonths({ permanent: false, serviceMonths: 12, ground: EOL_GROUNDS[3] }).months).toBe(18);
    expect(eolLimitMonths({ permanent: false, serviceMonths: 36, ground: EOL_GROUNDS[4] }).months).toBe(24);
  });

  test('temporary: 3 months on one occasion', () => {
    const c = { permanent: false, serviceMonths: 2, ground: EOL_GROUNDS[0], hasCertificate: false };
    expect(eolProblems({ ...c, spells: [{ start: '2026-01-01', end: '2026-03-31', eol: true }] })).toEqual({});
    expect(eolProblems({ ...c, spells: [{ start: '2026-01-01', end: '2026-04-01', eol: true }] }).endDate).toContain('3 months');
  });

  test('grounds need service and a certificate', () => {
    const spells = [{ start: '2026-01-01', end: '2026-01-10', eol: true }];
    expect(eolProblems({ permanent: false, serviceMonths: 6, ground: EOL_GROUNDS[2], hasCertificate: true, spells }).purpose).toContain('one year');
    expect(eolProblems({ permanent: false, serviceMonths: 24, ground: EOL_GROUNDS[4], hasCertificate: true, spells }).purpose).toContain('three years');
    expect(eolProblems({ permanent: false, serviceMonths: 24, ground: EOL_GROUNDS[2], hasCertificate: false, spells }).certificate).toBeDefined();
  });

  test('two EOL spells with other leave between them are one spell', () => {
    const others = [
      { start: '2026-01-01', end: '2026-02-28', eol: true },
      { start: '2026-03-01', end: '2026-03-10', eol: false }, // EL in between
      { start: '2026-06-01', end: '2026-06-05', eol: true }, // not touching
    ];
    const chain = continuousEol(others, { start: '2026-03-11', end: '2026-04-15', eol: true });
    expect(chain.map((s) => s.start)).toEqual(['2026-01-01', '2026-03-11']);
    const c = { permanent: false, serviceMonths: 2, ground: EOL_GROUNDS[0], hasCertificate: false };
    expect(eolProblems({ ...c, spells: chain }).endDate).toContain('count as one');
  });
});
