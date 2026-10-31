import { todayInIndia } from '../lib/validate';
import { listAttendance } from '../attendance/store';
import { listBalances, listRequests as listLeave, type LeaveRequest } from '../leave/requests';
import { listRequests as listManual, type ManualRequest } from '../manualAttendance/store';
import { listRequests as listOd, type OdRequest } from '../outdoorDuty/store';
import type { RoleId } from '../lib/roles';

/**
 * The dashboard of the active role, read from the database on every call:
 *   general staff       their own pending requests, today's punch and leave balances
 *   reporting manager   pending requests waiting for them (their team)
 *   HoD                 pending leave waiting for them (stage 2)
 *   administrator       every pending request
 *   auditor             every pending request, read only
 * Visibility comes from the same rules as the Manual Attendance, Outdoor Duty and Leave screens.
 */

export interface DashboardViewer { id: number; role: RoleId | null }

export interface QueueItem {
  id: string;
  name: string;
  department: string;
  designation: string;
  /** Short badge text (reason category, "Outdoor Duty" or the leave type). */
  tag: string;
  /** Date or date range, ready to show. */
  when: string;
  /** Place for outdoor duty. */
  where: string | null;
  days: number | null;
  text: string;
  /** What the first approver wrote, for leave waiting at stage 2. */
  note: string | null;
}

export interface Queue { total: number; items: QueueItem[] }

export interface BalanceLine { code: string; name: string; total: number; carryForward: number; used: number; pending: number; available: number }

export interface Dashboard {
  role: RoleId | null;
  manual: Queue;
  od: Queue;
  leave: Queue;
  /** Only for general staff. */
  me: { punchIn: string | null; punchOut: string | null; balances: BalanceLine[] } | null;
}

const SHOWN = 3;
const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const queue = <T,>(list: T[], map: (row: T) => QueueItem): Queue => ({ total: list.length, items: list.slice(0, SHOWN).map(map) });
const range = (from: string, to: string) => (from === to ? from : `${from} to ${to}`);

const manualItem = (m: ManualRequest): QueueItem => ({
  id: m.id, name: m.name, department: m.department, designation: m.designation, tag: m.category || 'Forgotten Punch',
  when: `${m.date} (${m.inTime} - ${m.outTime})`, where: null, days: null, text: m.reason, note: null,
});
const odItem = (o: OdRequest): QueueItem => ({
  id: o.id, name: o.name, department: o.department, designation: o.designation, tag: 'Outdoor Duty',
  when: range(o.startDate, o.endDate), where: o.location, days: o.daysCount, text: o.purpose, note: null,
});
const leaveItem = (l: LeaveRequest): QueueItem => ({
  id: l.id, name: l.name, department: l.department, designation: l.designation, tag: l.leaveTypeName,
  when: range(l.startDate, l.endDate), where: null, days: l.daysCount, text: l.reason,
  note: l.status === 'pending_l2' && l.forwardedByName ? `Forwarded by ${l.forwardedByName}${l.forwardComment ? `: "${l.forwardComment}"` : ''}` : null,
});

export async function buildDashboard(viewer: DashboardViewer): Promise<Dashboard> {
  const today = todayInIndia();
  // Pending requests are never far from today; the three screens allow up to 400 days.
  const window = { from: addDays(today, -190), to: addDays(today, 190) };
  const [manual, od, leave] = await Promise.all([listManual(viewer, window), listOd(viewer, window), listLeave(viewer, window)]);

  const own = viewer.role === 'general_staff';
  const readOnly = viewer.role === 'audit';
  const mine = <T extends { userId: string; canDecide: boolean; status: string }>(rows: T[], pending: (s: string) => boolean) =>
    rows.filter((r) => pending(r.status) && (own ? r.userId === String(viewer.id) : readOnly || r.canDecide));
  const isPending = (s: string) => s === 'pending' || s === 'pending_l1' || s === 'pending_l2';

  const dash: Dashboard = {
    role: viewer.role,
    manual: queue(mine(manual.requests, isPending), manualItem),
    od: queue(mine(od.requests, isPending), odItem),
    leave: queue(mine(leave.requests, isPending), leaveItem),
    me: null,
  };

  if (own) {
    const [attendance, balances] = await Promise.all([
      listAttendance(viewer, { from: today, to: today, userId: String(viewer.id) }),
      listBalances(viewer, undefined),
    ]);
    const day = attendance.records.find((r) => r.date === today);
    const row = balances.rows.find((r) => r.userId === String(viewer.id));
    const lines: BalanceLine[] = [];
    for (const type of balances.types) {
      const b = row?.balances[type.id];
      if (b && type.isDebited && b.eligible) lines.push({ code: type.code, name: type.name, total: b.total, carryForward: b.carryForward, used: b.used, pending: b.pending, available: b.available });
    }
    dash.me = { punchIn: day?.clockIn ?? null, punchOut: day?.clockOut ?? null, balances: lines };
  }
  return dash;
}
