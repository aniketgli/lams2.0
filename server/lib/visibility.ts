import type { RoleId } from './roles';

/**
 * Which rows of an employee's requests (leave, outdoor duty, manual attendance, ...) a viewer may see,
 * as an SQL condition, so MySQL returns only those rows instead of everyone's rows being read and
 * filtered in the server. Same rule everywhere:
 *   administrator, auditor        everyone
 *   reporting manager / HoD       themselves and the people who report to them (reporting or HoD link)
 *   anyone else                   themselves
 * The team links come from the indexed columns employee_profiles.reporting_manager_id / reviewing_manager_id
 * (migrations/20261129_scale_indexes.sql), so the query joins the profile as `profileAlias`.
 */
export interface Viewer { id: number; role: RoleId | null }

export function visibilityClause(viewer: Viewer, userColumn = 'm.user_id', profileAlias = 'p'): { sql: string; params: number[] } | null {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return null;
  if (viewer.role === 'reporting_manager' || viewer.role === 'reviewing_manager') {
    return {
      sql: `(${userColumn} = ? OR ${profileAlias}.reporting_manager_id = ? OR ${profileAlias}.reviewing_manager_id = ?)`,
      params: [viewer.id, viewer.id, viewer.id],
    };
  }
  return { sql: `${userColumn} = ?`, params: [viewer.id] };
}

/** The most rows one list request may return; a bigger answer must be narrowed (shorter range). */
export const MAX_LIST_ROWS = 20_000;

/** Message for a list that hit the row limit, or null when it is within it. Ask the database for MAX_LIST_ROWS + 1 rows to detect this. */
export function listLimitProblem(count: number): string | null {
  return count > MAX_LIST_ROWS ? `More than ${MAX_LIST_ROWS.toLocaleString('en-IN')} requests match. Choose a shorter date range.` : null;
}
