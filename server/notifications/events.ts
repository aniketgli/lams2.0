import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { type Detail, type Notice, notify } from './notify';

/**
 * Who hears about what.
 *   applied    → reporting manager (employee copied). No manager set → the employee.
 *   forwarded  → HoD (employee and reporting manager copied)
 *   approved / rejected → the employee (reporting manager, and HoD when the request went to the HoD, copied)
 *   undone     → the employee (managers copied)
 * Organization CC / BCC from Master Settings are added on top by the mail service.
 */

export type Stage = 'applied' | 'forwarded' | 'approved' | 'rejected' | 'undone';

export interface Flow {
  /** Shown in subjects: "Leave request", "Outdoor duty", ... */
  noun: string;
  code: string;
  id: string;
  employeeId: string | number;
  employeeName: string;
  biometricId: string;
  managerId: string | number | null;
  reviewerId?: string | number | null;
  /** The request goes through the HoD (leave with two stages, joining report). */
  viaHod?: boolean;
  summary: string;
  details: Detail[];
  actorName?: string | null;
}

const WORDS: Record<Stage, { subject: string; intro: (f: Flow) => string }> = {
  applied: { subject: 'applied', intro: (f) => `${f.employeeName} (${f.biometricId}) has applied. It is waiting for your decision.` },
  forwarded: { subject: 'forwarded to HoD', intro: (f) => `${f.actorName || 'The reporting manager'} has forwarded the request of ${f.employeeName} (${f.biometricId}). It is waiting for your decision.` },
  approved: { subject: 'approved', intro: (f) => `Your ${f.noun.toLowerCase()} has been approved${f.actorName ? ` by ${f.actorName}` : ''}.` },
  rejected: { subject: 'rejected', intro: (f) => `Your ${f.noun.toLowerCase()} has been rejected${f.actorName ? ` by ${f.actorName}` : ''}.` },
  undone: { subject: 'decision withdrawn', intro: (f) => `${f.actorName || 'An approver'} has taken back the earlier decision on your ${f.noun.toLowerCase()}. It is pending again.` },
};

export function flowNotice(stage: Stage, f: Flow, remark?: string | null): Notice {
  const word = WORDS[stage];
  const employee = f.employeeId;
  const hod = f.viaHod ? f.reviewerId : null;
  let to: Notice['to'];
  let cc: Notice['cc'];
  if (stage === 'applied') {
    to = f.managerId ? [f.managerId] : [employee];
    cc = f.managerId ? [employee] : [];
  } else if (stage === 'forwarded') {
    to = [f.reviewerId ?? f.managerId];
    cc = [employee, f.managerId];
  } else {
    to = [employee];
    cc = [f.managerId, hod];
  }
  return {
    event: `${f.code}_${stage.toUpperCase()}`,
    referenceId: f.id,
    subject: `${f.noun} ${word.subject}: ${f.employeeName} (${f.biometricId}) · ${f.summary}`,
    heading: `${f.noun} ${word.subject}`,
    intro: word.intro(f),
    details: [['Employee', `${f.employeeName} (${f.biometricId})`], ...f.details],
    remark: remark || null,
    to, cc,
  };
}

/** Reporting manager and HoD ids saved on a row (by table: fixed names, never user input). */
export async function managersOfRow(table: 'leave_requests' | 'leave_joining_reports', key: 'id' | 'request_id', id: string | number): Promise<{ managerId: number | null; reviewerId: number | null; stages: number }> {
  const [row] = await pool.query<RowDataPacket[]>(`SELECT manager_id, reviewer_id${table === 'leave_requests' ? ', stages' : ''} FROM ${table} WHERE ${key} = ? LIMIT 1`, [Number(id)])
    .then(([r]) => r);
  return { managerId: row?.manager_id ? Number(row.manager_id) : null, reviewerId: row?.reviewer_id ? Number(row.reviewer_id) : null, stages: Number(row?.stages ?? 2) };
}

const sessionWord = (s: string) => (s === 'second_half' ? ' (second half)' : s === 'first_half' ? ' (first half)' : '');
const span = (a: string, b: string) => (a === b ? a : `${a} to ${b}`);

// --- Leave -----------------------------------------------------------------

export interface LeaveView {
  id: string; userId: string; name: string; biometricId: string; leaveTypeName: string; leaveTypeCode: string;
  startDate: string; endDate: string; startSession: string; endSession: string; daysCount: number; reason: string;
  stages: number; appliedByName: string; actionByName: string | null; actionByRole: string | null; managerName?: string | null;
}

export function notifyLeave(stage: Stage, r: LeaveView, remark?: string | null): void {
  notify(async () => {
    const m = await managersOfRow('leave_requests', 'id', r.id);
    return flowNotice(stage, {
      noun: 'Leave request', code: 'LEAVE', id: r.id, employeeId: r.userId, employeeName: r.name, biometricId: r.biometricId,
      managerId: m.managerId, reviewerId: m.reviewerId, viaHod: r.stages === 2,
      summary: `${r.leaveTypeCode} ${span(r.startDate, r.endDate)}`,
      actorName: r.actionByName,
      details: [
        ['Leave type', r.leaveTypeName],
        ['From', `${r.startDate}${sessionWord(r.startSession)}`],
        ['To', `${r.endDate}${sessionWord(r.endSession)}`],
        ['Days', r.daysCount],
        ['Reason', r.reason],
        ['Applied by', r.appliedByName && r.appliedByName !== r.name ? r.appliedByName : null],
      ],
    }, remark);
  });
}

// --- Outdoor duty / manual attendance -------------------------------------------

export interface OdView {
  id: string; userId: string; name: string; biometricId: string; managerId: string | null; startDate: string; endDate: string;
  startTime: string; endTime: string; daysCount: number; odType: string; location: string; purpose: string; appliedByName: string; actionByName: string | null;
}

export function notifyOd(stage: Stage, r: OdView, remark?: string | null): void {
  notify(() => flowNotice(stage, {
    noun: 'Outdoor duty', code: 'OD', id: r.id, employeeId: r.userId, employeeName: r.name, biometricId: r.biometricId, managerId: r.managerId,
    summary: span(r.startDate, r.endDate), actorName: r.actionByName,
    details: [
      ['Type', r.odType], ['Location', r.location], ['From', `${r.startDate} ${r.startTime}`], ['To', `${r.endDate} ${r.endTime}`],
      ['Days', r.daysCount], ['Purpose', r.purpose], ['Applied by', r.appliedByName && r.appliedByName !== r.name ? r.appliedByName : null],
    ],
  }, remark));
}

export interface ManualView {
  id: string; userId: string; name: string; biometricId: string; managerId: string | null; date: string; inTime: string; outTime: string;
  category: string; reason: string; appliedByName: string; actionByName: string | null;
}

export function notifyManual(stage: Stage, r: ManualView, remark?: string | null): void {
  notify(() => flowNotice(stage, {
    noun: 'Manual attendance', code: 'MANUAL', id: r.id, employeeId: r.userId, employeeName: r.name, biometricId: r.biometricId, managerId: r.managerId,
    summary: r.date, actorName: r.actionByName,
    details: [
      ['Date', r.date], ['In', r.inTime], ['Out', r.outTime], ['Category', r.category], ['Reason', r.reason],
      ['Applied by', r.appliedByName && r.appliedByName !== r.name ? r.appliedByName : null],
    ],
  }, remark));
}

// --- Joining report -----------------------------------------------------------

export interface JoiningView {
  requestId: string; userId: string; name: string; biometricId: string; leaveTypeCode: string; startDate: string; endDate: string;
  joiningDate: string; report: { actionByName?: string | null; punchIn?: string | null } | null;
}

export function notifyJoining(stage: Stage, r: JoiningView, actor?: string | null, remark?: string | null): void {
  notify(async () => {
    const m = await managersOfRow('leave_joining_reports', 'request_id', r.requestId);
    return flowNotice(stage, {
      noun: 'Joining report', code: 'JOINING', id: r.requestId, employeeId: r.userId, employeeName: r.name, biometricId: r.biometricId,
      managerId: m.managerId, reviewerId: m.reviewerId, viaHod: true,
      summary: `after ${r.leaveTypeCode} ${span(r.startDate, r.endDate)}`, actorName: actor ?? null,
      details: [['Leave', `${r.leaveTypeCode} ${span(r.startDate, r.endDate)}`], ['Joining date', r.joiningDate], ['In punch', r.report?.punchIn ?? null]],
    }, remark);
  });
}

// --- Employee accounts ---------------------------------------------------------------

export interface EmployeeView { id: string | number; name: string; biometricId: string; designation?: string | null; department?: string | null; profileData?: string }

function managersInProfile(e: EmployeeView): { rm: string | null; hod: string | null } {
  try {
    const data = JSON.parse(e.profileData || '{}') as Record<string, unknown>;
    const pick = (v: unknown) => (/^\d+$/.test(String(v ?? '')) ? String(v) : null);
    return { rm: pick(data.reportingManagerId), hod: pick(data.reviewingManagerId) };
  } catch { return { rm: null, hod: null }; }
}

/** A new employee: a welcome to them, and a "new team member" note to their reporting manager and HoD. */
export function notifyWelcome(e: EmployeeView): void {
  const { rm, hod } = managersInProfile(e);
  const details: Detail[] = [['Name', e.name], ['Biometric ID', e.biometricId], ['Designation', e.designation ?? null], ['Department / Project', e.department ?? null]];
  notify(() => ({
    event: 'EMPLOYEE_CREATED', referenceId: e.biometricId,
    subject: `Welcome to the WII Portal, ${e.name}`,
    heading: 'Welcome to the WII Portal',
    intro: 'Your account has been created. Sign in with your registered email and the default password given by the IT Cell. You will be offered a password change after your first sign-in.',
    details, to: [e.id],
  }));
  if (rm || hod) {
    notify(() => ({
      event: 'EMPLOYEE_CREATED_MANAGER', referenceId: e.biometricId,
      subject: `New team member: ${e.name} (${e.biometricId})`,
      heading: 'New team member',
      intro: `${e.name} has been added to the WII Portal${rm ? ' with you as the reporting manager' : ' with you as the HoD'}.`,
      details, to: [rm, hod],
    }));
  }
}

/** An account was switched on or off. */
export function notifyAccountStatus(status: 'active' | 'inactive', e: EmployeeView): void {
  const on = status === 'active';
  notify(() => ({
    event: on ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED', referenceId: e.biometricId,
    subject: on ? 'Your WII Portal account is active again' : 'Your WII Portal account has been deactivated',
    heading: on ? 'Account reactivated' : 'Account deactivated',
    intro: on ? 'Your account is active again. Sign in with the default password given by the IT Cell; you will be offered a password change.' : 'Your account has been deactivated. Contact the IT Cell if you think this is a mistake.',
    details: [['Biometric ID', e.biometricId]], to: [e.id],
  }));
}
