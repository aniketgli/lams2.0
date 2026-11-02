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

export type Stage = 'applied' | 'edited' | 'deleted' | 'forwarded' | 'approved' | 'rejected' | 'undone';

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
  edited: { subject: 'edited', intro: (f) => `${f.actorName || f.employeeName} has changed the request of ${f.employeeName} (${f.biometricId}). It is still waiting for your decision.` },
  deleted: { subject: 'deleted', intro: (f) => `The request of ${f.employeeName} (${f.biometricId}) has been deleted${f.actorName ? ` by ${f.actorName}` : ''}. No action is needed.` },
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
  if (stage === 'applied' || stage === 'edited' || stage === 'deleted') {
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
  /** Known ids (needed when the row is already deleted). */
  managerId?: string | number | null; reviewerId?: string | number | null;
}

export function notifyLeave(stage: Stage, r: LeaveView, remark?: string | null): void {
  notify(async () => {
    const m = r.managerId !== undefined ? { managerId: r.managerId, reviewerId: r.reviewerId ?? null } : await managersOfRow('leave_requests', 'id', r.id);
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

/** The profile of an employee was changed by the administrator. */
export function notifyEmployeeUpdated(e: EmployeeView, changed: string[]): void {
  if (!changed.length) return;
  notify(() => ({
    event: 'EMPLOYEE_UPDATED', referenceId: e.biometricId,
    subject: 'Your WII Portal profile has been updated',
    heading: 'Profile updated',
    intro: 'The administrator has updated your profile. If something looks wrong, contact the IT Cell.',
    details: [['Name', e.name], ['Biometric ID', e.biometricId], ['Updated', changed.map(readable).join(', ')]], to: [e.id],
  }));
}

/** The account was deleted for good. The employee is no longer an active account, so the mail goes to the address saved before. */
export function notifyEmployeeDeleted(e: { name: string; email: string; biometricId: string }, reason: string): void {
  if (!e.email.includes('@')) return;
  notify(() => ({
    event: 'EMPLOYEE_DELETED', referenceId: e.biometricId,
    subject: 'Your WII Portal account has been deleted',
    heading: 'Account deleted',
    intro: 'Your WII Portal account has been permanently deleted. Contact the IT Cell if you think this is a mistake.',
    details: [['Name', e.name], ['Biometric ID', e.biometricId], ['Reason', reason]],
    to: [], direct: [{ id: 0, name: e.name, email: e.email }],
  }));
}

/** An administrator changed the module roles of an employee. */
export function notifyRolesChanged(biometricId: string, roles: Array<{ moduleId: string; roleId: string }>): void {
  notify(async () => {
    const [list] = await pool.query<RowDataPacket[]>('SELECT id, name FROM users WHERE biometric_id = ? LIMIT 1', [biometricId]);
    const u = list?.[0];
    if (!u) return null;
    const byModule = new Map<string, string[]>();
    for (const r of roles) byModule.set(r.moduleId.toUpperCase(), [...(byModule.get(r.moduleId.toUpperCase()) ?? []), r.roleId]);
    return {
      event: 'EMPLOYEE_ROLES_CHANGED', referenceId: biometricId,
      subject: 'Your WII Portal access has been changed',
      heading: 'Access changed',
      intro: 'The administrator has changed the roles on your account. Sign in again to see the change.',
      details: [['Name', String(u.name)], ...(byModule.size ? [...byModule].map(([m, r]) => [m, r.join(', ')] as Detail) : [['Roles', 'No roles'] as Detail])],
      to: [Number(u.id)],
    };
  });
}

/** Transfer / manager-change order: tells each employee, the incoming and the outgoing managers. Reads the register rows of the batch. */
export function notifyMappingBatch(batchId: string): void {
  notify(async () => {
    const [list] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, biometric_id, employee_name, prev_department, new_department, prev_reporting_manager_id, prev_reporting_manager_name,
              new_reporting_manager_id, new_reporting_manager_name, prev_hod_id, prev_hod_name, new_hod_id, new_hod_name, effective_date
         FROM employee_mapping_log WHERE batch_id = ? ORDER BY id`, [batchId]);
    const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
    const differs = (a: unknown, b: unknown) => text(a) !== text(b);
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    const push = (m: Map<string, string[]>, id: unknown, who: string) => { const k = text(id); if (k) m.set(k, [...(m.get(k) ?? []), who]); };
    for (const r of list) {
      const who = `${r.employee_name} (${r.biometric_id})`;
      if (differs(r.prev_reporting_manager_id, r.new_reporting_manager_id)) { push(incoming, r.new_reporting_manager_id, who); push(outgoing, r.prev_reporting_manager_id, who); }
      if (differs(r.prev_hod_id, r.new_hod_id)) { push(incoming, r.new_hod_id, `${who} (as HoD)`); push(outgoing, r.prev_hod_id, `${who} (as HoD)`); }
      const rows: Detail[] = [['Effective from', text(r.effective_date)?.slice(0, 10) ?? null]];
      if (differs(r.prev_department, r.new_department)) rows.push(['Department / Project', `${text(r.prev_department) ?? '—'} → ${text(r.new_department) ?? '—'}`]);
      if (differs(r.prev_reporting_manager_id, r.new_reporting_manager_id)) rows.push(['Reporting manager', `${text(r.prev_reporting_manager_name) ?? '—'} → ${text(r.new_reporting_manager_name) ?? '—'}`]);
      if (differs(r.prev_hod_id, r.new_hod_id)) rows.push(['HoD', `${text(r.prev_hod_name) ?? '—'} → ${text(r.new_hod_name) ?? '—'}`]);
      void sendEmployee(r, rows);
    }
    for (const [id, who] of incoming) void sendManager(id, who, true);
    for (const [id, who] of outgoing) void sendManager(id, who, false);
    return null;

    function sendEmployee(r: RowDataPacket, details: Detail[]) {
      notify(() => ({
        event: 'MAPPING_EMPLOYEE', referenceId: String(r.biometric_id),
        subject: 'Your department / reporting manager has changed', heading: 'Transfer / manager change',
        intro: 'An order has changed your department or your reporting manager / HoD.', details, to: [r.user_id],
      }));
    }
    function sendManager(id: string, who: string[], arriving: boolean) {
      notify(() => ({
        event: arriving ? 'MAPPING_MANAGER_GAINED' : 'MAPPING_MANAGER_LOST', referenceId: batchId,
        subject: arriving ? `${who.length} employee${who.length === 1 ? '' : 's'} now report to you` : `${who.length} employee${who.length === 1 ? '' : 's'} no longer report to you`,
        heading: arriving ? 'New team members' : 'Team change',
        intro: arriving ? 'The following employees now report to you.' : 'The following employees no longer report to you.',
        details: who.slice(0, 50).map((w, i) => [`${i + 1}`, w] as Detail), to: [id],
      }));
    }
  });
}

const FIELD_WORDS: Record<string, string> = {
  name: 'Name', email: 'Email', department: 'Department / Project', designation: 'Designation', phone: 'Phone', officeLocation: 'Office location',
  joiningDate: 'Joining date', validUpto: 'Valid up to', employmentType: 'Employment type', shiftId: 'Shift', suffix: 'Suffix', institute: 'Institute',
};
const readable = (k: string) => FIELD_WORDS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim();
