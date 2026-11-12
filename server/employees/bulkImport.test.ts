import { describe, expect, test } from 'bun:test';
import { columnsFor, creationOrder, parseDay, parseYesNo } from './bulkImportRules';

describe('employee import', () => {
  test('columns follow the form of the employee type', () => {
    const permanent = columnsFor('permanent').map((c) => c.header);
    expect(permanent).toContain('Department');
    expect(permanent).toContain('Designation');
    expect(permanent).toContain('Cadre');
    expect(permanent).toContain('Recruitment');
    expect(permanent).toContain('HoD_BI');
    expect(permanent).not.toContain('Course');

    const researcher = columnsFor('researcher').map((c) => c.header);
    expect(researcher).toContain('Project');
    expect(researcher).toContain('PI_Name');
    expect(researcher).not.toContain('HoD_BI');

    expect(columnsFor('bsc_msc_student').map((c) => c.header)).toEqual(expect.arrayContaining(['Stream', 'Batch']));
    expect(columnsFor('diploma_trainee').map((c) => c.header)).toEqual(expect.arrayContaining(['Course', 'Batch']));
    expect(columnsFor('phd_student').map((c) => c.header)).toEqual(expect.arrayContaining(['Enrolled_Through', 'Guide']));
    for (const layout of ['permanent', 'contractual', 'researcher', 'diploma_trainee', 'bsc_msc_student', 'phd_student', 'intern'] as const) {
      const headers = columnsFor(layout).map((c) => c.header);
      expect(new Set(headers).size).toBe(headers.length);
      expect(headers.slice(0, 3)).toEqual(['Biometric_ID', 'Salutation', 'Name']);
    }
  });

  test('dates as Excel writes them', () => {
    expect(parseDay('31-01-2026')).toBe('2026-01-31');
    expect(parseDay('1/2/2026')).toBe('2026-02-01');
    expect(parseDay('2026-01-31')).toBe('2026-01-31');
    expect(parseDay('31.12.1990')).toBe('1990-12-31');
    expect(parseDay('31-02-2026')).toBeNull();
    expect(parseDay('Jan 1 2026')).toBeNull();
  });

  test('Yes / No', () => {
    expect(parseYesNo('Yes')).toBe(true);
    expect(parseYesNo('n')).toBe(false);
    expect(parseYesNo('')).toBe(false);
    expect(parseYesNo('maybe')).toBeNull();
  });

  test('managers in the same file are created first; loops are reported', () => {
    const { order, cycle } = creationOrder([
      { bi: '1001', managers: ['1002'] }, // reports to the next row
      { bi: '1002', managers: ['0317'] }, // manager already in the portal
      { bi: '1003', managers: ['1004'] },
      { bi: '1004', managers: ['1003'] },
    ]);
    expect(order).toEqual([1, 0]);
    expect(cycle).toEqual([2, 3]);
  });
});
