import type { RoleId } from '../lib/roles';
import type { Viewer } from '../lib/visibility';

/**
 * Who gets which version of a scheduled report.
 *
 *  - People chosen by name get the report of every employee.
 *  - Everyone who holds a chosen role gets the report of the employees under them, as their screens show it:
 *    Administrator / Auditor everyone, Reporting Manager / HoD their team, User only themselves.
 *    Someone holding several chosen roles gets the widest of them.
 *  - Someone both chosen by name and holding a chosen role gets the full report once.
 *
 * Pure (no database), so it is unit tested in audience.test.ts.
 */

export interface RoleHolder { userId: number; role: RoleId }
export interface Recipient { userId: number; viewer: Viewer; everyone: boolean }

/** Widest first. */
const WIDTH: RoleId[] = ['administrator', 'audit', 'reviewing_manager', 'reporting_manager', 'leave_balance_manager', 'general_staff'];
const SEES_EVERYONE = new Set<RoleId>(['administrator', 'audit']);
export const EVERYONE_VIEWER: Viewer = { id: 0, role: 'administrator' };

export function planAudience(people: Iterable<number>, holders: Iterable<RoleHolder>, chosenRoles: ReadonlySet<string>): Map<number, Recipient> {
  const out = new Map<number, Recipient>();
  for (const userId of people) out.set(userId, { userId, viewer: EVERYONE_VIEWER, everyone: true });
  for (const h of holders) {
    if (!chosenRoles.has(h.role)) continue;
    const current = out.get(h.userId);
    if (current?.everyone) continue;
    if (current && WIDTH.indexOf(current.viewer.role as RoleId) <= WIDTH.indexOf(h.role)) continue;
    const everyone = SEES_EVERYONE.has(h.role);
    out.set(h.userId, { userId: h.userId, viewer: everyone ? EVERYONE_VIEWER : { id: h.userId, role: h.role }, everyone });
  }
  return out;
}

/** Recipients who get the same table share one build: everyone-reports once, team reports once per person. */
export const audienceKey = (r: Recipient): string => (r.everyone ? 'everyone' : `${r.viewer.role}:${r.viewer.id}`);
