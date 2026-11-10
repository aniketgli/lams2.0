/**
 * The small second line under a request's status pill, the same on every page:
 *
 *   Pending   at R.M. Harendra Kumar      (who it is waiting for: role, then name)
 *   Approved  by HoD Ravi Sharma          (who decided: role, then name)
 *
 * Used by leave, joining, manual attendance and outdoor duty lists.
 */

/** "R.M. Harendra Kumar", "HoD Ravi Sharma", "Administrator". */
export function roleAndName(role: string | null | undefined, name: string | null | undefined): string {
  const who = (name ?? '').trim();
  if (!who) return role === 'Admin' || !role ? 'Administrator' : role;
  return role ? `${role} ${who}` : who;
}

/** Status line of a request that waits at one person (the reporting manager, or HoD at the second step). */
export function pendingAt(role: string | null | undefined, name: string | null | undefined): string {
  return `at ${roleAndName(role, name)}`;
}

/** Status line of a decided request. */
export function decidedBy(role: string | null | undefined, name: string | null | undefined): string {
  return name || role ? `by ${roleAndName(role, name)}` : '';
}

/** The person alone (for CSV / PDF exports): the status line without "at " / "by ". */
export const statusPerson = (line: string): string => line.replace(/^(at|by) /, '');

/** Waiting at the reporting manager; without one, an administrator decides. */
export const pendingAtManager = (managerName: string | null | undefined): string =>
  managerName ? pendingAt('R.M.', managerName) : pendingAt('Admin', null);
