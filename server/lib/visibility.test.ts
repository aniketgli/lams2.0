import { describe, expect, test } from 'bun:test';
import { MAX_LIST_ROWS, listLimitProblem, visibilityClause } from './visibility';

describe('visibilityClause', () => {
  test('administrator and auditor see everyone', () => {
    expect(visibilityClause({ id: 1, role: 'administrator' })).toBeNull();
    expect(visibilityClause({ id: 1, role: 'audit' })).toBeNull();
  });
  test('managers see themselves and their team', () => {
    const c = visibilityClause({ id: 7, role: 'reporting_manager' })!;
    expect(c.sql).toContain('reporting_manager_id');
    expect(c.sql).toContain('reviewing_manager_id');
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
