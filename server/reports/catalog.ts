import type { Request } from 'express';
import { pool } from '../../src/db';
import { listAttendance } from '../attendance/store';
import { EMPLOYEE_SCOPE, activityTable, employeeDirectoryTable, parseActivityFilter, type ActivityScope } from '../employees/activity';
import { HOLIDAY_SCOPE } from '../holidays/store';
import { LEAVE_SCOPE, listBalances, listRequests as listLeave } from '../leave/requests';
import { MANUAL_SCOPE, listRequests as listManual } from '../manualAttendance/store';
import { OD_SCOPE, listRequests as listOd } from '../outdoorDuty/store';
import type { ReportTable } from './render';
import type { Viewer } from '../lib/visibility';

/**
 * Every report an administrator can schedule. Each one reads exactly what the matching screen shows to `viewer`
 * for the days the schedule covers: an administrator / auditor sees everyone, a reporting manager / HoD their team,
 * a user only themselves. It returns a plain table that is then written as CSV and / or PDF.
 * `snapshot` reports show the situation now instead of a period (the directory, the balances).
 * `everyoneOnly` reports (activity logs) are not split by team: only people who see everyone get them.
 */

export interface Period { from: string; to: string }
export interface ReportDef {
  key: string;
  label: string;
  description: string;
  snapshot: boolean;
  everyoneOnly?: boolean;
  build: (period: Period, req: Request, viewer: Viewer) => Promise<ReportTable>;
}

/** Sees every employee (people chosen by name, administrators and auditors). */
export const EVERYONE: Viewer = { id: 0, role: 'administrator' };
const pretty = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '');
const stamp = (iso: string | null | undefined) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');
const range = (a: string, b: string) => (a === b ? pretty(a) : `${pretty(a)} to ${pretty(b)}`);
const STATUS: Record<string, string> = { pending: 'Pending', pending_l1: 'Pending (R.M.)', pending_l2: 'Pending (HoD)', approved: 'Approved', rejected: 'Rejected' };
const status = (s: string) => STATUS[s] ?? s;
const DAY: Record<string, string> = { PP: 'Present', AA: 'Absent', PA: 'Out missing', AP: 'In missing', WW: 'Weekly off', 'WW#': 'Weekly off (worked)', GH: 'Holiday', 'HH#': 'Holiday (worked)', OD: 'Outdoor duty', LV: 'Leave' };

async function namesOf(): Promise<Map<string, { name: string; designation: string }>> {
  const [found] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    'SELECT u.id, u.name, p.designation FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id');
  return new Map(found.map((r) => [String(r.id), { name: String(r.name), designation: String(r.designation ?? '') }]));
}

function activity(key: string, label: string, scope: ActivityScope): ReportDef {
  return {
    key, label, snapshot: false, everyoneOnly: true, description: `Who changed what in ${label.replace(' activity log', '').toLowerCase()}, with the reason. Sent only to Administrators, Auditors and people chosen by name.`,
    async build(period, req) {
      const table = await activityTable(req, parseActivityFilter({ from: period.from, to: period.to }, scope), 'pdf', scope);
      return { title: scope.title, ...table, columnWidths: [11, 9, 8, 16, 9, 24, 12, 11, 6, 8] };
    },
  };
}

export const REPORTS: ReportDef[] = [
  {
    key: 'attendance', label: 'Attendance', snapshot: false,
    description: 'Day-wise In / Out, hours and status of each employee.',
    async build(period, _req, viewer) {
      const [result, people] = await Promise.all([listAttendance(viewer, period), namesOf()]);
      const rows = [...result.records].sort((a, b) => a.date.localeCompare(b.date) || a.biometricId.localeCompare(b.biometricId)).map((r) => [
        pretty(r.date), r.biometricId, people.get(r.userId)?.name ?? '', r.shiftCode, r.clockIn ?? '', r.clockOut ?? '',
        r.totalHours ?? '', DAY[r.status] ?? r.status, r.lateByMins ? `${r.lateByMins} min late` : '', r.remark,
      ]);
      return { title: 'Attendance', headers: ['Date', 'B.I.', 'Employee', 'Shift', 'In', 'Out', 'Hours', 'Status', 'Late', 'Remark'], rows, columnWidths: [9, 6, 18, 7, 6, 6, 6, 12, 10, 20] };
    },
  },
  {
    key: 'leave_requests', label: 'Leave requests', snapshot: false,
    description: 'Leaves that fall in the period, with their status and who decided.',
    async build(period, _req, viewer) {
      const { requests } = await listLeave(viewer, period);
      const rows = requests.map((r) => [
        r.name, r.biometricId, r.leaveTypeName, range(r.startDate, r.endDate), r.daysCount, r.reason, status(r.status),
        stamp(r.appliedAt), r.actionByName ? `${r.actionByName}${r.actionByRole ? ` (${r.actionByRole})` : ''}` : r.waitingFor ? `Waiting: ${r.waitingFor}` : '',
      ]);
      return { title: 'Leave requests', headers: ['Employee', 'B.I.', 'Leave type', 'Duration', 'Days', 'Reason', 'Status', 'Applied', 'Decided by'], rows, columnWidths: [16, 6, 15, 16, 5, 22, 10, 12, 16] };
    },
  },
  {
    key: 'leave_balance', label: 'Leave balance', snapshot: true,
    description: 'Available leave of each employee for the current leave year.',
    async build(_period, _req, viewer) {
      const data = await listBalances(viewer, undefined);
      const types = data.types;
      const rows = data.rows.map((r) => [
        r.name, r.biometricId, r.department, r.cycle,
        ...types.map((t) => { const b = r.balances[t.id]; return b ? b.available : ''; }),
      ]);
      return {
        title: `Leave balance ${data.year}`, headers: ['Employee', 'B.I.', 'Department', 'Cycle', ...types.map((t) => t.code)], rows,
      };
    },
  },
  {
    key: 'outdoor_duty', label: 'Outdoor duty', snapshot: false,
    description: 'Outdoor duty requests that fall in the period.',
    async build(period, _req, viewer) {
      const { requests } = await listOd(viewer, period);
      const rows = requests.map((r) => [
        r.name, r.biometricId, r.odType, range(r.startDate, r.endDate), `${r.startTime}–${r.endTime}`, r.location, r.purpose, status(r.status),
        r.actionByName ? `${r.actionByName}${r.actionByRole ? ` (${r.actionByRole})` : ''}` : '',
      ]);
      return { title: 'Outdoor duty', headers: ['Employee', 'B.I.', 'Type', 'Dates', 'Time', 'Location', 'Purpose', 'Status', 'Decided by'], rows, columnWidths: [16, 6, 10, 16, 10, 14, 22, 9, 15] };
    },
  },
  {
    key: 'manual_attendance', label: 'Manual attendance', snapshot: false,
    description: 'Manual attendance requests for dates in the period.',
    async build(period, _req, viewer) {
      const { requests } = await listManual(viewer, period);
      const rows = requests.map((r) => [
        r.name, r.biometricId, pretty(r.date), r.inTime, r.outTime, r.category, r.reason, status(r.status),
        r.actionByName ? `${r.actionByName}${r.actionByRole ? ` (${r.actionByRole})` : ''}` : '',
      ]);
      return { title: 'Manual attendance', headers: ['Employee', 'B.I.', 'Date', 'In', 'Out', 'Reason type', 'Reason', 'Status', 'Decided by'], rows, columnWidths: [16, 6, 10, 6, 6, 12, 24, 9, 15] };
    },
  },
  {
    key: 'employee_directory', label: 'Employee directory', snapshot: true,
    description: 'Employees with designation, department, managers and roles.',
    async build(_period, req, viewer) {
      return { title: 'Employee directory', ...(await employeeDirectoryTable(req, viewer as never, 'pdf')) };
    },
  },
  activity('activity_employee', 'Employee activity log', EMPLOYEE_SCOPE),
  activity('activity_leave', 'Leave activity log', LEAVE_SCOPE),
  activity('activity_od', 'Outdoor duty activity log', OD_SCOPE),
  activity('activity_manual', 'Manual attendance activity log', MANUAL_SCOPE),
  activity('activity_holiday', 'Holiday calendar activity log', HOLIDAY_SCOPE),
];

export const REPORT_KEYS = REPORTS.map((r) => r.key);
export const findReport = (key: string): ReportDef | undefined => REPORTS.find((r) => r.key === key);
