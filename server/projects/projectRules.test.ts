import { describe, expect, test } from 'bun:test';
import { categoryFromText, importTemplate, needsReason, parseProjectInput, stageFromText, stageProblem } from './projectRules';

const base = { code: 'WII-DST-2024-09', title: 'Tiger Genetics' };

describe('project form', () => {
  test('a minimal project starts as Proposed', () => {
    const p = parseProjectInput(base);
    expect(p.stage).toBe('proposed');
    expect(p.coPiUserIds).toEqual([]);
  });
  test('amounts with commas, dates and people', () => {
    const p = parseProjectInput({ ...base, sanctionedAmount: '3,85,00,000', startDate: '2024-04-01', endDate: '2027-03-31', piUserId: '5', coPiUserIds: ['6', '7', '6'] });
    expect(p.sanctionedAmount).toBe(38500000);
    expect(p.coPiUserIds).toEqual([6, 7]);
  });
  test('refuses a bad code, an end before the start and the PI as a Co-PI', () => {
    expect(() => parseProjectInput({ ...base, code: 'bad code!' })).toThrow();
    expect(() => parseProjectInput({ ...base, startDate: '2026-04-01', endDate: '2026-03-01' })).toThrow();
    expect(() => parseProjectInput({ ...base, piUserId: '5', coPiUserIds: ['5'] })).toThrow();
  });
});

describe('stages', () => {
  test('forward moves', () => {
    expect(stageProblem('proposed', 'under_review', { reason: null, endDate: null, newEndDate: null })).toBeNull();
    expect(stageProblem('approved', 'ongoing', { reason: null, endDate: null, newEndDate: null })).toBeNull();
  });
  test('a skipped or impossible move is refused', () => {
    expect(stageProblem('proposed', 'ongoing', { reason: null, endDate: null, newEndDate: null })).toContain('cannot');
    expect(stageProblem('closed', 'ongoing', { reason: 'x', endDate: null, newEndDate: null })).toContain('cannot');
  });
  test('reject, close, extend and stepping back need a reason; extend needs a later end date', () => {
    expect(needsReason('under_review', 'rejected')).toBe(true);
    expect(needsReason('ongoing', 'approved')).toBe(true);
    expect(needsReason('rejected', 'proposed')).toBe(false);
    expect(stageProblem('ongoing', 'extended', { reason: 'more time', endDate: '2027-03-31', newEndDate: '2027-03-01' })).toContain('after');
    expect(stageProblem('ongoing', 'extended', { reason: 'more time', endDate: '2027-03-31', newEndDate: '2028-03-31' })).toBeNull();
    expect(stageProblem('completed', 'closed', { reason: null, endDate: null, newEndDate: null })).toBe('Give the reason.');
  });
});

describe('import', () => {
  test('category and stage spellings', () => {
    expect(categoryFromText('Externally funded')).toBe('external');
    expect(categoryFromText('GIA')).toBe('grant_in_aid');
    expect(categoryFromText('')).toBeNull();
    expect(categoryFromText('something')).toBeUndefined();
    expect(stageFromText('Under review')).toBe('under_review');
    expect(stageFromText('ongoing')).toBe('ongoing');
  });
  test('the template has the header and two # rows only', () => {
    const lines = importTemplate().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith('Project_Code,Title,')).toBe(true);
    expect(/^"?# /.test(lines[1])).toBe(true); // quoted when it holds a comma: still a # row once read
    expect(/^"?# e.g./.test(lines[2])).toBe(true);
  });
});
