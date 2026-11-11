import type { RoleId } from './roles';

/**
 * Which rows of an employee's requests (leave, outdoor duty, manual attendance, ...) a viewer may see,
 * as an SQL condition, so MySQL returns only those rows instead of everyone's rows being read and
 * filtered in the server. Same rule everywhere:
 *   administrator, auditor        everyone
 *   reporting manager / HoD       only the people who report to them (reporting or HoD link), never
 *                                 their own rows: those are seen under their own User role and in the
 *                                 lists of their own reporting manager / HoD
 *   anyone else                   themselves
 * The team links come from the indexed columns employee_profiles.reporting_manager_id / reviewing_manager_id
 * (migrations/20261129_scale_indexes.sql), so the query joins the profile as `profileAlias`.
 */
export interface Viewer { id: number; role: RoleId | null }

export function visibilityClause(viewer: Viewer, userColumn = 'm.user_id', profileAlias = 'p'): { sql: string; params: number[] } | null {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return null;
  if (viewer.role === 'reporting_manager' || viewer.role === 'reviewing_manager') {
    return {
      sql: `(${profileAlias}.reporting_manager_id = ? OR ${profileAlias}.reviewing_manager_id = ?) AND ${userColumn} <> ?`,
      params: [viewer.id, viewer.id, viewer.id],
    };
  }
  return { sql: `${userColumn} = ?`, params: [viewer.id] };
}

export const isManagerRole = (role: RoleId | null): boolean => role === 'reporting_manager' || role === 'reviewing_manager';

/** The same rule for one row: the employee's id and their reporting manager / HoD ids (as text). */
export function canSeeEmployee(viewer: Viewer, userId: unknown, managers: { reporting: string; reviewing: string }): boolean {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return true;
  const own = Number(userId) === viewer.id;
  if (!isManagerRole(viewer.role)) return own;
  if (own) return false;
  return managers.reporting === String(viewer.id) || managers.reviewing === String(viewer.id);
}

/** The most rows one list request may return; a bigger answer must be narrowed (shorter range). */
export const MAX_LIST_ROWS = 20_000;

/** Message for a list that hit the row limit, or null when it is within it. Ask the database for MAX_LIST_ROWS + 1 rows to detect this. */
export function listLimitProblem(count: number): string | null {
  return count > MAX_LIST_ROWS ? `More than ${MAX_LIST_ROWS.toLocaleString('en-IN')} requests match. Choose a shorter date range.` : null;
}
