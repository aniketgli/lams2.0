import { MAX_LIST_ROWS, listLimitProblem, visibilityClause, canSeeEmployee } from '../lib/visibility';
import { INCREMENT, NOW, assertUndo, decide, moveStatus, undoProblem, undoTarget, type UndoCheck } from '../lib/approvalFlow';
import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { loadCertificate, parseCertificate, saveCertificate, type CertificateFile } from './certificates';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { MAX_BACKDATE_DAYS, TOO_OLD_MESSAGE, Validator, isValidIsoDate, oldestApplicationDate, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import { canManageBalances, type RoleId } from '../lib/roles';
import type { ActivityScope } from '../employees/activity';
import { WEEK_DAYS, datesBetween, weekdayOf } from '../attendance/compute';
import { groupLeaveTypeIds, groupLeaveTypeMap } from './groups';
import { genderKey } from './gender';
import { CASUAL_CODES, LOOK_DAYS, type Combine, type Neighbour, combineProblem, toCombine } from './combine';
import {
  CHILD_CARE_CODE, CHILD_EVENTS, EOL_CODE, LND_CODE, continuousEol, eolProblems, fixedPurposes, lndProblems, serviceMonths, MATERNITY_CODE, PATERNITY_CODE, childCareProblems, childCareSpells, maternityDaysProblem, maternityEnd, maternityProblems,
  paternityEnd, type ChildDetails, matchPurpose, parsePurposes, paternityDaysProblem, paternityProblems,
} from './specialLeave';
import { layoutOfEmployeeType } from '../employees/references';
import { SESSIONS_END, SESSIONS_START, countLeaveDays, cycleYearOf } from './days';
import { notifyLeave } from '../notifications/events';
import { COMP_OFF_CODE, LATE_COMP_OFF_PER_MONTH, RESTRICTED_CODE, balanceFromCredits, creditsFor, matchCredits, monthlyProblem, personById, takenByMonth } from './compOff';
import type { Pair } from './compOffRules';
import { historyProblem, yearEnd, yearStart } from '../lib/dateWindow';

/**
 * Leave requests and balances. Every rule is checked here, never in the browser.
 *
 *   User               applies for themselves; edits / deletes while the request has not been looked at (pending at stage 1)
 *   Reporting Manager  stage 1: approves (one-stage leave) or forwards to the HoD (two-stage leave) / rejects, for the
 *                      people who report to them; may undo their own step once
 *   HoD                stage 2: approves / rejects what the reporting manager forwarded, for the people under them; may undo once
 *   Administrator      applies for anyone, edits / deletes before a decision, approves / rejects at any stage, undoes any time,
 *                      and sets balances
 *   Auditor            sees every request and balance, and the activity log
 *
 * The number of stages comes from the leave type (Leave Policy master). Used and pending days are always worked out
 * from the requests, never stored. Every change is audited in the same transaction.
 */

export const STATUSES = ['pending_l1', 'pending_l2', 'approved', 'rejected'] as const;
export type LeaveStatus = (typeof STATUSES)[number];

export const AUDIT_KEY = 'leave_request';
export const BALANCE_KEY = 'leave_balance';
/** An employee may apply this many days back when the leave type needs no notice (e.g. sick leave). */
export const EMPLOYEE_BACKDATE_DAYS = MAX_BACKDATE_DAYS;
/** Most days of leave encashment that can be taken with one LTC. */
export const LTC_ENCASH_MAX = 10;
/** After the leave and the encashment, at least this many days must stay in the balance. */
export const LTC_ENCASH_MIN_BALANCE = 30;
/** Leave encashment with LTC: at most this many days in the whole service. */
export const LTC_ENCASH_LIFETIME = 60;
export const COMMUTED_CODE = 'COMM';
export const COMMUTED_AFTER_MATERNITY_DAYS = 60;
export const MAX_RANGE_DAYS = 400;

export const LEAVE_SCOPE: ActivityScope = {
  keys: ['leave_request', 'leave_balance', 'leave_joining', 'leave_export', 'leave_data_export', 'leave_balance_data_export'],
  areaLabels: { leave_request: 'Leave request', leave_balance: 'Leave balance', leave_joining: 'Joining report', leave_export: 'Log download', leave_data_export: 'Data download', leave_balance_data_export: 'Balance download' },
  actionLabels: { CREATE: 'Applied / set', UPDATE: 'Edited', STATUS: 'Approved / forwarded / rejected', DELETE: 'Deleted' },
  exportKey: 'leave_export',
  title: 'Leave activity log',
  filePrefix: 'WII_Leave_Activity',
};

export interface Viewer { id: number; role: RoleId | null }

export interface LeaveRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  startSession: 'full' | 'second_half';
  endSession: 'full' | 'first_half';
  daysCount: number;
  cycleYear: number;
  reason: string;
  certificate: boolean;
  certificateName: string | null;
  /** The employee will leave the headquarters during this leave (station permission). */
  stationLeave: boolean;
  /** Set on a station leave that was applied automatically for the prefix / suffix of another leave request. */
  linkedTo: string | null;
  ltcType: 'none' | 'ltc' | 'ex_india';
  encashDays: number;
  contactAddress: string;
  /** Compensatory off: the worked weekly offs / holidays it uses, one per leave day. */
  compOffDates: string[];
  /** One of the leave type's purposes (e.g. Special Casual Leave), else null. */
  purpose: string | null;
  /**
   * Paternity / Maternity Leave: birth, adoption or (maternity) abortion / miscarriage, its date, the adopted child's date of
   * birth, surviving children before this child. Child Care Leave: 'care', with the child's date of birth, which child and flags.
   */
  childEvent: 'delivery' | 'adoption' | 'loss' | 'care' | null;
  childEventDate: string | null;
  childBirthDate: string | null;
  survivingChildren: number | null;
  childOrder: 1 | 2 | null;
  childDisabled: boolean;
  singleParent: boolean;
  prefixFrom: string | null;
  prefixTo: string | null;
  suffixFrom: string | null;
  suffixTo: string | null;
  stages: 1 | 2;
  status: LeaveStatus;
  appliedAt: string;
  appliedByName: string;
  managerName: string | null;
  reviewerName: string | null;
  forwardedByName: string | null;
  forwardedAt: string | null;
  forwardComment: string | null;
  actionByName: string | null;
  /** What the person who decided was for this request: R.M., HoD or Admin. */
  actionByRole: 'R.M.' | 'HoD' | 'Admin' | null;
  actionAt: string | null;
  comment: string | null;
  /** Who the request waits for while pending: 'Reporting Manager' / 'HoD'. */
  waitingFor: string | null;
  canDecide: boolean;
  /** 'forward' when the reporting manager's approval sends it to the HoD. */
  decideStep: 'approve' | 'forward';
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
  /** Joining report after a 2-stage leave: none needed (yet), due now, or already filed (with its status). */
}

export interface LeaveInput {
  userId: string | null;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startSession: (typeof SESSIONS_START)[number];
  endSession: (typeof SESSIONS_END)[number];
  reason: string;
  /** Whether a medical certificate is on file (set by the server from the upload, never from the request body). */
  certificate: boolean;
  stationLeave: boolean;
  ltcType: 'none' | 'ltc' | 'ex_india';
  /** Leave encashment days with LTC (0 = none). */
  encashDays: number;
  contactAddress: string;
  prefix: { from: string; to: string } | null;
  suffix: { from: string; to: string } | null;
  /** A certificate uploaded with this application. */
  file: CertificateFile | null;
  /** Compensatory off only: the weekly offs / holidays worked that this leave uses, one per leave day. */
  compOffDates: string[];
  /** For a leave type with a purpose list: the purpose chosen (checked against the list). */
  purpose: string;
  /** Paternity Leave only. */
  child: ChildDetails;
}

export async function rows(q: { query: typeof pool.query }, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

export function profileData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
export const isoDate = (value: unknown): string => {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return String(value).slice(0, 10);
};
export const isoTime = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);
export const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
export const num = (n: number) => Math.round(n * 10) / 10;

const SELECT = `
  SELECT m.*, u.biometric_id, u.name AS user_name, p.designation, p.department, p.profile_data,
         t.name AS type_name, t.code AS type_code, (SELECT c.file_name FROM leave_certificates c WHERE c.request_id = m.id) AS certificate_name,
         (SELECT GROUP_CONCAT(DATE_FORMAT(w.work_date, '%Y-%m-%d') ORDER BY w.work_date) FROM leave_comp_off_uses w WHERE w.request_id = m.id) AS comp_off_days,
         ab.name AS applied_by_name, mg.name AS manager_name, rv.name AS reviewer_name, l1.name AS l1_name, ac.name AS action_by_name,
         TIMESTAMPDIFF(SECOND, COALESCE(m.action_at, m.l1_at), NOW(3)) AS step_age_sec
    FROM leave_requests m
    JOIN users u ON u.id = m.user_id
    JOIN leave_types t ON t.id = m.leave_type_id
    LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
    LEFT JOIN users ab ON ab.id = m.applied_by
    LEFT JOIN users mg ON mg.id = m.manager_id
    LEFT JOIN users rv ON rv.id = m.reviewer_id
    LEFT JOIN users l1 ON l1.id = m.l1_by
    LEFT JOIN users ac ON ac.id = m.action_by`;

/** The employee's reporting manager and HoD today (the profile may have changed since the request was made). */
export function managersOf(row: RowDataPacket): { reporting: string; reviewing: string } {
  const data = profileData(row.profile_data);
  return { reporting: String(data.reportingManagerId ?? ''), reviewing: String(data.reviewingManagerId ?? '') };
}

function canSee(viewer: Viewer, row: RowDataPacket): boolean {
  return canSeeEmployee(viewer, row.user_id, managersOf(row));
}

/** Whose balance the viewer may see: as for requests, plus everyone for a Leave Balance Manager (balances only, not requests). */
const canSeeBalance = (viewer: Viewer, row: RowDataPacket): boolean => canSee(viewer, row) || viewer.role === 'leave_balance_manager';

function canDecide(viewer: Viewer, row: RowDataPacket): boolean {
  const status = String(row.status);
  if (status !== 'pending_l1' && status !== 'pending_l2') return false;
  if (viewer.role === 'administrator') return true;
  if (Number(row.user_id) === viewer.id) return false;
  const m = managersOf(row);
  if (status === 'pending_l1') return viewer.role === 'reporting_manager' && m.reporting === String(viewer.id);
  return viewer.role === 'reviewing_manager' && m.reviewing === String(viewer.id);
}

/** Edit / delete are open up to the start date; once it has passed (always so for a leave applied after its date) the leave is locked for everyone. */
export const DATE_PASSED_MESSAGE = 'The leave date has passed, so it can no longer be edited or deleted.';
function canModify(viewer: Viewer, row: RowDataPacket, today = todayInIndia()): boolean {
  if (String(row.status) !== 'pending_l1' || row.linked_to || isoDate(row.start_date) < today) return false; // a linked station leave follows its leave request
  if (viewer.role === 'administrator') return true;
  return viewer.role === 'general_staff' && Number(row.user_id) === viewer.id;
}

/** The facts the shared approval flow needs to say whether `viewer` may undo the last step (approvalFlow.undoProblem). */
function undoCheck(viewer: Viewer, row: RowDataPacket): UndoCheck {
  const m = managersOf(row);
  return {
    status: String(row.status), ageSeconds: row.step_age_sec, viewerId: viewer.id, isAdmin: viewer.role === 'administrator',
    isReporting: viewer.role === 'reporting_manager' && m.reporting === String(viewer.id),
    isReviewing: viewer.role === 'reviewing_manager' && m.reviewing === String(viewer.id),
    decidedStage: row.decided_stage === null || row.decided_stage === undefined ? null : Number(row.decided_stage),
    actionBy: row.action_by ? Number(row.action_by) : null, forwardedBy: row.l1_by ? Number(row.l1_by) : null,
    undoCount: Number(row.undo_count ?? 0), undo2Count: Number(row.undo2_count ?? 0),
  };
}

function canUndo(viewer: Viewer, row: RowDataPacket): boolean {
  return undoProblem(undoCheck(viewer, row)) === null;
}

function toRequest(viewer: Viewer, row: RowDataPacket): LeaveRequest {
  const status = String(row.status) as LeaveStatus;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    biometricId: String(row.biometric_id ?? ''),
    name: String(row.user_name ?? ''),
    designation: String(row.designation ?? ''),
    department: String(row.department ?? ''),
    leaveTypeId: String(row.leave_type_id),
    leaveTypeName: String(row.type_name ?? ''),
    leaveTypeCode: String(row.type_code ?? ''),
    startDate: isoDate(row.start_date),
    endDate: isoDate(row.end_date),
    startSession: String(row.start_session) === 'second_half' ? 'second_half' : 'full',
    endSession: String(row.end_session) === 'first_half' ? 'first_half' : 'full',
    daysCount: Number(row.days_count),
    cycleYear: Number(row.cycle_year),
    reason: String(row.reason),
    certificate: Boolean(row.certificate),
    certificateName: row.certificate_name ? String(row.certificate_name) : null,
    stationLeave: Boolean(row.station_leave),
    linkedTo: row.linked_to ? String(row.linked_to) : null,
    ltcType: row.ltc_type === 'ltc' ? 'ltc' : row.ltc_type === 'ex_india' ? 'ex_india' : 'none',
    encashDays: Number(row.encash_days ?? 0),
    contactAddress: row.contact_address ? String(row.contact_address) : '',
    compOffDates: row.comp_off_days ? String(row.comp_off_days).split(',') : [],
    purpose: row.purpose ? String(row.purpose) : null,
    childEvent: (CHILD_EVENTS as readonly string[]).includes(String(row.child_event)) ? (String(row.child_event) as LeaveRequest['childEvent']) : null,
    childEventDate: row.child_event_date ? isoDate(row.child_event_date) : null,
    childBirthDate: row.child_birth_date ? isoDate(row.child_birth_date) : null,
    survivingChildren: row.surviving_children === null || row.surviving_children === undefined ? null : Number(row.surviving_children),
    childOrder: Number(row.child_order) === 1 ? 1 : Number(row.child_order) === 2 ? 2 : null,
    childDisabled: Boolean(row.child_disabled),
    singleParent: Boolean(row.single_parent),
    prefixFrom: row.prefix_from ? isoDate(row.prefix_from) : null,
    prefixTo: row.prefix_to ? isoDate(row.prefix_to) : null,
    suffixFrom: row.suffix_from ? isoDate(row.suffix_from) : null,
    suffixTo: row.suffix_to ? isoDate(row.suffix_to) : null,
    stages: Number(row.stages) === 2 ? 2 : 1,
    status,
    appliedAt: isoTime(row.created_at) ?? '',
    appliedByName: String(row.applied_by_name ?? ''),
    managerName: row.manager_name ? String(row.manager_name) : null,
    reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
    forwardedByName: row.l1_name ? String(row.l1_name) : null,
    forwardedAt: isoTime(row.l1_at),
    forwardComment: row.l1_comment ? String(row.l1_comment) : null,
    actionByName: row.action_by_name ? String(row.action_by_name) : null,
    actionByRole: !row.action_by ? null : Number(row.action_by) === Number(row.reviewer_id) && Number(row.decided_stage) === 2 ? 'HoD' : Number(row.action_by) === Number(row.manager_id) ? 'R.M.' : Number(row.action_by) === Number(row.reviewer_id) ? 'HoD' : 'Admin',
    actionAt: isoTime(row.action_at),
    comment: row.manager_comment ? String(row.manager_comment) : null,
    waitingFor: status === 'pending_l1' ? 'Reporting Manager' : status === 'pending_l2' ? 'HoD' : null,
    canDecide: canDecide(viewer, row),
    decideStep: status === 'pending_l1' && Number(row.stages) === 2 && viewer.role !== 'administrator' ? 'forward' : 'approve',
    canEdit: canModify(viewer, row),
    canDelete: canModify(viewer, row),
    canUndo: canUndo(viewer, row),
  };
}

/** One line on the child for the audit log. */
function childText(r: LeaveRequest): string | null {
  if (!r.childEvent) return null;
  if (r.childEvent === 'care') {
    return `${r.childOrder === 2 ? 'Second eldest' : 'Eldest'} child, born ${r.childBirthDate ?? '-'}${r.childDisabled ? ', with a disability' : ''}${r.singleParent ? ', single mother' : ''}`;
  }
  if (r.childEvent === 'loss') return `Abortion / miscarriage on ${r.childEventDate}`;
  return `${r.childEvent === 'delivery' ? 'Delivery' : 'Adoption'} on ${r.childEventDate}${r.childBirthDate ? `, child born ${r.childBirthDate}` : ''}, surviving children ${r.survivingChildren ?? '-'}`;
}

function auditView(r: LeaveRequest): Record<string, unknown> {
  return {
    employee: `${r.name} (${r.biometricId})`, leaveType: `${r.leaveTypeName} (${r.leaveTypeCode})`, startDate: r.startDate, endDate: r.endDate,
    startSession: r.startSession, endSession: r.endSession, days: r.daysCount, reason: r.reason, certificate: r.certificateName ?? (r.certificate ? 'Yes' : 'No'), stationPermission: r.stationLeave ? 'Required' : 'Not required', ltc: r.ltcType, encashDays: r.encashDays, contactAddress: r.contactAddress, compOffDays: r.compOffDates.join(', ') || null, purpose: r.purpose,
    child: childText(r), prefix: r.prefixFrom ? `${r.prefixFrom} to ${r.prefixTo}` : null, suffix: r.suffixFrom ? `${r.suffixFrom} to ${r.suffixTo}` : null, status: r.status,
    forwardedBy: r.forwardedByName, comment: r.comment,
  };
}
const label = (r: LeaveRequest) => `${r.name} (${r.biometricId}) · ${r.leaveTypeCode} · ${r.startDate}${r.endDate !== r.startDate ? ` to ${r.endDate}` : ''}`;

export function missingTable(error: unknown): never | undefined {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Leave is not set up yet. Ask the administrator to run the leave migrations.', 'NOT_CONFIGURED');
  }
  return undefined;
}

export function parseRange(query: { from?: unknown; to?: unknown }, today = todayInIndia(), role?: string | null): { from: string; to: string } {
  const from = String(query.from ?? yearStart(today));
  const to = String(query.to ?? yearEnd(today));
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Dates must be in YYYY-MM-DD format.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  const tooOld = historyProblem(role, from, today);
  if (tooOld) throw badRequest(tooOld, { from: tooOld });
  return { from, to };
}

export async function listRequests(viewer: Viewer, query: { from?: unknown; to?: unknown }): Promise<{ from: string; to: string; requests: LeaveRequest[] }> {
  const { from, to } = parseRange(query, todayInIndia(), viewer.role);
  let found: RowDataPacket[];
  try {
    const see = visibilityClause(viewer);
    found = await rows(pool,
      `${SELECT} WHERE m.start_date <= ? AND m.end_date >= ?${see ? ` AND ${see.sql}` : ''} ORDER BY m.start_date DESC, m.id DESC LIMIT ${MAX_LIST_ROWS + 1}`,
      [to, from, ...(see?.params ?? [])]);
  } catch (error) {
    missingTable(error);
    throw error;
  }
  const tooMany = listLimitProblem(found.length);
  if (tooMany) throw badRequest(tooMany);
  return { from, to, requests: found.map((row) => toRequest(viewer, row)) };
}

// ---------------------------------------------------------------------------
// Employee, policy and balance lookups
// ---------------------------------------------------------------------------

export interface Employee {
  id: number;
  biometricId: string;
  employmentType: string;
  gender: string;
  joining: string | null;
  basis: 'CY' | 'FY';
  shiftId: string | null;
  isPwd: boolean;
  /** Leave types of the employee's group; null when the employee has no group (nothing restricted). */
  groupTypeIds: Set<number> | null;
  reportingManagerId: string | null;
  reviewingManagerId: string | null;
}

export async function loadEmployee(q: { query: typeof pool.query }, userId: number): Promise<Employee> {
  const [row] = await rows(q,
    `SELECT u.id, u.status, u.biometric_id, p.employment_type, p.joining_date, p.shift_id, p.profile_data FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  if (!row) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee from the list.' });
  if (String(row.status).toLowerCase() !== 'active') throw badRequest('Please correct the highlighted fields.', { userId: 'This employee is not active.' });
  const data = profileData(row.profile_data);
  const id = (v: unknown) => (/^\d+$/.test(String(v ?? '')) ? String(v) : null);
  return {
    biometricId: String(row.biometric_id ?? ''),
    id: Number(row.id),
    employmentType: String(row.employment_type ?? ''),
    gender: String(data.gender ?? ''),
    joining: row.joining_date ? isoDate(row.joining_date) : null,
    basis: data.leaveCycle === 'FY' ? 'FY' : 'CY',
    shiftId: row.shift_id ? String(row.shift_id) : null,
    isPwd: data.isPwd === true || data.isPwd === 'true',
    groupTypeIds: await groupLeaveTypeIds(q, data.leaveGroup),
    reportingManagerId: id(data.reportingManagerId),
    reviewingManagerId: id(data.reviewingManagerId),
  };
}

export interface Policy {
  id: number; code: string; name: string; quota: number; pwdQuota: number | null; pwdOnly: boolean; stages: 1 | 2; minNotice: number; halfDay: boolean; certDays: number;
  sandwich: 'included' | 'excluded'; employeeTypes: string[]; gender: string; minServiceMonths: number; maxConsecutive: number; debited: boolean;
  status: string; combineWith: Combine; maxAccumulation: number; afterExhaustedId: number; accrual: string; debitFromId: number; debitFactor: number; lifetimeMax: number; maxSpells: number; minDays: number; maxSpellsMonth: number; maxSpellsLifetime: number; quotas: Record<string, number>;
  needsContact: boolean; ltcAllowed: boolean; prefixSuffix: boolean; hodAfterDays: number; certificateRequired: boolean; offDaysOnly: boolean;
  /** Purposes the leave can be taken for (empty: any reason). */
  purposes: string[];
}

function toPolicy(r: RowDataPacket): Policy {
  return {
    id: Number(r.id), code: String(r.code), name: String(r.name), quota: Number(r.default_quota), pwdQuota: r.pwd_quota === null || r.pwd_quota === undefined ? null : Number(r.pwd_quota), pwdOnly: Boolean(r.pwd_only), stages: Number(r.approval_stages) === 2 ? 2 : 1,
    minNotice: Number(r.min_notice_days), halfDay: Boolean(r.half_day_allowed), certDays: Number(r.medical_cert_days),
    sandwich: Number(r.approval_stages) === 2 ? 'included' : 'excluded',
    employeeTypes: String(r.employee_types || '').split(',').map((s) => s.trim()).filter(Boolean), gender: String(r.gender),
    minServiceMonths: Number(r.min_service_months), maxConsecutive: Number(r.max_consecutive_days), debited: Boolean(r.is_debited),
    status: String(r.status), combineWith: toCombine(r.combine_with), maxAccumulation: Number(r.max_accumulation), afterExhaustedId: Number(r.after_exhausted_type_id ?? 0), accrual: String(r.accrual ?? 'yearly'),
    debitFromId: Number(r.debit_from_type_id ?? 0), debitFactor: Number(r.debit_factor ?? 1),
    lifetimeMax: Number(r.lifetime_max ?? 0), maxSpells: Number(r.max_spells_per_year ?? 0), minDays: Number(r.min_days_per_application ?? 0), maxSpellsMonth: Number(r.max_spells_per_month ?? 0), maxSpellsLifetime: Number(r.max_spells_lifetime ?? 0), quotas: {},
    needsContact: Boolean(r.needs_contact), ltcAllowed: Boolean(r.ltc_allowed), prefixSuffix: Boolean(r.prefix_suffix), hodAfterDays: Number(r.hod_after_days ?? 0), certificateRequired: Boolean(r.certificate_required), offDaysOnly: Boolean(r.off_days_only),
    purposes: fixedPurposes(String(r.code), parsePurposes(r.purposes)),
  };
}

/** Quota of the employee type where the master sets one, else the leave type's default quota. */
/** Yearly quota: the PwD quota for a person with disability, else the employee type's quota, else the default. */
export const quotaFor = (policy: Pick<Policy, 'quota' | 'quotas' | 'pwdQuota'>, employmentType: string, isPwd = false): number =>
  (isPwd && policy.pwdQuota !== null ? policy.pwdQuota : undefined) ?? policy.quotas[employmentType] ?? policy.quota;

/**
 * Days credited so far in the leave year. A half-yearly type credits half the yearly quota at the start of each half
 * (1 January and 1 July; 1 April and 1 October for a financial-year employee); other types credit everything upfront.
 */
/**
 * The date a year's balance is read at: the latest balance for the running year (today), the closing balance for a
 * year that has ended (its last day: 31 Dec, or 31 Mar for a financial year) and the opening one for a year not yet begun.
 */
export function balanceAsOn(year: number, basis: 'CY' | 'FY', today: string): string {
  const start = basis === 'FY' ? `${year}-04-01` : `${year}-01-01`;
  const end = basis === 'FY' ? `${year + 1}-03-31` : `${year}-12-31`;
  return today < start ? start : today > end ? end : today;
}

/**
 * The days a balance starts with before the Leave Balance Manager / Administrator has set it: none. Every quota is
 * set (and added to / deducted from) by them, at the frequency of each leave (yearly, half-yearly, …); the leave type's
 * quota is only the entitlement shown on the Leave Types page. (Kept as a function so the callers stay as they are.)
 */
export function creditedQuota(policy: Pick<Policy, 'quota' | 'quotas' | 'pwdQuota' | 'accrual'>, employmentType: string, cycleYear: number, basis: 'CY' | 'FY', asOf: string, isPwd = false): number {
  void policy; void employmentType; void cycleYear; void basis; void asOf; void isPwd;
  return 0;
}

async function attachQuotas(q: { query: typeof pool.query }, policies: Policy[]): Promise<Policy[]> {
  if (!policies.length) return policies;
  const found = await rows(q, 'SELECT leave_type_id, employee_type, quota FROM leave_type_quotas');
  for (const p of policies) for (const f of found) if (Number(f.leave_type_id) === p.id) p.quotas[String(f.employee_type)] = Number(f.quota);
  return policies;
}

export async function loadPolicy(q: { query: typeof pool.query }, id: number): Promise<Policy | null> {
  const [row] = await rows(q, 'SELECT * FROM leave_types WHERE id = ? LIMIT 1', [id]);
  if (!row) return null;
  const [policy] = await attachQuotas(q, [toPolicy(row)]);
  return policy;
}

const monthsBetween = (from: string, to: string): number =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) - (Number(to.slice(8, 10)) < Number(from.slice(8, 10)) ? 1 : 0);

/** Why this employee may not take this leave type, or null when eligible. */
export function eligibilityProblem(policy: Policy, emp: Pick<Employee, 'employmentType' | 'gender' | 'joining'> & { isPwd?: boolean; groupTypeIds?: Set<number> | null }, onDate: string): string | null {
  if (emp.groupTypeIds && !emp.groupTypeIds.has(policy.id)) return `${policy.name} is not part of this employee’s leave group.`;
  if (policy.pwdOnly && !emp.isPwd) return `${policy.name} is for persons with disability only.`;
  if (policy.employeeTypes.length && !policy.employeeTypes.includes(emp.employmentType)) return `${policy.name} is not available for this employee type.`;
  if (policy.gender === 'female_only' && genderKey(emp.gender) !== 'female') return `${policy.name} is for female employees only.`;
  if (policy.gender === 'male_only' && genderKey(emp.gender) !== 'male') return `${policy.name} is for male employees only.`;
  if (policy.minServiceMonths && emp.joining && monthsBetween(emp.joining, onDate) < policy.minServiceMonths) return `${policy.name} needs at least ${policy.minServiceMonths} months of service.`;
  return null;
}

export interface Balance { total: number; carryForward: number; used: number; pending: number; available: number; /** The date the balance was set as on (leaves before it are already in it). */ asOf?: string | null }

/**
 * leave_balances.as_of (migration 20261208_balance_as_on.sql): checked once, so every leave screen keeps working before
 * that migration is run (then every leave of the year is counted, as before).
 */
let asOfColumn: Promise<boolean> | null = null;
export function hasAsOfColumn(q: { query: typeof pool.query }): Promise<boolean> {
  asOfColumn ??= rows(q, "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_balances' AND COLUMN_NAME = 'as_of'")
    .then((r) => Number(r[0]?.n ?? 0) > 0)
    .catch(() => { asOfColumn = null; return false; });
  return asOfColumn;
}

/**
 * SQL that leaves out leaves taken before the balance's "as on" date: a JOIN on leave_balances (alias b) for the type
 * whose balance is used (`typeExpr`), and the condition. Empty when the column is not there yet.
 */
export async function asOfFilter(q: { query: typeof pool.query }, req: string, typeExpr: string): Promise<{ join: string; where: string }> {
  if (!(await hasAsOfColumn(q))) return { join: '', where: '' };
  return {
    join: ` LEFT JOIN leave_balances b ON b.user_id = ${req}.user_id AND b.leave_type_id = ${typeExpr} AND b.cycle_year = ${req}.cycle_year`,
    where: ` AND (b.as_of IS NULL OR ${req}.start_date >= b.as_of)`,
  };
}

export async function balanceOf(
  q: { query: typeof pool.query }, userId: number, policy: Pick<Policy, 'id' | 'quota'>, cycleYear: number, exceptRequestId = 0,
): Promise<Balance> {
  // Compensatory off: the days earned by working a weekly off / holiday and still valid, not a granted quota.
  const [kind] = await rows(q, 'SELECT code FROM leave_types WHERE id = ? LIMIT 1', [policy.id]);
  if (kind && String(kind.code) === COMP_OFF_CODE) {
    const person = await personById(userId);
    const credits = person ? (await creditsFor([person], todayInIndia(), exceptRequestId)).get(userId) ?? [] : [];
    return balanceFromCredits(credits);
  }
  const withAsOf = await hasAsOfColumn(q);
  const [grant] = await rows(q, `SELECT total, carry_forward${withAsOf ? ", DATE_FORMAT(as_of, '%Y-%m-%d') AS as_of" : ''} FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? LIMIT 1`, [userId, policy.id, cycleYear]);
  // A balance set "as on" a date already reflects the leaves before it: only leaves from that date on come off it.
  const asOf: string | null = grant?.as_of ? String(grant.as_of) : null;
  const since = asOf ? ' AND start_date >= ?' : '';
  const sinceParams = asOf ? [asOf] : [];
  const [sums] = await rows(q,
    `SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count + encash_days ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count + encash_days ELSE 0 END), 0) AS pending
       FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND id <> ?${since}`, [userId, policy.id, cycleYear, exceptRequestId, ...sinceParams]);
  const total = grant ? Number(grant.total) : policy.quota;
  const carryForward = grant ? Number(grant.carry_forward) : 0;
  // Leave types that are debited from this one (commuted leave takes a multiple of its days from half pay leave).
  const [linked] = await rows(q,
    `SELECT COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND t.debit_from_type_id = ? AND r.cycle_year = ? AND r.id <> ?${asOf ? ' AND r.start_date >= ?' : ''}`, [userId, policy.id, cycleYear, exceptRequestId, ...sinceParams]);
  const used = Number(sums?.used ?? 0) + Number(linked?.used ?? 0), pending = Number(sums?.pending ?? 0) + Number(linked?.pending ?? 0);
  return { total, carryForward, used: num(used), pending: num(pending), available: num(total + carryForward - used - pending), asOf };
}

/** Working weekdays of the employee's shift and the gazetted holidays in a range, for counting leave days. */
export async function dayRule(q: { query: typeof pool.query }, emp: Employee, policy: Policy, from: string, to: string) {
  let workingDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  try {
    const found = emp.shiftId
      ? await rows(q, 'SELECT applicable_days FROM shifts WHERE id = ? LIMIT 1', [emp.shiftId])
      : await rows(q, 'SELECT applicable_days FROM shifts WHERE is_default = 1 LIMIT 1');
    const raw = found[0]?.applicable_days;
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw || '[]') : [];
    const valid = list.filter((d: unknown) => (WEEK_DAYS as readonly string[]).includes(String(d)));
    if (valid.length) workingDays = valid;
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  const gazetted = new Set<string>();
  try {
    const holidays = await rows(q, "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d FROM holidays WHERE type = 'gazetted' AND holiday_date BETWEEN ? AND ?", [from, to]);
    for (const h of holidays) gazetted.add(String(h.d));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return { sandwich: policy.sandwich === 'included' || policy.offDaysOnly ? 'included' as const : 'excluded' as const, workingDays, gazetted };
}

/** The first working day after `end`: not a weekly off of the shift and not a gazetted holiday. */
export function firstWorkingDayAfter(end: string, workingDays: string[], gazetted: Set<string>): string {
  for (const date of datesBetween(addDays(end, 1), addDays(end, 60))) {
    if (workingDays.includes(weekdayOf(date)) && !gazetted.has(date)) return date;
  }
  return addDays(end, 1);
}

export async function joiningDateOf(q: { query: typeof pool.query }, row: RowDataPacket): Promise<string> {
  const emp = await loadEmployee(q, Number(row.user_id));
  const end = isoDate(row.end_date);
  // Only the shift's working days and the gazetted holidays matter here.
  const rule = await dayRule(q, emp, { sandwich: 'excluded', offDaysOnly: false } as never, addDays(end, 1), addDays(end, 60));
  return firstWorkingDayAfter(end, rule.workingDays, rule.gazetted);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function parseLeaveInput(body: unknown): LeaveInput {
  const v = new Validator(body);
  const userId = v.string('userId', { required: false, pattern: /^\d{1,20}$/, patternMessage: 'Invalid employee.' }) || null;
  const leaveTypeId = v.string('leaveTypeId', { pattern: /^\d{1,20}$/, patternMessage: 'Choose a leave type.' });
  const startDate = v.date('startDate');
  const endDate = v.date('endDate');
  const startSession = v.oneOf('startSession', SESSIONS_START, false) ?? 'full';
  const endSession = v.oneOf('endSession', SESSIONS_END, false) ?? 'full';
  const reason = v.string('reason', { min: 5, max: 1000 });
  if (startDate && endDate && startDate > endDate) v.errors.endDate ||= 'End date cannot be before the start date.';
  v.assert();
  const raw = (body ?? {}) as Record<string, unknown>;
  const ltcType = v.oneOf('ltcType', ['none', 'ltc', 'ex_india'] as const, false) ?? 'none';
  let encashDays = 0;
  if (ltcType === 'ltc' && raw.encashLtc === true) {
    encashDays = Number(raw.encashDays);
    if (!Number.isInteger(encashDays) || encashDays < 1 || encashDays > LTC_ENCASH_MAX) v.errors.encashDays ||= `Enter whole days from 1 to ${LTC_ENCASH_MAX}.`;
  }
  const contactAddress = v.optionalString('contactAddress', { max: 300 })?.replace(/\s+/g, ' ') ?? '';
  const range = (a: string, b: string, label: string): { from: string; to: string } | null => {
    const from = v.date(a);
    const to = v.date(b);
    if (from && to && from > to) v.errors[b] ||= `${label} end cannot be before its start.`;
    return from && to ? { from, to } : null;
  };
  const prefix = raw.availPrefix === true ? range('prefixFrom', 'prefixTo', 'Prefix') : null;
  const suffix = raw.availSuffix === true ? range('suffixFrom', 'suffixTo', 'Suffix') : null;
  if (Object.keys(v.errors).length) v.assert();
  const file = parseCertificate((body as Record<string, unknown> | null)?.certificateFile);
  const rawDays = raw.compOffDates;
  const compOffDates: string[] = Array.isArray(rawDays) ? rawDays.map((x) => String(x)) : typeof rawDays === 'string' && rawDays ? rawDays.split(',') : []; // the preview sends them comma-separated
  if (compOffDates.length > 31 || compOffDates.some((d) => !isValidIsoDate(d))) v.errors.compOffDates ||= 'Choose the worked days from the list.';
  const purpose = typeof raw.purpose === 'string' ? raw.purpose.trim().slice(0, 200) : '';
  const optionalDate = (key: string): string | null => {
    const value = typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
    if (!value) return null;
    if (!isValidIsoDate(value)) { v.errors[key] ||= 'Enter a valid date.'; return null; }
    return value;
  };
  const event = (CHILD_EVENTS as readonly string[]).includes(String(raw.childEvent)) ? (String(raw.childEvent) as ChildDetails['event']) : null;
  const rawChildren = raw.survivingChildren;
  let survivingChildren: number | null = null;
  if (rawChildren !== undefined && rawChildren !== null && String(rawChildren).trim() !== '') {
    survivingChildren = Number(rawChildren);
    if (!Number.isInteger(survivingChildren) || survivingChildren < 0 || survivingChildren > 20) { v.errors.survivingChildren ||= 'Enter a whole number.'; survivingChildren = null; }
  }
  const order = Number(raw.childOrder);
  const child: ChildDetails = {
    event, eventDate: event === 'care' ? null : optionalDate('childEventDate'), birthDate: event === 'adoption' || event === 'care' ? optionalDate('childBirthDate') : null,
    survivingChildren: event === 'care' || event === 'loss' ? null : survivingChildren,
    childOrder: event === 'care' && (order === 1 || order === 2) ? order : null,
    childDisabled: event === 'care' && raw.childDisabled === true,
    singleParent: event === 'care' && raw.singleParent === true,
  };
  v.assert();
  return { purpose, child, compOffDates, userId, leaveTypeId, startDate: startDate!, endDate: endDate!, startSession, endSession, reason: reason.replace(/\s+/g, ' '), certificate: Boolean(file), stationLeave: raw.stationLeave === true, ltcType, encashDays, contactAddress, prefix, suffix, file };
}

/** Paternity Leave, and Maternity Leave for a birth / adoption, can be joined with any other kind of leave. */
const joinsAny = (policy: Pick<Policy, 'code'>, input: Pick<LeaveInput, 'child'>): boolean =>
  policy.code === PATERNITY_CODE || (policy.code === MATERNITY_CODE && input.child.event !== 'loss');
/** Taken in one go, holidays included, whatever dates were sent: To is worked out from From. */
const fixedLength = (policy: Pick<Policy, 'code'>, input: Pick<LeaveInput, 'child'>): boolean =>
  policy.code === PATERNITY_CODE || (policy.code === MATERNITY_CODE && (input.child.event === 'delivery' || input.child.event === 'adoption'));

/** Looks at the employee's other leaves around the new one: see ./combine. */
async function joinProblem(q: { query: typeof pool.query }, emp: Employee, policy: Policy, input: LeaveInput, targetId: number, exceptId: number): Promise<string | null> {
  const from = addDays(input.startDate, -LOOK_DAYS);
  const to = addDays(input.endDate, LOOK_DAYS);
  const found = await rows(q,
    `SELECT r.leave_type_id, r.start_date, r.end_date, t.code, t.name, t.approval_stages, t.combine_with FROM leave_requests r
       JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND r.status <> 'rejected' AND r.id <> ? AND r.end_date >= ? AND r.start_date <= ? AND (r.linked_to IS NULL OR r.linked_to <> ?)
        AND t.code <> ? AND NOT (t.code = ? AND COALESCE(r.child_event, '') <> 'loss')`, // Paternity and birth / adoption Maternity Leave join any leave
    [targetId, exceptId, from, to, exceptId, PATERNITY_CODE, MATERNITY_CODE]);
  if (!found.length || joinsAny(policy, input)) return null;
  const others: Neighbour[] = found.map((r) => ({
    id: Number(r.leave_type_id), name: String(r.name), stages: Number(r.approval_stages) === 2 ? 2 : 1, combineWith: toCombine(r.combine_with), start: isoDate(r.start_date), end: isoDate(r.end_date),
    casual: CASUAL_CODES.includes(String(r.code)),
  }));
  const { punchDates } = await import('../attendance/store'); // loaded here: the attendance module itself imports this one
  const [rule, worked] = await Promise.all([dayRule(q, emp, policy, from, to), punchDates(emp.biometricId, from, to)]);
  return combineProblem({ id: policy.id, name: policy.name, stages: policy.stages, combineWith: policy.combineWith, casual: CASUAL_CODES.includes(policy.code) }, input.startDate, input.endDate, others, rule.workingDays, rule.gazetted, worked);
}

export interface HolidayBlock { from: string; to: string; days: number }
/** Weekly offs / holidays between two straight 2-stage leaves: they become leave days of the earlier leave. */
export interface JoinedGap { requestId: number; typeId: number; typeName: string; side: 'after' | 'before'; from: string; to: string; days: number }
export interface Checked { requested: { startDate: string; endDate: string }; days: number; cycleYear: number; policy: Policy; emp: Employee; balance: Balance; stages: 1 | 2; prefix: HolidayBlock | null; suffix: HolidayBlock | null; stationOk: boolean; joins: JoinedGap[]; compOffPairs: Pair[] }

/** Every rule of a leave application. Throws a field-level 400 / 409 when one fails. */
async function checkLeave(
  q: { query: typeof pool.query }, viewer: Viewer, input: LeaveInput, targetId: number, exceptId: number, today = todayInIndia(), soft = false,
): Promise<Checked> {
  const emp = await loadEmployee(q, targetId);
  const policy = await loadPolicy(q, Number(input.leaveTypeId));
  const errors: Record<string, string> = {};
  if (!policy || policy.status !== 'active') throw badRequest('Please correct the highlighted fields.', { leaveTypeId: 'Choose a leave type from the list.' });
  // A station leave has no prefix / suffix of its own and is always a station leave; for every other leave, station
  // permission is chosen by the employee, and availing a prefix / suffix means it is taken.
  if (policy.offDaysOnly) { input.prefix = null; input.suffix = null; }
  input.stationLeave = input.stationLeave || Boolean(input.prefix || input.suffix) || policy.offDaysOnly;
  // Weekly offs / holidays at the very start or end of a leave are not leave days: the dates move to the first and
  // last working day, and those days become the prefix / suffix.
  // Paternity Leave is 15 days in one go, holidays included: To is always From + 14 days (worked out here, whatever was
  // sent), and holidays at its start or end stay leave days.
  // Maternity Leave for a birth / adoption is the same: 180 days in one go.
  if (fixedLength(policy, input)) {
    input.endDate = policy.code === PATERNITY_CODE ? paternityEnd(input.startDate) : maternityEnd(input.startDate);
    input.startSession = 'full'; input.endSession = 'full';
  }
  const requested = { startDate: input.startDate, endDate: input.endDate };
  if (!policy.offDaysOnly && !fixedLength(policy, input)) {
    const edge = await dayRule(q, emp, policy, addDays(input.startDate, -1), addDays(input.endDate, 1));
    const isOff = (d: string) => !edge.workingDays.includes(weekdayOf(d)) || edge.gazetted.has(d);
    let s = input.startDate; let e = input.endDate;
    while (s <= e && isOff(s)) s = addDays(s, 1);
    while (e >= s && isOff(e)) e = addDays(e, -1);
    if (s > e) throw badRequest('Please correct the highlighted fields.', { startDate: 'No working day in these dates.' });
    if (s !== input.startDate) { input.startDate = s; input.startSession = 'full'; }
    if (e !== input.endDate) { input.endDate = e; input.endSession = 'full'; }
  }

  const problem = eligibilityProblem(policy, emp, input.startDate);
  if (problem) errors.leaveTypeId = problem;

  const isAdmin = viewer.role === 'administrator';
  const earliest = isAdmin ? oldestApplicationDate(today) : addDays(today, policy.minNotice === 0 ? -EMPLOYEE_BACKDATE_DAYS : 0);
  if (input.startDate < oldestApplicationDate(today)) {
    errors.startDate = TOO_OLD_MESSAGE;
  } else if (input.startDate < earliest) {
    errors.startDate = policy.minNotice === 0 ? `Leave can be applied up to ${EMPLOYEE_BACKDATE_DAYS} days back.` : 'The start date cannot be in the past.';
  } else if (emp.joining && input.startDate < emp.joining) errors.startDate = `This is before the employee joined (${emp.joining}).`;
  else if (input.startDate > addDays(today, 365)) errors.startDate = 'The start date is more than a year away.';
  else if (!isAdmin && policy.minNotice > 0 && daysBetween(today, input.startDate) - 1 < policy.minNotice) errors.startDate = `${policy.name} needs ${policy.minNotice} days notice.`;

  const cycleYear = cycleYearOf(input.startDate, emp.basis);
  // (Paternity Leave takes nothing from a yearly balance and is 15 days in one go, so it may run into the next leave year.)
  if (cycleYearOf(input.endDate, emp.basis) !== cycleYear && policy.code !== PATERNITY_CODE && policy.code !== MATERNITY_CODE) errors.endDate ||= 'A leave cannot run across two leave years. Apply separately for each year.';
  if (daysBetween(input.startDate, input.endDate) > 366) errors.endDate ||= 'A leave can cover at most one year.';
  if ((input.startSession !== 'full' || input.endSession !== 'full') && !policy.halfDay) errors.startSession = `${policy.name} cannot be taken as a half day.`;
  // One day: the 1st half or the 2nd half, not both (that is a full day).
  else if (input.startDate === input.endDate && input.startSession === 'second_half' && input.endSession === 'first_half') errors.startSession = 'Choose Full day, 1st half or 2nd half.';
  // A leave type with a purpose list (e.g. Special Casual Leave) is taken only for one of those purposes.
  if (policy.purposes.length) {
    const matched = matchPurpose(policy.purposes, input.purpose);
    if (matched) input.purpose = matched;
    else if (!soft) errors.purpose = input.purpose ? 'Choose a purpose from the list.' : `Choose the purpose of the ${policy.name}.`;
  } else input.purpose = '';
  // Paternity Leave: birth / adoption details and the time it must be taken in (see ./specialLeave).
  // Maternity Leave: birth / adoption / abortion or miscarriage; Child Care Leave: which child (see ./specialLeave).
  if (policy.code === PATERNITY_CODE) {
    if (input.child.event !== 'delivery' && input.child.event !== 'adoption') input.child = { ...input.child, event: null };
    if (!soft) for (const [key, message] of Object.entries(paternityProblems(input.child, input.startDate, input.endDate))) errors[key] ||= message;
  } else if (policy.code === MATERNITY_CODE) {
    if (input.child.event === 'care') input.child = { ...input.child, event: null };
    if (!soft) for (const [key, message] of Object.entries(maternityProblems(input.child, input.startDate, input.endDate, today))) errors[key] ||= message;
  } else if (policy.code === CHILD_CARE_CODE) {
    input.child = { ...input.child, event: 'care', eventDate: null, survivingChildren: null };
    if (!soft) for (const [key, message] of Object.entries(childCareProblems(input.child, input.startDate, today, viewer.role === 'administrator'))) errors[key] ||= message;
  } else input.child = { event: null, eventDate: null, birthDate: null, survivingChildren: null };
  if (policy.afterExhaustedId && !errors.leaveTypeId) {
    const base = await loadPolicy(q, policy.afterExhaustedId);
    if (base && eligibilityProblem(base, emp, input.startDate) === null) {
      const left = await balanceOf(q, targetId, { id: base.id, quota: creditedQuota(base, emp.employmentType, cycleYear, emp.basis, input.startDate, emp.isPwd) }, cycleYear, 0);
      if (left.available > 0) errors.leaveTypeId = `Only after ${base.name} is used up.`;
    }
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

  const rule = await dayRule(q, emp, policy, input.startDate, input.endDate);
  const { days, counted } = countLeaveDays(input.startDate, input.endDate, input.startSession, input.endSession, rule);
  if (days <= 0) throw badRequest('Please correct the highlighted fields.', { startDate: 'No working day falls in these dates.' });
  let compOffPairs: Pair[] = [];
  if (policy.minDays && days < policy.minDays) errors.endDate = `${policy.name} needs at least ${policy.minDays} days in one application.`;
  if (policy.maxConsecutive && days > policy.maxConsecutive) errors.endDate = `${policy.name} can be taken for at most ${policy.maxConsecutive} days at a time.`;
  if (policy.code === PATERNITY_CODE && !soft && input.child.event && input.child.eventDate && !errors.endDate) {
    const [taken] = await rows(q,
      "SELECT COALESCE(SUM(days_count), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND child_event = ? AND child_event_date = ? AND status <> 'rejected' AND id <> ?",
      [targetId, policy.id, input.child.event, input.child.eventDate, exceptId]);
    const tooMany = paternityDaysProblem(Number(taken?.n ?? 0), days);
    if (tooMany) errors.endDate = tooMany;
  }
  if (policy.code === MATERNITY_CODE && !soft && input.child.eventDate && !errors.endDate) {
    if (input.child.event === 'delivery' || input.child.event === 'adoption') {
      const [taken] = await rows(q,
        "SELECT COALESCE(SUM(days_count), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND child_event = ? AND child_event_date = ? AND status <> 'rejected' AND id <> ?",
        [targetId, policy.id, input.child.event, input.child.eventDate, exceptId]);
      const tooMany = maternityDaysProblem(Number(taken?.n ?? 0), days);
      if (tooMany) errors.endDate = tooMany;
    } else if (input.child.event === 'loss') {
      // Abortion / miscarriage: once in the whole service, with a medical certificate.
      const [before] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND child_event = 'loss' AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
      if (Number(before?.n ?? 0) > 0) errors.childEvent = 'Maternity Leave for abortion / miscarriage is given once in the whole service.';
      if (!input.certificate) errors.certificate = 'Upload the medical certificate: it is needed for abortion / miscarriage.';
    }
  }
  if (policy.code === CHILD_CARE_CODE && !soft && !errors.startDate) {
    // At most 3 spells in a calendar year (6 for a single mother).
    const allowed = childCareSpells(input.child.singleParent);
    const [spells] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND YEAR(start_date) = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, Number(input.startDate.slice(0, 4)), exceptId]);
    if (Number(spells?.n ?? 0) >= allowed) errors.startDate = `Child Care Leave can be taken at most ${allowed} times in a calendar year${input.child.singleParent ? ' (single mother)' : ''}.`;
  }
  if ((policy.code === LND_CODE || policy.code === EOL_CODE) && !soft && !errors.purpose) {
    // Leave Not Due (Rule 31) / Extraordinary Leave (Rule 32): see ./specialLeave.
    const permanent = (await layoutOfEmployeeType(q, emp.employmentType)) === 'permanent';
    const months = serviceMonths(emp.joining, input.startDate);
    if (policy.code === LND_CODE) {
      const dayBefore = new Date(`${input.startDate}T00:00:00Z`); dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      const [maternity] = await rows(q,
        `SELECT r.id FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
          WHERE r.user_id = ? AND t.code = ? AND r.child_event IN ('delivery', 'adoption') AND r.end_date = ? AND r.status <> 'rejected' AND r.id <> ? LIMIT 1`,
        [targetId, MATERNITY_CODE, dayBefore.toISOString().slice(0, 10), exceptId]);
      const found = lndProblems({ permanent, serviceMonths: months, ground: input.purpose, hasCertificate: Boolean(input.certificate), followsMaternity: Boolean(maternity) });
      for (const [key, message] of Object.entries(found)) errors[key] ||= message;
    } else {
      // Spells of any leave that touch this one, to join EOL spells with other leave between them.
      const around = await rows(q,
        `SELECT r.start_date, r.end_date, t.code FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
          WHERE r.user_id = ? AND r.status <> 'rejected' AND r.id <> ? AND r.end_date >= DATE_SUB(?, INTERVAL 6 YEAR) AND r.start_date <= DATE_ADD(?, INTERVAL 6 YEAR)`,
        [targetId, exceptId, input.startDate, input.endDate]);
      const spells = continuousEol(
        around.map((a) => ({ start: isoDate(a.start_date), end: isoDate(a.end_date), eol: String(a.code) === EOL_CODE })),
        { start: input.startDate, end: input.endDate, eol: true });
      const found = eolProblems({ permanent, serviceMonths: months, ground: input.purpose, hasCertificate: Boolean(input.certificate), spells });
      for (const [key, message] of Object.entries(found)) errors[key] ||= message;
    }
  }
  if (policy.code === COMP_OFF_CODE) {
    // One worked weekly off / holiday (biometric punches only) pays for each leave day. Within a month of the day worked
    // there is no limit; taken later (up to the end of the next calendar month) at most 2 a calendar month.
    const person = await personById(targetId);
    const credits = person ? (await creditsFor([person], today, exceptId)).get(targetId) ?? [] : [];
    const matched = matchCredits(credits, input.compOffDates, counted);
    if (matched.problem) errors.compOffDates = matched.problem;
    else {
      compOffPairs = matched.pairs;
      const late = matched.pairs.filter((pair) => pair.late).map((pair) => pair.leave);
      const bad = late.length ? monthlyProblem(late, await takenByMonth(targetId, exceptId), LATE_COMP_OFF_PER_MONTH) : null;
      if (bad) errors.compOffDates = bad;
    }
  } else if (input.compOffDates.length) errors.compOffDates = 'Only a compensatory off uses worked days.';
  if (policy.code === RESTRICTED_CODE) {
    // A restricted holiday is one day, chosen from the holidays marked restricted in the Holiday Calendar.
    const [rh] = input.startDate === input.endDate ? await rows(q, "SELECT id FROM holidays WHERE type = 'restricted' AND holiday_date = ? LIMIT 1", [input.startDate]) : [];
    if (!rh) errors.startDate = 'Choose a restricted holiday from the list.';
  }
  // Commuted Leave in continuation of a Maternity Leave for child birth / adoption: up to 60 days without a medical certificate.
  let afterMaternity = false;
  if (policy.code === COMMUTED_CODE && policy.certificateRequired && !input.certificate && !soft) {
    const dayBefore = addDays(input.startDate, -1);
    const [mat] = await rows(q,
      `SELECT r.id FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
        WHERE r.user_id = ? AND t.code = ? AND r.child_event IN ('delivery', 'adoption') AND r.end_date = ? AND r.status <> 'rejected' AND r.id <> ? LIMIT 1`,
      [targetId, MATERNITY_CODE, dayBefore, exceptId]);
    if (mat) {
      afterMaternity = true;
      if (days > COMMUTED_AFTER_MATERNITY_DAYS) errors.endDate = `Without a medical certificate, Commuted Leave after Maternity Leave is at most ${COMMUTED_AFTER_MATERNITY_DAYS} days. Upload a certificate for more.`;
    }
  }
  if (policy.certificateRequired && !input.certificate && !afterMaternity) errors.certificate = `Upload a medical certificate: ${policy.name} needs one.`;
  else if (policy.certDays && days > policy.certDays && !input.certificate) errors.certificate = `Medical certificate needed above ${policy.certDays} days.`;
  if (policy.lifetimeMax) {
    const [taken] = await rows(q, "SELECT COALESCE(SUM(days_count), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
    const before = Number(taken?.n ?? 0);
    if (before + days > policy.lifetimeMax) errors.endDate = `Only ${num(Math.max(0, policy.lifetimeMax - before))} days left in your service.`;
  }
  if (policy.maxSpellsMonth && policy.code !== COMP_OFF_CODE && !errors.endDate) {
    const [monthly] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND DATE_FORMAT(start_date, '%Y-%m') = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, input.startDate.slice(0, 7), exceptId]);
    if (Number(monthly?.n ?? 0) >= policy.maxSpellsMonth) errors.startDate = `At most ${policy.maxSpellsMonth} times a month.`;
  }
  if (policy.maxSpellsLifetime && !errors.endDate && !errors.startDate) {
    const [ever] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
    if (Number(ever?.n ?? 0) >= policy.maxSpellsLifetime) errors.startDate = `At most ${policy.maxSpellsLifetime} times in your service.`;
  }
  if (policy.maxSpells && !errors.endDate) {
    const [spells] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, cycleYear, exceptId]);
    if (Number(spells?.n ?? 0) >= policy.maxSpells) errors.startDate = `${policy.name} can be applied for at most ${policy.maxSpells} times in a leave year.`;
  }
  // A leave type with two steps may need the HoD only for longer leaves (e.g. EL above 2 days).
  const stages: 1 | 2 = policy.stages === 2 && (policy.hodAfterDays <= 0 || days > policy.hodAfterDays) ? 2 : 1;
  if (stages === 2 && !emp.reviewingManagerId) errors.leaveTypeId = 'This employee has no HoD set, which this leave type needs. Ask the administrator.';
  if ((policy.needsContact || input.stationLeave) && !input.contactAddress) errors.contactAddress = 'Enter address and mobile number.';
  if (input.ltcType !== 'none' && !policy.ltcAllowed) errors.ltcType = `LTC and Ex-India are not available with ${policy.name}.`;
  // Weekly offs and gazetted holidays touching the leave can be added to it as a prefix / suffix, for every leave type.
  const wide = await dayRule(q, emp, policy, addDays(input.startDate, -45), addDays(input.endDate, 45));
  const off = (d: string) => !wide.workingDays.includes(weekdayOf(d)) || wide.gazetted.has(d);
  const block = (from: string, to: string): HolidayBlock | null => (from <= to ? { from, to, days: datesBetween(from, to).length } : null);
  let pf = addDays(input.startDate, -1);
  while (pf >= oldestApplicationDate(today) && pf >= addDays(input.startDate, -31) && off(pf)) pf = addDays(pf, -1);
  let prefix = block(addDays(pf, 1), addDays(input.startDate, -1));
  let sf = addDays(input.endDate, 1);
  while (sf <= addDays(input.endDate, 31) && off(sf)) sf = addDays(sf, 1);
  let suffix = block(addDays(input.endDate, 1), addDays(sf, -1));

  // The employee's own leaves straight before / after this one (only weekly offs and holidays in between).
  const around = await rows(q,
    `SELECT r.id, r.leave_type_id, r.start_date, r.end_date, r.days_count, r.child_event, t.name, t.code, t.approval_stages, t.max_consecutive_days, t.off_days_only
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND r.status <> 'rejected' AND r.id <> ? AND r.end_date >= ? AND r.start_date <= ? AND (r.linked_to IS NULL OR r.linked_to <> ?) ORDER BY r.start_date`,
    [targetId, exceptId, addDays(input.startDate, -46), addDays(input.endDate, 46), exceptId]);
  const reach = (from: string, step: 1 | -1) => {
    const gap: string[] = [];
    for (let i = 0, d = from; i < 45; i++, d = addDays(d, step)) {
      const hit = around.find((n) => isoDate(n.start_date) <= d && d <= isoDate(n.end_date));
      if (hit && !hit.off_days_only) return { hit, gap: gap.sort() };
      if (!off(d)) return null; // (a station leave is only weekly offs / holidays: they stay part of the gap)
      gap.push(d);
    }
    return null;
  };
  const joins: JoinedGap[] = [];
  const sides = (policy.offDaysOnly ? [] : [['after', reach(addDays(input.startDate, -1), -1)], ['before', reach(addDays(input.endDate, 1), 1)]]) as ['after' | 'before', ReturnType<typeof reach>][];
  for (const [side, found] of sides) {
    if (!found) continue;
    const other = found.hit;
    const otherStages = Number(other.approval_stages) === 2 ? 2 : 1;
    const range = `${isoDate(other.start_date)} to ${isoDate(other.end_date)}`;
    // Paternity Leave can be joined with any other kind of leave.
    const otherJoinsAny = String(other.code) === PATERNITY_CODE || (String(other.code) === MATERNITY_CODE && String(other.child_event ?? '') !== 'loss');
    if (otherStages !== policy.stages && !joinsAny(policy, input) && !otherJoinsAny) {
      throw new HttpError(409, 'This leave cannot be joined with the leave next to it.', 'COMBINE', {
        startDate: `A ${policy.stages}-stage leave cannot be joined with a ${otherStages}-stage leave.`,
      });
    }
    if (policy.stages === 2 && found.gap.length > 0) {
      joins.push({ requestId: Number(other.id), typeId: Number(other.leave_type_id), typeName: String(other.name), side, from: found.gap[0], to: found.gap[found.gap.length - 1], days: found.gap.length });
      if (side === 'after') prefix = null; else suffix = null; // these days now count with the earlier leave
    }
    const cap = Number(other.max_consecutive_days ?? 0);
    const gapDays = found.gap.length;
    if (policy.stages === 2 && gapDays && cap && Number(other.days_count) + gapDays > cap && !soft) {
      throw new HttpError(409, 'This leave cannot be joined with the leave next to it.', 'COMBINE', { startDate: `Joining it with ${other.name} (${range}) would take that leave beyond ${cap} days.` });
    }
  }
  // A station leave covers weekly offs and gazetted holidays only; all days between the two dates are off, so they are one stretch.
  if (policy.offDaysOnly) { prefix = null; suffix = null; }
  const stationOk = Boolean(prefix) || Boolean(suffix) || datesBetween(input.startDate, input.endDate).some(off);
  if (input.stationLeave && !policy.offDaysOnly && !stationOk) errors.stationLeave = 'Not next to a weekend or holiday.';
  if (policy.offDaysOnly && !datesBetween(input.startDate, input.endDate).every(off)) errors.startDate = 'Only weekly offs and holidays.';
  {
    if (input.prefix) {
      const { from, to } = input.prefix;
      if (!prefix) errors.prefixFrom = 'There are no holidays to add before this leave. Any between it and your earlier leave count with that leave.';
      else if (to >= input.startDate) errors.prefixTo = 'The prefix must end before the leave starts.';
      else if (from < oldestApplicationDate(today)) errors.prefixFrom = TOO_OLD_MESSAGE;
      else if (!datesBetween(from, addDays(input.startDate, -1)).every(off)) errors.prefixFrom = 'Not a continuous weekly off / holiday before the leave.';
      else if (to !== addDays(input.startDate, -1)) errors.prefixTo = 'The prefix must run up to the day before the leave starts.';
    }
    if (input.suffix) {
      const { from, to } = input.suffix;
      if (!suffix) errors.suffixFrom = 'There are no holidays to add after this leave. Any between it and your next leave count with that leave.';
      else if (from <= input.endDate) errors.suffixFrom = 'The suffix must start after the leave ends.';
      else if (!datesBetween(addDays(input.endDate, 1), to).every(off)) errors.suffixTo = 'Not a continuous weekly off / holiday after the leave.';
      else if (from !== addDays(input.endDate, 1)) errors.suffixFrom = 'The suffix must start the day after the leave ends.';
    }
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

  const [clash] = await rows(q,
    "SELECT id, start_date, end_date FROM leave_requests WHERE user_id = ? AND status <> 'rejected' AND id <> ? AND start_date <= ? AND end_date >= ? AND (linked_to IS NULL OR linked_to <> ?) LIMIT 1",
    [targetId, exceptId, input.endDate, input.startDate, exceptId]);
  if (clash) throw new HttpError(409, 'This employee already has a leave on these dates.', 'DUPLICATE', { startDate: `Overlaps another leave (${isoDate(clash.start_date)} to ${isoDate(clash.end_date)}).` });

  const joined = policy.offDaysOnly ? null : await joinProblem(q, emp, policy, input, targetId, exceptId);
  if (joined) throw new HttpError(409, 'This leave cannot be joined with the leave next to it.', 'COMBINE', { startDate: joined });

  const balance = await balanceOf(q, targetId, { id: policy.id, quota: creditedQuota(policy, emp.employmentType, cycleYear, emp.basis, input.startDate, emp.isPwd) }, cycleYear, exceptId);
  // Leave encashment with LTC is taken from the same balance, on top of the leave days, and only from a balance of 30 days or more.
  const extra = input.ltcType === 'ltc' ? input.encashDays : 0;
  if (extra > 0 && !soft) {
    if (!policy.debited) throw badRequest('Please correct the highlighted fields.', { encashDays: `Leave encashment is not available with ${policy.name}.` });
    // CCS rules: at least 30 days must stay after the leave and the encashment; 60 days in the whole service.
    const leftAfter = num(balance.available - days - extra);
    if (leftAfter < LTC_ENCASH_MIN_BALANCE) {
      throw badRequest('Please correct the highlighted fields.', { encashDays: `After this leave and the encashment at least ${LTC_ENCASH_MIN_BALANCE} days must stay in the balance: ${num(Math.max(0, leftAfter))} would stay.` });
    }
    const [enc] = await rows(q, "SELECT COALESCE(SUM(encash_days), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
    const before = Number(enc?.n ?? 0);
    if (before + extra > LTC_ENCASH_LIFETIME) {
      throw badRequest('Please correct the highlighted fields.', { encashDays: `Leave encashment with LTC is at most ${LTC_ENCASH_LIFETIME} days in the whole service: ${num(before)} already taken, ${num(Math.max(0, LTC_ENCASH_LIFETIME - before))} left.` });
    }
  }
  // Days of holidays that now count with an earlier leave of the same type come off the same balance.
  const carry = joins.filter((j) => j.typeId === policy.id).reduce((a, j) => a + j.days, 0);
  if (!soft) {
    for (const j of joins.filter((x) => x.typeId !== policy.id)) {
      const other = await loadPolicy(q, j.typeId);
      if (!other?.debited) continue;
      const left = await balanceOf(q, targetId, { id: other.id, quota: creditedQuota(other, emp.employmentType, cycleYear, emp.basis, input.startDate, emp.isPwd) }, cycleYear, 0);
      if (j.days > left.available) {
        throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { startDate: `The ${j.days} holiday day(s) between this leave and ${other.name} count as ${other.name}: ${Math.max(0, left.available)} available.` });
      }
    }
  }
  if (policy.debitFromId) {
    const base = await loadPolicy(q, policy.debitFromId);
    if (base) {
      const left = await balanceOf(q, targetId, { id: base.id, quota: creditedQuota(base, emp.employmentType, cycleYear, emp.basis, input.startDate, emp.isPwd) }, cycleYear, exceptId);
      const need = num((days + extra + carry) * policy.debitFactor);
      // Leave Not Due is debited to the Half Pay Leave account even when that goes below zero (it is earned back later).
      if (need > left.available && !soft && policy.code !== LND_CODE) {
        throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { endDate: `${policy.name} uses ${policy.debitFactor} day(s) of ${base.name} for each day: ${need} needed, ${Math.max(0, left.available)} available for ${cycleLabel(cycleYear, emp.basis)}.` });
      }
      return { requested, days, cycleYear, policy, emp, balance: left, stages, prefix, suffix, stationOk, joins, compOffPairs };
    }
  }
  if (policy.debited && days + extra + carry > balance.available && !soft) {
    const [next] = await rows(q, "SELECT name FROM leave_types WHERE after_exhausted_type_id = ? AND status = 'active' LIMIT 1", [policy.id]);
    const hint = next ? ` After it is used up, ${next.name} can be applied for.` : '';
    throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { endDate: `${policy.name}: ${days} days asked${extra ? ` + ${extra} days encashment` : ''}${carry ? ` + ${carry} holiday days joined with your earlier leave` : ''}, ${Math.max(0, balance.available)} available for ${cycleLabel(cycleYear, emp.basis)}.${hint}` });
  }
  return { requested, days, cycleYear, policy, emp, balance, stages, prefix, suffix, stationOk, joins, compOffPairs };
}

export const cycleLabel = (year: number, basis: 'CY' | 'FY') => (basis === 'FY' ? `FY ${year}-${String(year + 1).slice(2)}` : `${year}`);

/** What the apply form shows while it is filled: the days and balance the server will use. Never writes. */
export async function previewLeave(viewer: Viewer, query: Record<string, unknown>): Promise<{ days: number; cycleYear: number; cycle: string; balance: Balance | null; error: string | null; prefix: HolidayBlock | null; suffix: HolidayBlock | null; stationOk: boolean; startDate: string; endDate: string; requestedStart: string; requestedEnd: string }> {
  const input = (() => {
    try {
      const encash = Number(query.encashDays);
      const withEncash = query.ltcType === 'ltc' && query.encashLtc === 'true' && Number.isInteger(encash) && encash >= 1 && encash <= LTC_ENCASH_MAX;
      return { ...parseLeaveInput({ ...query, reason: 'preview', stationLeave: false, contactAddress: 'preview', ltcType: withEncash ? 'ltc' : 'none', encashLtc: withEncash, encashDays: encash, availPrefix: false, availSuffix: false }), certificate: true };
    } catch {
      return null;
    }
  })();
  const target = viewer.role === 'administrator' ? Number(input?.userId ?? 0) : viewer.id;
  const none = { startDate: String(query.startDate ?? ''), endDate: String(query.endDate ?? ''), requestedStart: String(query.startDate ?? ''), requestedEnd: String(query.endDate ?? '') };
  if (!input || !target) return { days: 0, cycleYear: 0, cycle: '', balance: null, error: null, prefix: null, suffix: null, stationOk: false, ...none };
  try {
    const exceptId = /^\d{1,20}$/.test(String(query.exceptId ?? '')) ? Number(query.exceptId) : 0; // the leave being edited
    const c = await checkLeave(pool, viewer, input, target, exceptId, undefined, true);
    return { days: c.days, cycleYear: c.cycleYear, cycle: cycleLabel(c.cycleYear, c.emp.basis), balance: c.balance, error: null, prefix: c.prefix, suffix: c.suffix, stationOk: c.stationOk, startDate: input.startDate, endDate: input.endDate, requestedStart: c.requested.startDate, requestedEnd: c.requested.endDate };
  } catch (error) {
    if (error instanceof HttpError) return { days: 0, cycleYear: 0, cycle: '', balance: null, error: Object.values(error.details ?? {})[0] ?? error.message, prefix: null, suffix: null, stationOk: false, ...none };
    throw error;
  }
}

/** The worked weekly offs / holidays that can be taken as a compensatory off now: the dropdown of the apply form. */
export async function compOffOptions(viewer: Viewer, query: Record<string, unknown>, exceptId = 0): Promise<{ credits: Array<{ date: string; in: string; out: string; hours: number; reason: string; validUntil: string }> }> {
  const target = viewer.role === 'administrator' ? Number(query.userId ?? 0) : viewer.role === 'general_staff' ? viewer.id : 0;
  if (!Number.isInteger(target) || target <= 0) return { credits: [] };
  exceptId = /^\d{1,20}$/.test(String(query.exceptId ?? '')) ? Number(query.exceptId) : exceptId;
  const person = await personById(target);
  if (!person) return { credits: [] };
  try {
    const mine = (await creditsFor([person], todayInIndia(), exceptId)).get(target) ?? [];
    return { credits: mine.filter((c) => c.usedBy === null).map(({ date, in: inTime, out, hours, reason, validUntil }) => ({ date, in: inTime, out, hours, reason, validUntil })) };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** The restricted holidays of the Holiday Calendar the employee can still apply for: the dropdown of the Restricted Holiday form. */
export async function restrictedHolidayOptions(viewer: Viewer, query: Record<string, unknown>, today = todayInIndia()): Promise<{ holidays: Array<{ date: string; name: string }> }> {
  const target = viewer.role === 'administrator' ? Number(query.userId ?? 0) : viewer.role === 'general_staff' ? viewer.id : 0;
  if (!Number.isInteger(target) || target <= 0) return { holidays: [] };
  const exceptId = /^\d{1,20}$/.test(String(query.exceptId ?? '')) ? Number(query.exceptId) : 0;
  try {
    const found = await rows(pool,
      `SELECT DATE_FORMAT(h.holiday_date, '%Y-%m-%d') AS d, h.name FROM holidays h
        WHERE h.type = 'restricted' AND h.holiday_date BETWEEN ? AND ?
          AND NOT EXISTS (SELECT 1 FROM leave_requests r WHERE r.user_id = ? AND r.status <> 'rejected' AND r.id <> ? AND r.start_date <= h.holiday_date AND r.end_date >= h.holiday_date)
        ORDER BY h.holiday_date, h.name`,
      [oldestApplicationDate(today), addDays(today, 365), target, exceptId]);
    return { holidays: found.map((h) => ({ date: String(h.d), name: String(h.name) })) };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** The balance shown the moment a leave type is chosen: the employee's balance of that leave type for the leave year of `date` (today by default). */
export async function balancePreview(
  viewer: Viewer, query: Record<string, unknown>, today = todayInIndia(),
): Promise<{ cycle: string; balance: Balance | null }> {
  const typeId = String(query.leaveTypeId ?? '');
  const target = viewer.role === 'administrator' ? Number(query.userId ?? 0) : viewer.id;
  if (!/^\d{1,20}$/.test(typeId) || !target) return { cycle: '', balance: null };
  const date = isValidIsoDate(String(query.date ?? '')) ? String(query.date) : today;
  try {
    const emp = await loadEmployee(pool, target);
    const policy = await loadPolicy(pool, Number(typeId));
    if (!policy || policy.status !== 'active') return { cycle: '', balance: null };
    const cycleYear = cycleYearOf(date, emp.basis);
    const cycle = cycleLabel(cycleYear, emp.basis);
    // A leave debited from another type (commuted leave) shows the balance of that type.
    const base = policy.debitFromId ? await loadPolicy(pool, policy.debitFromId) : null;
    const shown = base ?? policy;
    if (!shown.debited) return { cycle, balance: null };
    return { cycle, balance: await balanceOf(pool, target, { id: shown.id, quota: creditedQuota(shown, emp.employmentType, cycleYear, emp.basis, date, emp.isPwd) }, cycleYear, 0) };
  } catch (error) {
    if (error instanceof HttpError) return { cycle: '', balance: null };
    throw error;
  }
}

/**
 * Dates the apply form's calendar blocks for an employee: days already inside a leave application
 * (or its prefix / suffix), and, for the chosen leave type, the days straight next to a leave of the other
 * stage count (weekly offs / holidays in between and the next working day), which cannot be joined.
 */
export async function occupiedDates(
  viewer: Viewer, query: Record<string, unknown>, today = todayInIndia(),
): Promise<{ days: { date: string; status: 'pending' | 'approved' | 'rejected' }[]; joined: string[]; workdays: string[] }> {
  const empty = { days: [], joined: [], workdays: [] };
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') return empty;
  const target = viewer.role === 'administrator' ? Number(query.userId ?? 0) : viewer.id;
  if (!target) return empty;
  const exceptId = /^\d{1,20}$/.test(String(query.exceptId ?? '')) ? Number(query.exceptId) : 0;
  const from = addDays(today, -60);
  const to = addDays(today, 400);
  let found: RowDataPacket[];
  try {
    found = await rows(pool,
      `SELECT r.start_date, r.end_date, r.status, r.prefix_from, r.prefix_to, r.suffix_from, r.suffix_to, t.approval_stages, t.off_days_only
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
        WHERE r.user_id = ? AND r.id <> ? AND r.end_date >= ? AND r.start_date <= ? AND (r.linked_to IS NULL OR r.linked_to <> ?)`,
      [target, exceptId, from, to, exceptId]);
  } catch (error) {
    missingTable(error);
    throw error;
  }
  const days = new Map<string, 'pending' | 'approved' | 'rejected'>();
  const rank = { rejected: 0, pending: 1, approved: 2 } as const;
  const put = (a: string, b: string, status: 'pending' | 'approved' | 'rejected') => {
    for (const d of datesBetween(a < from ? from : a, b > to ? to : b)) if (!days.has(d) || rank[days.get(d)!] < rank[status]) days.set(d, status);
  };
  for (const r of found) {
    const status = r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending';
    put(isoDate(r.start_date), isoDate(r.end_date), status);
    if (r.prefix_from) put(isoDate(r.prefix_from), isoDate(r.prefix_to), status);
    if (r.suffix_from) put(isoDate(r.suffix_from), isoDate(r.suffix_to), status);
  }
  const joined = new Set<string>();
  const workdays: string[] = [];
  const typeId = String(query.leaveTypeId ?? '');
  if (/^\d{1,20}$/.test(typeId)) {
    const emp = await loadEmployee(pool, target);
    const policy = await loadPolicy(pool, Number(typeId));
    if (policy) {
      const rule = await dayRule(pool, emp, policy, from, to);
      const off = (d: string) => !rule.workingDays.includes(weekdayOf(d)) || rule.gazetted.has(d);
      // A station leave can be chosen on weekly offs and holidays only: the working days are blocked.
      if (policy.offDaysOnly) for (const d of datesBetween(from, to)) if (!off(d)) workdays.push(d);
      for (const r of found) {
        if (policy.offDaysOnly || r.off_days_only || r.status === 'rejected' || (Number(r.approval_stages) === 2 ? 2 : 1) === policy.stages) continue;
        for (const [start, step] of [[addDays(isoDate(r.end_date), 1), 1], [addDays(isoDate(r.start_date), -1), -1]] as const) {
          for (let d = start, i = 0; i < 45 && d >= from && d <= to; i++, d = addDays(d, step)) {
            joined.add(d);
            if (!off(d)) break; // the next working day is the last one blocked
          }
        }
      }
    }
  }
  return { days: [...days.entries()].map(([date, status]) => ({ date, status })).sort((a, b) => a.date.localeCompare(b.date)), joined: [...joined].filter((d) => !days.has(d) || days.get(d) === 'rejected').sort(), workdays };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function fetchOne(conn: { query: typeof pool.query }, id: number, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(conn, `${SELECT} WHERE m.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return row ?? null;
}

/**
 * Straight 2-stage leaves: the weekly offs / holidays between them become leave days of the earlier leave
 * (its dates grow, its prefix / suffix is dropped, the balance follows, and the change is audited).
 */
async function applyJoins(conn: { query: typeof pool.query }, req: Request, viewer: Viewer, joins: JoinedGap[]): Promise<void> {
  for (const j of joins) {
    const row = await fetchOne(conn, j.requestId, true);
    if (!row) continue;
    const before = toRequest(viewer, row);
    if (j.side === 'after') {
      await conn.query('UPDATE leave_requests SET end_date = ?, days_count = days_count + ?, suffix_from = NULL, suffix_to = NULL WHERE id = ?', [j.to, j.days, j.requestId]);
    } else {
      await conn.query('UPDATE leave_requests SET start_date = ?, days_count = days_count + ?, prefix_from = NULL, prefix_to = NULL WHERE id = ?', [j.from, j.days, j.requestId]);
    }
    // The station leave that was applied for these days is no longer needed: they are leave days now.
    const stale = await rows(conn, `${SELECT} WHERE m.linked_to = ? AND m.start_date >= ? AND m.end_date <= ?`, [j.requestId, j.from, j.to]);
    for (const s of stale) {
      const gone = toRequest(viewer, s);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: gone.id, recordLabel: label(gone), action: 'DELETE', before: auditView(gone), reason: 'Counted as leave days of the leave next to it' });
      await conn.query('DELETE FROM leave_requests WHERE id = ?', [Number(gone.id)]);
    }
    const after = toRequest(viewer, (await fetchOne(conn, j.requestId))!);
    await writeMasterAuditSql(conn, req, {
      masterKey: AUDIT_KEY, recordId: j.requestId, recordLabel: label(after), action: 'UPDATE', before: auditView(before), after: auditView(after),
      reason: `Holidays ${j.from} to ${j.to} now count as leave: another ${j.typeName} follows straight on`,
    });
  }
}

/** The station leave of a leave's prefix / suffix: applied for the employee with the same details, linked to the leave. */
async function createLinkedStation(conn: { query: typeof pool.query }, req: Request, viewer: Viewer, parentId: number, targetId: number, input: LeaveInput, c: Checked): Promise<void> {
  const blocks = [input.prefix, input.suffix].filter(Boolean) as { from: string; to: string }[];
  if (!blocks.length) return;
  const [station] = await rows(conn, "SELECT id, approval_stages FROM leave_types WHERE off_days_only = 1 AND status = 'active' ORDER BY id LIMIT 1");
  if (!station) return; // no station leave type is set up
  for (const b of blocks) {
    const [result] = await conn.query(
      `INSERT INTO leave_requests
         (user_id, leave_type_id, start_date, end_date, start_session, end_session, days_count, cycle_year, reason, certificate, station_leave, contact_address, linked_to, stages, status, applied_by, manager_id, reviewer_id)
       VALUES (?, ?, ?, ?, 'full', 'full', ?, ?, ?, 0, 1, ?, ?, ?, 'pending_l1', ?, ?, ?)`,
      [targetId, Number(station.id), b.from, b.to, datesBetween(b.from, b.to).length, c.cycleYear, input.reason, input.contactAddress || null, parentId,
        Number(station.approval_stages) === 2 ? 2 : 1, viewer.id, c.emp.reportingManagerId, c.emp.reviewingManagerId]);
    const id = Number((result as { insertId: number }).insertId);
    const made = toRequest(viewer, (await fetchOne(conn, id))!);
    await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(made), action: 'CREATE', after: auditView(made), reason: `Station leave for the prefix / suffix of leave request ${parentId}` });
  }
}

/** Removes the linked station leaves of a leave request (it was edited or deleted). A decided one stops the change. */
async function dropLinkedStation(conn: { query: typeof pool.query }, req: Request, viewer: Viewer, parentId: number): Promise<void> {
  const linked = await rows(conn, `${SELECT} WHERE m.linked_to = ? FOR UPDATE`, [parentId]);
  if (linked.some((r) => String(r.status) !== 'pending_l1')) {
    throw new HttpError(409, 'The station leave of its prefix / suffix has already been looked at. Ask for that step to be undone first.', 'NOT_PENDING');
  }
  for (const r of linked) {
    const gone = toRequest(viewer, r);
    await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: gone.id, recordLabel: label(gone), action: 'DELETE', before: auditView(gone), reason: `Leave request ${parentId} was changed or deleted` });
    await conn.query('DELETE FROM leave_requests WHERE id = ?', [Number(gone.id)]);
  }
}

/** Replaces the worked days a leave uses (one per leave day). */
async function saveCompOffUses(conn: { query: typeof pool.query }, requestId: number, userId: number, pairs: Pair[]): Promise<void> {
  await conn.query('DELETE FROM leave_comp_off_uses WHERE request_id = ?', [requestId]);
  for (const p of pairs) {
    await conn.query('INSERT INTO leave_comp_off_uses (request_id, user_id, work_date, leave_date) VALUES (?, ?, ?, ?)', [requestId, userId, p.work, p.leave]);
  }
}

/**
 * Child Care Leave details (columns of migrations/20261204_maternity_child_care.sql). Written only for a Child Care Leave,
 * so every other leave works before that migration is run.
 */
async function saveChildCare(conn: { query: typeof pool.query }, id: number, input: LeaveInput, previous: RowDataPacket | null = null): Promise<void> {
  const isCare = input.child.event === 'care';
  if (!isCare && !(previous && previous.child_order !== undefined && previous.child_order !== null)) return;
  try {
    await conn.query('UPDATE leave_requests SET child_order = ?, child_disabled = ?, single_parent = ? WHERE id = ?',
      [isCare ? input.child.childOrder ?? null : null, isCare && input.child.childDisabled ? 1 : 0, isCare && input.child.singleParent ? 1 : 0, id]);
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_BAD_FIELD_ERROR') {
      throw new HttpError(409, 'Child Care Leave needs a database update. Ask the administrator to run migrations/20261204_maternity_child_care.sql.', 'MIGRATION_NEEDED');
    }
    throw error;
  }
}

/** purpose, child_event, child_event_date, child_birth_date, surviving_children (checkLeave has already cleared what does not apply). */
const specialValues = (input: LeaveInput): unknown[] => [
  input.purpose || null, input.child.event, input.child.event ? input.child.eventDate : null, input.child.event ? input.child.birthDate : null, input.child.event ? input.child.survivingChildren : null,
];

export async function createRequest(req: Request, viewer: Viewer, body: unknown): Promise<LeaveRequest> {
  const input = parseLeaveInput(body);
  let targetId: number;
  if (viewer.role === 'administrator') {
    if (!input.userId) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee.' });
    targetId = Number(input.userId);
  } else if (viewer.role === 'general_staff') {
    if (input.userId && Number(input.userId) !== viewer.id) throw forbidden('You can only apply for your own leave.');
    targetId = viewer.id;
  } else {
    throw forbidden('Your current role cannot apply for leave.');
  }
  try {
    const done = await inTransaction(async (conn) => {
      // Serialise one employee's applications so two requests cannot both pass the balance check.
      await rows(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [targetId]);
      const c = await checkLeave(conn, viewer, input, targetId, 0);
      const [result] = await conn.query(
        `INSERT INTO leave_requests
           (user_id, leave_type_id, start_date, end_date, start_session, end_session, days_count, cycle_year, reason, certificate, station_leave, ltc_type, encash_days, contact_address, prefix_from, prefix_to, suffix_from, suffix_to, stages, status, applied_by, manager_id, reviewer_id,
            purpose, child_event, child_event_date, child_birth_date, surviving_children)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_l1', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetId, c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0, input.stationLeave ? 1 : 0,
          input.ltcType, input.encashDays, input.contactAddress || null, input.prefix?.from ?? null, input.prefix?.to ?? null, input.suffix?.from ?? null, input.suffix?.to ?? null,
          c.stages, viewer.id, c.emp.reportingManagerId, c.emp.reviewingManagerId, ...specialValues(input)],
      );
      const id = Number((result as { insertId: number }).insertId);
      await saveChildCare(conn, id, input);
      await saveCompOffUses(conn, id, targetId, c.compOffPairs);
      if (input.file) await saveCertificate(conn, id, input.file, viewer.id);
      await applyJoins(conn, req, viewer, c.joins);
      await createLinkedStation(conn, req, viewer, id, targetId, input, c);
      const created = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(created) });
      return created;
    });
    notifyLeave('applied', done);
    return done;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function updateRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<{ request: LeaveRequest; changed: string[] }> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot edit leave.');
  const input = parseLeaveInput(body);
  try {
    const out = await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || (viewer.role !== 'administrator' && Number(row.user_id) !== viewer.id)) throw notFound('Request not found.');
      if (row.linked_to) throw new HttpError(409, 'This station leave follows its leave request. Change that leave request instead.', 'LINKED');
      const before = toRequest(viewer, row);
      if (before.status !== 'pending_l1') throw new HttpError(409, 'Only a leave that has not been looked at yet can be edited. Ask for the step to be undone first.', 'NOT_PENDING');
      if (!canModify(viewer, row)) throw new HttpError(409, DATE_PASSED_MESSAGE, 'DATE_PASSED');
      if (input.userId && input.userId !== String(row.user_id)) throw badRequest('Please correct the highlighted fields.', { userId: 'The employee of a request cannot be changed.' });
      // A certificate already on file stays unless a new one is uploaded.
      input.certificate = Boolean(input.file) || Boolean(row.certificate);
      await dropLinkedStation(conn, req, viewer, id);
      const c = await checkLeave(conn, viewer, input, Number(row.user_id), id);
      await conn.query(
        `UPDATE leave_requests SET leave_type_id = ?, start_date = ?, end_date = ?, start_session = ?, end_session = ?, days_count = ?, cycle_year = ?,
           reason = ?, certificate = ?, station_leave = ?, ltc_type = ?, encash_days = ?, contact_address = ?, prefix_from = ?, prefix_to = ?, suffix_from = ?, suffix_to = ?, stages = ?, manager_id = ?, reviewer_id = ?,
           purpose = ?, child_event = ?, child_event_date = ?, child_birth_date = ?, surviving_children = ? WHERE id = ?`,
        [c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0, input.stationLeave ? 1 : 0,
          input.ltcType, input.encashDays, input.contactAddress || null, input.prefix?.from ?? null, input.prefix?.to ?? null, input.suffix?.from ?? null, input.suffix?.to ?? null,
          c.stages, c.emp.reportingManagerId, c.emp.reviewingManagerId, ...specialValues(input), id],
      );
      await saveChildCare(conn, id, input, row);
      await saveCompOffUses(conn, id, Number(row.user_id), c.compOffPairs);
      if (input.file) await saveCertificate(conn, id, input.file, viewer.id);
      await applyJoins(conn, req, viewer, c.joins);
      await createLinkedStation(conn, req, viewer, id, Number(row.user_id), input, c);
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      const changed = changedFields(auditView(before), auditView(after));
      if (changed.length) await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'UPDATE', before: auditView(before), after: auditView(after) });
      return { request: after, changed };
    });
    if (out.changed.length) notifyLeave('edited', out.request);
    return out;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function decideRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<{ request: LeaveRequest; outcome: 'approved' | 'forwarded' | 'rejected' }> {
  const v = new Validator(body);
  const action = v.oneOf('action', ['approve', 'reject'] as const);
  const comment = v.optionalString('comment', { max: 500 });
  if (action === 'reject' && (!comment || comment.length < 3)) v.errors.comment ||= 'Say why the request is rejected.';
  v.assert();
  try {
    const done = await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status === 'approved' || before.status === 'rejected') throw new HttpError(409, `This request is already ${before.status}.`, 'NOT_PENDING');
      if (!canDecide(viewer, row)) {
        throw forbidden(Number(row.user_id) === viewer.id ? 'You cannot approve or reject your own request. Ask your reporting manager or an administrator.'
          : before.status === 'pending_l2' ? 'Only the HoD or an administrator can decide this request now.'
          : 'Only the reporting manager or an administrator can decide this request now.');
      }
      const step = decide('two_stage', before.status, action!, { stages: Number(row.stages) === 2 ? 2 : 1, byAdmin: viewer.role === 'administrator' });
      if (!step) throw new HttpError(409, `This request is already ${before.status}.`, 'NOT_PENDING');
      const outcome = step.outcome;
      await moveStatus(conn, 'leave_requests', id, before.status, step.to, outcome === 'forwarded'
        ? { l1_by: viewer.id, l1_at: NOW, l1_comment: comment }
        : { decided_stage: step.stage, action_by: viewer.id, action_at: NOW, manager_comment: comment });
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: comment ? `${outcome === 'forwarded' ? 'Forwarded to HoD' : outcome === 'approved' ? 'Approved' : 'Rejected'}: ${comment}` : outcome === 'forwarded' ? 'Forwarded to HoD' : null,
      });
      return { request: after, outcome };
    });
    notifyLeave(done.outcome, done.request.status === 'pending_l2' ? { ...done.request, actionByName: done.request.forwardedByName } : done.request, comment);
    return done;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Takes a step back: a decision returns to the stage it was taken at; a forward returns to the reporting manager. */
export async function undoDecision(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<LeaveRequest> {
  try {
    const done = await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      assertUndo(undoCheck(viewer, row));
      const to = undoTarget('two_stage', before.status, row.decided_stage === null ? null : Number(row.decided_stage))!;
      const cleared = { decided_stage: null, action_by: null, action_at: null, manager_comment: null };
      await moveStatus(conn, 'leave_requests', id, before.status, to,
        before.status === 'pending_l2' ? { l1_by: null, l1_at: null, l1_comment: null, undo_count: INCREMENT }
          : to === 'pending_l2' ? { ...cleared, undo2_count: INCREMENT }
          : { ...cleared, l1_by: null, l1_at: null, l1_comment: null, undo_count: INCREMENT });
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: reason ? `Step undone: ${reason}` : 'Step undone',
      });
      return after;
    });
    notifyLeave('undone', { ...done, actionByName: null }, reason);
    return done;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function deleteRequest(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<LeaveRequest> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot delete leave.');
  let managers: { managerId: string | number | null; reviewerId: string | number | null } | undefined;
  try {
    const out = await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || (viewer.role !== 'administrator' && Number(row.user_id) !== viewer.id)) throw notFound('Request not found.');
      if (row.linked_to) throw new HttpError(409, 'This station leave follows its leave request. Delete that leave request instead.', 'LINKED');
      const target = toRequest(viewer, row);
      if (target.status !== 'pending_l1') throw new HttpError(409, 'Only a leave that has not been looked at yet can be deleted. Ask for the step to be undone first.', 'NOT_PENDING');
      if (!canModify(viewer, row)) throw new HttpError(409, DATE_PASSED_MESSAGE, 'DATE_PASSED');
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(target), action: 'DELETE', before: auditView(target), reason });
      await dropLinkedStation(conn, req, viewer, id);
      await conn.query('DELETE FROM leave_certificates WHERE request_id = ?', [id]);
      await conn.query('DELETE FROM leave_comp_off_uses WHERE request_id = ?', [id]);
      await conn.query('DELETE FROM leave_requests WHERE id = ?', [id]);
      managers = { managerId: row.manager_id ? Number(row.manager_id) : null, reviewerId: row.reviewer_id ? Number(row.reviewer_id) : null };
      return target;
    });
    notifyLeave('deleted', { ...out, actionByName: null, ...managers! });
    return out;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export function requestId(raw: unknown): number {
  const value = String(raw ?? '').trim();
  if (!/^\d{1,20}$/.test(value)) throw badRequest('Invalid request ID.');
  return Number(value);
}

/** Active employees an administrator can apply for. */
export async function applicableEmployees(viewer: Viewer): Promise<{ id: string; biometricId: string; name: string; designation: string; isPwd: boolean; leaveTypeIds: string[] }[]> {
  if (viewer.role !== 'administrator') return [];
  const found = await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, p.designation, p.profile_data FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE LOWER(u.status) = 'active' AND u.is_system = 0 ORDER BY u.name`);
  const allowed = await applyTypeIds(found.map((r) => Number(r.id)));
  return found.map((r) => ({ id: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), designation: String(r.designation ?? ''), isPwd: profileData(r.profile_data).isPwd === true || profileData(r.profile_data).isPwd === 'true', leaveTypeIds: allowed.get(Number(r.id)) ?? [] }));
}

/**
 * The leave types each of these users may apply for: those of their leave group that also fit their gender
 * (Maternity / Child Care for women, Paternity for men), employee type and disability. Months of service are
 * checked on submit, against the leave's dates.
 */
export async function applyTypeIds(userIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (!userIds.length) return out;
  const policies = (await rows(pool, "SELECT * FROM leave_types WHERE status = 'active'")).map(toPolicy);
  const people = await rows(pool,
    `SELECT u.id, p.employment_type, p.profile_data FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id IN (${userIds.map(() => '?').join(',')})`, userIds);
  const groupMap = await groupLeaveTypeMap(pool);
  for (const r of people) {
    const data = profileData(r.profile_data);
    const groupCode = typeof data.leaveGroup === 'string' ? data.leaveGroup : '';
    const emp = { employmentType: String(r.employment_type ?? ''), gender: String(data.gender ?? ''), joining: null, isPwd: data.isPwd === true || data.isPwd === 'true', groupTypeIds: groupCode ? groupMap.get(groupCode) ?? null : null };
    out.set(Number(r.id), policies.filter((p) => eligibilityProblem(p, emp, todayInIndia()) === null).map((p) => String(p.id)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export interface BalanceRow {
  userId: string; biometricId: string; name: string; designation: string; department: string; employmentType: string; basis: 'CY' | 'FY'; cycle: string; asOn: string;
  balances: Record<string, (Balance & { eligible: boolean }) | null>;
}

/** Balances of the people the viewer may see (self; managers their team; administrator and auditor everyone) for one leave year. */
/** The Leave Balance page: administrators, auditors and Leave Balance Managers. (The dashboard and the apply form read a person's own balance through listBalances.) */
export async function listBalancesPage(viewer: Viewer, yearRaw: unknown): ReturnType<typeof listBalances> {
  if (!canManageBalances(viewer.role) && viewer.role !== 'audit') throw forbidden('Only an administrator, auditor or Leave Balance Manager can see leave balances.');
  return listBalances(viewer, yearRaw);
}

export async function listBalances(viewer: Viewer, yearRaw: unknown): Promise<{ year: number; years: number[]; employeeTypes: Array<{ code: string; name: string }>; types: Array<{ id: string; code: string; name: string; isDebited: boolean }>; rows: BalanceRow[] }> {
  const year = yearRaw === undefined || yearRaw === '' ? Number(todayInIndia().slice(0, 4)) : Number(yearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Choose a year between 2000 and 2100.');
  try {
    const typeRows = await rows(pool, "SELECT * FROM leave_types WHERE status = 'active' ORDER BY name");
    const policies = await attachQuotas(pool, typeRows.map(toPolicy));
    const people = await rows(pool,
      `SELECT u.id, u.biometric_id, u.name, p.designation, p.department, p.employment_type, p.joining_date, p.shift_id, p.profile_data
         FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE LOWER(u.status) = 'active' AND u.is_system = 0 ORDER BY u.name`);
    const visible = people.filter((r) => canSeeBalance(viewer, { ...r, user_id: r.id }));
    // Compensatory off is counted from the days worked on weekly offs / holidays that are still valid today.
    const credits = policies.some((p) => p.code === COMP_OFF_CODE)
      ? await creditsFor(visible.map((r) => ({ userId: Number(r.id), biometricId: String(r.biometric_id), shiftId: r.shift_id ? String(r.shift_id) : null, joining: r.joining_date ? isoDate(r.joining_date) : null })), todayInIndia())
      : new Map();
    const grants = await rows(pool, `SELECT user_id, leave_type_id, total, carry_forward${(await hasAsOfColumn(pool)) ? ", DATE_FORMAT(as_of, '%Y-%m-%d') AS as_of" : ''} FROM leave_balances WHERE cycle_year = ?`, [year]);
    // Leaves before a balance's "as on" date are already in it (asOfFilter).
    const own = await asOfFilter(pool, 'r', 'r.leave_type_id');
    const base = await asOfFilter(pool, 'r', 't.debit_from_type_id');
    const sums = await rows(pool,
      `SELECT r.user_id, r.leave_type_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.days_count + r.encash_days ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN r.days_count + r.encash_days ELSE 0 END), 0) AS pending
         FROM leave_requests r${own.join} WHERE r.cycle_year = ?${own.where} GROUP BY r.user_id, r.leave_type_id`, [year]);
    const linkedRows = await rows(pool,
      `SELECT r.user_id, t.debit_from_type_id AS base_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id${base.join}
        WHERE t.debit_from_type_id IS NOT NULL AND r.cycle_year = ?${base.where} GROUP BY r.user_id, t.debit_from_type_id`, [year]);
    const linkedOf = new Map(linkedRows.map((l) => [`${l.user_id}:${l.base_id}`, l]));
    const groupMap = await groupLeaveTypeMap(pool);
    const today = todayInIndia();
    const grantOf = new Map(grants.map((g) => [`${g.user_id}:${g.leave_type_id}`, g]));
    const sumOf = new Map(sums.map((s) => [`${s.user_id}:${s.leave_type_id}`, s]));
    const out: BalanceRow[] = visible.map((r) => {
      const data = profileData(r.profile_data);
      const basis: 'CY' | 'FY' = data.leaveCycle === 'FY' ? 'FY' : 'CY';
      const groupCode = typeof data.leaveGroup === 'string' ? data.leaveGroup : '';
      const emp = { employmentType: String(r.employment_type ?? ''), gender: String(data.gender ?? ''), joining: r.joining_date ? isoDate(r.joining_date) : null, isPwd: data.isPwd === true || data.isPwd === 'true', groupTypeIds: groupCode ? groupMap.get(groupCode) ?? null : null };
      const balances: BalanceRow['balances'] = {};
      for (const p of policies) {
        const eligible = eligibilityProblem(p, emp, `${year}-12-31`) === null;
        const g = grantOf.get(`${r.id}:${p.id}`), s = sumOf.get(`${r.id}:${p.id}`);
        if (!eligible && !g && !s) { balances[String(p.id)] = null; continue; }
        if (p.code === COMP_OFF_CODE) { balances[String(p.id)] = { ...balanceFromCredits(credits.get(Number(r.id)) ?? []), eligible }; continue; }
        const asOf = balanceAsOn(year, basis, today);
        const total = g ? Number(g.total) : creditedQuota(p, emp.employmentType, year, basis, asOf, emp.isPwd), carryForward = g ? Number(g.carry_forward) : 0;
        const l = linkedOf.get(`${r.id}:${p.id}`);
        const used = Number(s?.used ?? 0) + Number(l?.used ?? 0), pending = Number(s?.pending ?? 0) + Number(l?.pending ?? 0);
        balances[String(p.id)] = { total, carryForward, used: num(used), pending: num(pending), available: num(total + carryForward - used - pending), eligible, asOf: g?.as_of ? String(g.as_of) : null };
      }
      return { userId: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), designation: String(r.designation ?? ''), department: String(r.department ?? ''), employmentType: String(r.employment_type ?? ''), basis, cycle: cycleLabel(year, basis), asOn: balanceAsOn(year, basis, today), balances };
    });
    const found = await rows(pool, 'SELECT cycle_year AS y FROM leave_balances UNION SELECT cycle_year AS y FROM leave_requests');
    const years = [...new Set([...found.map((f) => Number(f.y)), Number(today.slice(0, 4)), year])].sort((a, b) => b - a);
    const employeeTypes = (await rows(pool, "SELECT code, name FROM lookup_values WHERE lookup_type = 'employee_type' ORDER BY name")).map((t) => ({ code: String(t.code), name: String(t.name) }));
    return { year, years, employeeTypes, types: policies.map((p) => ({ id: String(p.id), code: p.code, name: p.name, isDebited: p.debited })), rows: out };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export interface HistoryYear {
  year: number; cycleType: 'CY' | 'FY'; cycle: string; asOn: string;
  types: Array<{ code: string; name: string; isDebited: boolean; total: number; carryForward: number; used: number; pending: number; available: number }>;
}

/** Every leave year of one employee: the days granted and what was taken, year by year and leave type by leave type. */
export async function leaveHistory(viewer: Viewer, userIdRaw: unknown): Promise<{ employee: { id: string; name: string; biometricId: string }; years: HistoryYear[] }> {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) throw badRequest('Choose an employee.');
  try {
    const [person] = await rows(pool,
      `SELECT u.id, u.biometric_id, u.name, p.employment_type, p.joining_date, p.profile_data
         FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
    if (!person || !canSeeBalance(viewer, { ...person, user_id: person.id })) throw notFound('Employee not found.');
    const data = profileData(person.profile_data);
    const basis: 'CY' | 'FY' = data.leaveCycle === 'FY' ? 'FY' : 'CY';
    const policies = await attachQuotas(pool, (await rows(pool, 'SELECT * FROM leave_types ORDER BY name')).map(toPolicy));
    const grants = await rows(pool, 'SELECT cycle_year, cycle_type, leave_type_id, total, carry_forward FROM leave_balances WHERE user_id = ?', [userId]);
    const own = await asOfFilter(pool, 'r', 'r.leave_type_id');
    const base = await asOfFilter(pool, 'r', 't.debit_from_type_id');
    const sums = await rows(pool,
      `SELECT r.cycle_year, r.leave_type_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.days_count + r.encash_days ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN r.days_count + r.encash_days ELSE 0 END), 0) AS pending
         FROM leave_requests r${own.join} WHERE r.user_id = ?${own.where} GROUP BY r.cycle_year, r.leave_type_id`, [userId]);
    const linked = await rows(pool,
      `SELECT r.cycle_year, t.debit_from_type_id AS base_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id${base.join}
        WHERE r.user_id = ? AND t.debit_from_type_id IS NOT NULL${base.where} GROUP BY r.cycle_year, t.debit_from_type_id`, [userId]);
    const emp = { employmentType: String(person.employment_type ?? ''), isPwd: data.isPwd === true || data.isPwd === 'true' };
    const today = todayInIndia();
    const yearsSeen = [...new Set([...grants, ...sums, ...linked].map((r) => Number(r.cycle_year)))].sort((a, b) => b - a);
    const years: HistoryYear[] = yearsSeen.map((year) => {
      const cycleType: 'CY' | 'FY' = grants.find((g) => Number(g.cycle_year) === year)?.cycle_type === 'FY' ? 'FY' : grants.find((g) => Number(g.cycle_year) === year) ? 'CY' : basis;
      const asOf = balanceAsOn(year, cycleType, today);
      const list: HistoryYear['types'] = [];
      for (const p of policies) {
        const g = grants.find((x) => Number(x.cycle_year) === year && Number(x.leave_type_id) === p.id);
        const s = sums.find((x) => Number(x.cycle_year) === year && Number(x.leave_type_id) === p.id);
        const l = linked.find((x) => Number(x.cycle_year) === year && Number(x.base_id) === p.id);
        if (!g && !s && !l) continue;
        const total = g ? Number(g.total) : p.debited ? creditedQuota(p, emp.employmentType, year, cycleType, asOf, emp.isPwd) : 0;
        const carryForward = g ? Number(g.carry_forward) : 0;
        const used = num(Number(s?.used ?? 0) + Number(l?.used ?? 0)), pending = num(Number(s?.pending ?? 0) + Number(l?.pending ?? 0));
        list.push({ code: p.code, name: p.name, isDebited: p.debited, total, carryForward, used, pending, available: num(total + carryForward - used - pending) });
      }
      return { year, cycleType, cycle: cycleLabel(year, cycleType), asOn: asOf, types: list };
    });
    return { employee: { id: String(person.id), name: String(person.name), biometricId: String(person.biometric_id) }, years };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Administrator sets the days granted (and carried forward) for one employee, leave type and year. */
export async function setBalance(req: Request, viewer: Viewer, body: unknown): Promise<Balance> {
  if (!canManageBalances(viewer.role)) throw forbidden('Only an administrator or Leave Balance Manager can change leave balances.');
  const v = new Validator(body);
  const userId = v.string('userId', { pattern: /^\d{1,20}$/, patternMessage: 'Choose an employee.' });
  const leaveTypeId = v.string('leaveTypeId', { pattern: /^\d{1,20}$/, patternMessage: 'Choose a leave type.' });
  const year = v.int('year', { min: 2000, max: 2100 });
  const half = (field: string, max: number) => {
    const n = Number(v.raw(field) ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > max || Math.round(n * 2) !== n * 2) v.errors[field] ||= `Enter days from 0 to ${max}, in steps of 0.5.`;
    return n;
  };
  const total = half('total', 400);
  const carryForward = half('carryForward', 1000);
  const reason = v.optionalString('reason', { max: 500 });
  // The balance is "as on" this date (default today): leaves before it are already in it and are not deducted again.
  const asOfRaw = v.optionalString('asOf', { max: 10 });
  if (asOfRaw && !/^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)) v.errors.asOf ||= 'Enter the date as YYYY-MM-DD.';
  v.assert();
  try {
    return await inTransaction(async (conn) => {
      const emp = await loadEmployee(conn, Number(userId));
      const policy = await loadPolicy(conn, Number(leaveTypeId));
      if (!policy) throw badRequest('Please correct the highlighted fields.', { leaveTypeId: 'Choose a leave type from the list.' });
      await rows(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [emp.id]);
      const quotaPolicy = { id: policy.id, quota: creditedQuota(policy, emp.employmentType, year!, emp.basis, todayInIndia(), emp.isPwd) };
      const before = await balanceOf(conn, emp.id, quotaPolicy, year!);
      const asOf = balanceAsOn(year!, emp.basis, asOfRaw || todayInIndia());
      await writeGrant(conn, { userId: emp.id, typeId: policy.id, year: year!, total, carryForward, basis: emp.basis, asOf });
      const after = await balanceOf(conn, emp.id, quotaPolicy, year!);
      if (after.available < 0) {
        throw badRequest('Please correct the highlighted fields.', { total: `Leaves from ${asOf} on already use or wait for ${num(after.used + after.pending)} days; the balance cannot be lower.` });
      }
      const [who] = await rows(conn, 'SELECT name, biometric_id FROM users WHERE id = ?', [emp.id]);
      const view = (b: Balance) => ({ total: b.total, carryForward: b.carryForward, asOn: b.asOf ?? null, available: b.available });
      await writeMasterAuditSql(conn, req, {
        masterKey: BALANCE_KEY, recordId: `${emp.id}:${policy.id}:${year}`, recordLabel: `${who?.name} (${who?.biometric_id}) · ${policy.code} · ${year}`,
        action: 'UPDATE', before: view(before), after: view(after), reason,
      });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Days of leave (taken or waiting) of one type and leave year from `asOf` on, including leaves debited to it. */
export async function daysFrom(q: { query: typeof pool.query }, userId: number, typeId: number, year: number, asOf: string): Promise<number> {
  const [own] = await rows(q,
    `SELECT COALESCE(SUM(days_count + encash_days), 0) AS n FROM leave_requests
      WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND start_date >= ? AND status IN ('approved', 'pending_l1', 'pending_l2')`, [userId, typeId, year, asOf]);
  const [linked] = await rows(q,
    `SELECT COALESCE(SUM((r.days_count + r.encash_days) * t.debit_factor), 0) AS n FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND t.debit_from_type_id = ? AND r.cycle_year = ? AND r.start_date >= ? AND r.status IN ('approved', 'pending_l1', 'pending_l2')`, [userId, typeId, year, asOf]);
  return num(Number(own?.n ?? 0) + Number(linked?.n ?? 0));
}

/**
 * Writes a balance. `asOf` set: the balance is as on that date (leaves before it are not deducted again);
 * undefined: the date already stored stays (adding / deducting days).
 */
export async function writeGrant(
  conn: { query: typeof pool.query },
  g: { userId: number; typeId: number; year: number; total: number; carryForward: number; basis: 'CY' | 'FY'; asOf?: string },
): Promise<void> {
  if (g.asOf !== undefined && (await hasAsOfColumn(conn))) {
    await conn.query(
      `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type, as_of) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total = VALUES(total), carry_forward = VALUES(carry_forward), cycle_type = VALUES(cycle_type), as_of = VALUES(as_of)`,
      [g.userId, g.typeId, g.year, g.total, g.carryForward, g.basis, g.asOf]);
    return;
  }
  await conn.query(
    `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total = VALUES(total), carry_forward = VALUES(carry_forward), cycle_type = VALUES(cycle_type)`,
    [g.userId, g.typeId, g.year, g.total, g.carryForward, g.basis]);
}

// ---------------------------------------------------------------------------
// For the Attendance page
// ---------------------------------------------------------------------------

/** Approved leave: user id → date → leave type code and whether the day is only half covered. A missing table means none. */
export async function approvedLeaveDays(from: string, to: string, onlyUserId: string | null = null): Promise<Map<string, Map<string, { code: string; half: boolean }>>> {
  const out = new Map<string, Map<string, { code: string; half: boolean }>>();
  try {
    const found = await rows(pool,
      `SELECT m.user_id, DATE_FORMAT(m.start_date, '%Y-%m-%d') AS s, DATE_FORMAT(m.end_date, '%Y-%m-%d') AS e, m.start_session, m.end_session, t.code
         FROM leave_requests m JOIN leave_types t ON t.id = m.leave_type_id
        WHERE m.status = 'approved' AND m.start_date <= ? AND m.end_date >= ?${onlyUserId ? ' AND m.user_id = ?' : ''}`,
      [to, from, ...(onlyUserId ? [onlyUserId] : [])]);
    for (const r of found) {
      const byDate = out.get(String(r.user_id)) ?? new Map();
      let cursor = String(r.s) < from ? from : String(r.s);
      const last = String(r.e) > to ? to : String(r.e);
      for (let i = 0; i < 400 && cursor <= last; i++, cursor = addDays(cursor, 1)) {
        const half = (cursor === String(r.s) && String(r.start_session) === 'second_half') || (cursor === String(r.e) && String(r.end_session) === 'first_half');
        byDate.set(cursor, { code: String(r.code), half });
      }
      out.set(String(r.user_id), byDate);
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

/** Dates in the range on which the employee is on approved leave. */
export async function leaveDates(userId: string, from: string, to: string): Promise<Set<string>> {
  return new Set((await approvedLeaveDays(from, to, userId)).get(userId)?.keys() ?? []);
}

/** The certificate of a request, for whoever may see the request. */
export async function certificateOf(viewer: Viewer, id: number): Promise<{ name: string; mime: string; data: Buffer }> {
  try {
    const row = await fetchOne(pool, id);
    if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
    const file = await loadCertificate(pool, id);
    if (!file) throw notFound('No medical certificate is attached to this request.');
    return file;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}
