import { describe, expect, test } from 'bun:test';
import { MAX_LIST_ROWS, canSeeEmployee, listLimitProblem, visibilityClause } from './visibility';

describe('visibilityClause', () => {
  test('administrator and auditor see everyone', () => {
    expect(visibilityClause({ id: 1, role: 'administrator' })).toBeNull();
    expect(visibilityClause({ id: 1, role: 'audit' })).toBeNull();
  });
  test('managers see only their team, not their own rows', () => {
    const c = visibilityClause({ id: 7, role: 'reporting_manager' })!;
    expect(c.sql).toContain('reporting_manager_id');
    expect(c.sql).toContain('reviewing_manager_id');
    expect(c.sql).toContain('m.user_id <> ?');
    expect(c.params).toEqual([7, 7, 7]);
    expect(visibilityClause({ id: 7, role: 'reviewing_manager' })!.params).toEqual([7, 7, 7]);
  });
  test('everyone else sees only themselves', () => {
    expect(visibilityClause({ id: 9, role: 'general_staff' })).toEqual({ sql: 'm.user_id = ?', params: [9] });
    expect(visibilityClause({ id: 9, role: null })).toEqual({ sql: 'm.user_id = ?', params: [9] });
  });
  test('column names can be changed', () => {
    expect(visibilityClause({ id: 9, role: 'general_staff' }, 'u.id')!.sql).toBe('u.id = ?');
  });
});

describe('listLimitProblem', () => {
  test('only above the limit', () => {
    expect(listLimitProblem(MAX_LIST_ROWS)).toBeNull();
    expect(listLimitProblem(MAX_LIST_ROWS + 1)).toContain('shorter date range');
  });
});

describe('canSeeEmployee', () => {
  const team = { reporting: '7', reviewing: '8' };
  const self = { reporting: '2', reviewing: '3' };
  test('a manager sees the team but not their own rows', () => {
    expect(canSeeEmployee({ id: 7, role: 'reporting_manager' }, 11, team)).toBe(true);
    expect(canSeeEmployee({ id: 8, role: 'reviewing_manager' }, 11, team)).toBe(true);
    expect(canSeeEmployee({ id: 7, role: 'reporting_manager' }, 7, self)).toBe(false);
    expect(canSeeEmployee({ id: 7, role: 'reviewing_manager' }, 7, self)).toBe(false);
    expect(canSeeEmployee({ id: 7, role: 'reporting_manager' }, 12, self)).toBe(false);
  });
  test('the same person under the User role sees their own rows', () => {
    expect(canSeeEmployee({ id: 7, role: 'general_staff' }, 7, self)).toBe(true);
    expect(canSeeEmployee({ id: 7, role: 'general_staff' }, 11, team)).toBe(false);
  });
  test('administrator and auditor see everyone', () => {
    expect(canSeeEmployee({ id: 1, role: 'administrator' }, 1, self)).toBe(true);
    expect(canSeeEmployee({ id: 1, role: 'audit' }, 11, team)).toBe(true);
  });
});
