import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { loadCertificate, parseCertificate, saveCertificate, type CertificateFile } from './certificates';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { MAX_BACKDATE_DAYS, TOO_OLD_MESSAGE, Validator, isValidIsoDate, oldestApplicationDate, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { RoleId } from '../lib/roles';
import type { ActivityScope } from '../employees/activity';
import { WEEK_DAYS, datesBetween, weekdayOf } from '../attendance/compute';
import { groupLeaveTypeIds, groupLeaveTypeMap } from './groups';
import { LOOK_DAYS, type Combine, type Neighbour, combineProblem, toCombine } from './combine';
import { SESSIONS_END, SESSIONS_START, countLeaveDays, cycleYearOf } from './days';

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
/** Leave encashment with LTC needs at least this many days of balance. */
export const LTC_ENCASH_MIN_BALANCE = 30;
export const MAX_RANGE_DAYS = 400;

export const LEAVE_SCOPE: ActivityScope = {
  keys: ['leave_request', 'leave_balance', 'leave_joining', 'leave_export'],
  areaLabels: { leave_request: 'Leave request', leave_balance: 'Leave balance', leave_joining: 'Joining report', leave_export: 'Log download' },
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
  joiningState: 'none' | 'due' | 'filed';
  joiningStatus: string | null;
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
         t.name AS type_name, t.code AS type_code, t.joining_required, t.approval_stages AS type_stages, (SELECT c.file_name FROM leave_certificates c WHERE c.request_id = m.id) AS certificate_name,
         ab.name AS applied_by_name, mg.name AS manager_name, rv.name AS reviewer_name, l1.name AS l1_name, ac.name AS action_by_name
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
  if (viewer.role === 'administrator' || viewer.role === 'audit') return true;
  if (Number(row.user_id) === viewer.id) return true;
  if (viewer.role !== 'reporting_manager' && viewer.role !== 'reviewing_manager') return false;
  const m = managersOf(row);
  return m.reporting === String(viewer.id) || m.reviewing === String(viewer.id);
}

const isDecided = (row: RowDataPacket) => ['approved', 'rejected'].includes(String(row.status));

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

function canUndo(viewer: Viewer, row: RowDataPacket): boolean {
  const status = String(row.status);
  if (status === 'pending_l1') return false;
  if (viewer.role === 'administrator') return true;
  const m = managersOf(row);
  if (viewer.role === 'reporting_manager' && m.reporting === String(viewer.id)) {
    return Number(row.undo_count ?? 0) < 1 && (isDecided(row) && Number(row.decided_stage) === 1 && Number(row.action_by) === viewer.id)
      || (status === 'pending_l2' && Number(row.l1_by) === viewer.id);
  }
  if (viewer.role === 'reviewing_manager' && m.reviewing === String(viewer.id)) {
    return Number(row.undo2_count ?? 0) < 1 && isDecided(row) && Number(row.decided_stage) === 2 && Number(row.action_by) === viewer.id;
  }
  return false;
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
    joiningState: 'none',
    joiningStatus: null,
  };
}

function auditView(r: LeaveRequest): Record<string, unknown> {
  return {
    employee: `${r.name} (${r.biometricId})`, leaveType: `${r.leaveTypeName} (${r.leaveTypeCode})`, startDate: r.startDate, endDate: r.endDate,
    startSession: r.startSession, endSession: r.endSession, days: r.daysCount, reason: r.reason, certificate: r.certificateName ?? (r.certificate ? 'Yes' : 'No'), stationPermission: r.stationLeave ? 'Required' : 'Not required', ltc: r.ltcType, encashDays: r.encashDays, contactAddress: r.contactAddress, prefix: r.prefixFrom ? `${r.prefixFrom} to ${r.prefixTo}` : null, suffix: r.suffixFrom ? `${r.suffixFrom} to ${r.suffixTo}` : null, status: r.status,
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

export function parseRange(query: { from?: unknown; to?: unknown }, today = todayInIndia()): { from: string; to: string } {
  const from = String(query.from ?? addDays(today, -90));
  const to = String(query.to ?? addDays(today, 90));
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Dates must be in YYYY-MM-DD format.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

export async function listRequests(viewer: Viewer, query: { from?: unknown; to?: unknown }): Promise<{ from: string; to: string; requests: LeaveRequest[] }> {
  const { from, to } = parseRange(query);
  let found: RowDataPacket[];
  try {
    found = await rows(pool, `${SELECT} WHERE m.start_date <= ? AND m.end_date >= ? ORDER BY m.start_date DESC, m.id DESC`, [to, from]);
  } catch (error) {
    missingTable(error);
    throw error;
  }
  const requests = found.filter((row) => canSee(viewer, row)).map((row) => toRequest(viewer, row));
  await markJoining(found, requests);
  return { from, to, requests };
}

/** Which leaves need a joining report now, and which already have one. Never breaks the list (e.g. before the migration is run). */
async function markJoining(found: RowDataPacket[], requests: LeaveRequest[]): Promise<void> {
  const today = todayInIndia();
  const needs = found.filter((r) => (Number(r.joining_required) === 1 || Number(r.type_stages) === 2) && String(r.status) !== 'rejected' && !r.linked_to && isoDate(r.end_date) < today);
  if (!needs.length) return;
  try {
    const filed = new Map((await rows(pool, `SELECT request_id, status FROM leave_joining_reports WHERE request_id IN (${needs.map(() => '?').join(',')})`, needs.map((r) => Number(r.id)))).map((r) => [Number(r.request_id), String(r.status)]));
    for (const row of needs) {
      const target = requests.find((r) => r.id === String(row.id));
      if (!target) continue;
      if (filed.has(Number(row.id))) { target.joiningState = 'filed'; target.joiningStatus = filed.get(Number(row.id)) ?? null; continue; }
      if (await joiningDateOf(pool, row) <= today) target.joiningState = 'due';
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE' && !(error instanceof HttpError)) throw error;
  }
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

export function creditedQuota(policy: Pick<Policy, 'quota' | 'quotas' | 'pwdQuota' | 'accrual'>, employmentType: string, cycleYear: number, basis: 'CY' | 'FY', asOf: string, isPwd = false): number {
  const yearly = quotaFor(policy, employmentType, isPwd);
  if (policy.accrual !== 'half_yearly') return yearly;
  const start = basis === 'FY' ? 4 : 1;
  const elapsed = (Number(asOf.slice(0, 4)) - cycleYear) * 12 + Number(asOf.slice(5, 7)) - start;
  return num(elapsed >= 6 ? yearly : yearly / 2);
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
  if (policy.gender === 'female_only' && emp.gender.toLowerCase() !== 'female') return `${policy.name} is for female employees only.`;
  if (policy.gender === 'male_only' && emp.gender.toLowerCase() !== 'male') return `${policy.name} is for male employees only.`;
  if (policy.minServiceMonths && emp.joining && monthsBetween(emp.joining, onDate) < policy.minServiceMonths) return `${policy.name} needs at least ${policy.minServiceMonths} months of service.`;
  return null;
}

export interface Balance { total: number; carryForward: number; used: number; pending: number; available: number }

export async function balanceOf(
  q: { query: typeof pool.query }, userId: number, policy: Pick<Policy, 'id' | 'quota'>, cycleYear: number, exceptRequestId = 0,
): Promise<Balance> {
  const [grant] = await rows(q, 'SELECT total, carry_forward FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? LIMIT 1', [userId, policy.id, cycleYear]);
  const [sums] = await rows(q,
    `SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count + encash_days ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count + encash_days ELSE 0 END), 0) AS pending
       FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND id <> ?`, [userId, policy.id, cycleYear, exceptRequestId]);
  const total = grant ? Number(grant.total) : policy.quota;
  const carryForward = grant ? Number(grant.carry_forward) : 0;
  // Leave types that are debited from this one (commuted leave takes a multiple of its days from half pay leave).
  const [linked] = await rows(q,
    `SELECT COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND t.debit_from_type_id = ? AND r.cycle_year = ? AND r.id <> ?`, [userId, policy.id, cycleYear, exceptRequestId]);
  const used = Number(sums?.used ?? 0) + Number(linked?.used ?? 0), pending = Number(sums?.pending ?? 0) + Number(linked?.pending ?? 0);
  return { total, carryForward, used: num(used), pending: num(pending), available: num(total + carryForward - used - pending) };
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
  return { userId, leaveTypeId, startDate: startDate!, endDate: endDate!, startSession, endSession, reason: reason.replace(/\s+/g, ' '), certificate: Boolean(file), stationLeave: raw.stationLeave === true, ltcType, encashDays, contactAddress, prefix, suffix, file };
}

/** Looks at the employee's other leaves around the new one: see ./combine. */
async function joinProblem(q: { query: typeof pool.query }, emp: Employee, policy: Policy, input: LeaveInput, targetId: number, exceptId: number): Promise<string | null> {
  const from = addDays(input.startDate, -LOOK_DAYS);
  const to = addDays(input.endDate, LOOK_DAYS);
  const found = await rows(q,
    `SELECT r.leave_type_id, r.start_date, r.end_date, t.name, t.approval_stages, t.combine_with FROM leave_requests r
       JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND r.status <> 'rejected' AND r.id <> ? AND r.end_date >= ? AND r.start_date <= ? AND (r.linked_to IS NULL OR r.linked_to <> ?)`,
    [targetId, exceptId, from, to, exceptId]);
  if (!found.length) return null;
  const others: Neighbour[] = found.map((r) => ({
    id: Number(r.leave_type_id), name: String(r.name), stages: Number(r.approval_stages) === 2 ? 2 : 1, combineWith: toCombine(r.combine_with), start: isoDate(r.start_date), end: isoDate(r.end_date),
  }));
  const { punchDates } = await import('../attendance/store'); // loaded here: the attendance module itself imports this one
  const [rule, worked] = await Promise.all([dayRule(q, emp, policy, from, to), punchDates(emp.biometricId, from, to)]);
  return combineProblem({ id: policy.id, name: policy.name, stages: policy.stages, combineWith: policy.combineWith }, input.startDate, input.endDate, others, rule.workingDays, rule.gazetted, worked);
}

export interface HolidayBlock { from: string; to: string; days: number }
/** Weekly offs / holidays between two straight 2-stage leaves: they become leave days of the earlier leave. */
export interface JoinedGap { requestId: number; typeId: number; typeName: string; side: 'after' | 'before'; from: string; to: string; days: number }
export interface Checked { requested: { startDate: string; endDate: string }; days: number; cycleYear: number; policy: Policy; emp: Employee; balance: Balance; stages: 1 | 2; prefix: HolidayBlock | null; suffix: HolidayBlock | null; stationOk: boolean; joins: JoinedGap[] }

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
  const requested = { startDate: input.startDate, endDate: input.endDate };
  if (!policy.offDaysOnly) {
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
  if (cycleYearOf(input.endDate, emp.basis) !== cycleYear) errors.endDate ||= 'A leave cannot run across two leave years. Apply separately for each year.';
  if (daysBetween(input.startDate, input.endDate) > 366) errors.endDate ||= 'A leave can cover at most one year.';
  if ((input.startSession !== 'full' || input.endSession !== 'full') && !policy.halfDay) errors.startSession = `${policy.name} cannot be taken as a half day.`;
  if (policy.afterExhaustedId && !errors.leaveTypeId) {
    const base = await loadPolicy(q, policy.afterExhaustedId);
    if (base && eligibilityProblem(base, emp, input.startDate) === null) {
      const left = await balanceOf(q, targetId, { id: base.id, quota: creditedQuota(base, emp.employmentType, cycleYear, emp.basis, input.startDate, emp.isPwd) }, cycleYear, 0);
      if (left.available > 0) errors.leaveTypeId = `Only after ${base.name} is used up.`;
    }
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

  const rule = await dayRule(q, emp, policy, input.startDate, input.endDate);
  const { days } = countLeaveDays(input.startDate, input.endDate, input.startSession, input.endSession, rule);
  if (days <= 0) throw badRequest('Please correct the highlighted fields.', { startDate: 'No working day falls in these dates.' });
  if (policy.minDays && days < policy.minDays) errors.endDate = `${policy.name} needs at least ${policy.minDays} days in one application.`;
  if (policy.maxConsecutive && days > policy.maxConsecutive) errors.endDate = `${policy.name} can be taken for at most ${policy.maxConsecutive} days at a time.`;
  if (policy.certificateRequired && !input.certificate) errors.certificate = `Upload a medical certificate: ${policy.name} needs one.`;
  else if (policy.certDays && days > policy.certDays && !input.certificate) errors.certificate = `Medical certificate needed above ${policy.certDays} days.`;
  if (policy.lifetimeMax) {
    const [taken] = await rows(q, "SELECT COALESCE(SUM(days_count), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
    const before = Number(taken?.n ?? 0);
    if (before + days > policy.lifetimeMax) errors.endDate = `Only ${num(Math.max(0, policy.lifetimeMax - before))} days left in your service.`;
  }
  if (policy.maxSpellsMonth && !errors.endDate) {
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
    `SELECT r.id, r.leave_type_id, r.start_date, r.end_date, r.days_count, t.name, t.approval_stages, t.max_consecutive_days, t.off_days_only
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
    if (otherStages !== policy.stages) {
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
    if (balance.available < LTC_ENCASH_MIN_BALANCE) {
      throw badRequest('Please correct the highlighted fields.', { encashDays: `Leave encashment needs a balance of at least ${LTC_ENCASH_MIN_BALANCE} days. ${num(Math.max(0, balance.available))} available.` });
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
      if (need > left.available && !soft) {
        throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { endDate: `${policy.name} uses ${policy.debitFactor} day(s) of ${base.name} for each day: ${need} needed, ${Math.max(0, left.available)} available for ${cycleLabel(cycleYear, emp.basis)}.` });
      }
      return { requested, days, cycleYear, policy, emp, balance: left, stages, prefix, suffix, stationOk, joins };
    }
  }
  if (policy.debited && days + extra + carry > balance.available && !soft) {
    const [next] = await rows(q, "SELECT name FROM leave_types WHERE after_exhausted_type_id = ? AND status = 'active' LIMIT 1", [policy.id]);
    const hint = next ? ` After it is used up, ${next.name} can be applied for.` : '';
    throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { endDate: `${policy.name}: ${days} days asked${extra ? ` + ${extra} days encashment` : ''}${carry ? ` + ${carry} holiday days joined with your earlier leave` : ''}, ${Math.max(0, balance.available)} available for ${cycleLabel(cycleYear, emp.basis)}.${hint}` });
  }
  return { requested, days, cycleYear, policy, emp, balance, stages, prefix, suffix, stationOk, joins };
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
    return await inTransaction(async (conn) => {
      // Serialise one employee's applications so two requests cannot both pass the balance check.
      await rows(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [targetId]);
      const c = await checkLeave(conn, viewer, input, targetId, 0);
      const [result] = await conn.query(
        `INSERT INTO leave_requests
           (user_id, leave_type_id, start_date, end_date, start_session, end_session, days_count, cycle_year, reason, certificate, station_leave, ltc_type, encash_days, contact_address, prefix_from, prefix_to, suffix_from, suffix_to, stages, status, applied_by, manager_id, reviewer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_l1', ?, ?, ?)`,
        [targetId, c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0, input.stationLeave ? 1 : 0,
          input.ltcType, input.encashDays, input.contactAddress || null, input.prefix?.from ?? null, input.prefix?.to ?? null, input.suffix?.from ?? null, input.suffix?.to ?? null,
          c.stages, viewer.id, c.emp.reportingManagerId, c.emp.reviewingManagerId],
      );
      const id = Number((result as { insertId: number }).insertId);
      if (input.file) await saveCertificate(conn, id, input.file, viewer.id);
      await applyJoins(conn, req, viewer, c.joins);
      await createLinkedStation(conn, req, viewer, id, targetId, input, c);
      const created = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(created) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function updateRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<{ request: LeaveRequest; changed: string[] }> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot edit leave.');
  const input = parseLeaveInput(body);
  try {
    return await inTransaction(async (conn) => {
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
           reason = ?, certificate = ?, station_leave = ?, ltc_type = ?, encash_days = ?, contact_address = ?, prefix_from = ?, prefix_to = ?, suffix_from = ?, suffix_to = ?, stages = ?, manager_id = ?, reviewer_id = ? WHERE id = ?`,
        [c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0, input.stationLeave ? 1 : 0,
          input.ltcType, input.encashDays, input.contactAddress || null, input.prefix?.from ?? null, input.prefix?.to ?? null, input.suffix?.from ?? null, input.suffix?.to ?? null,
          c.stages, c.emp.reportingManagerId, c.emp.reviewingManagerId, id],
      );
      if (input.file) await saveCertificate(conn, id, input.file, viewer.id);
      await applyJoins(conn, req, viewer, c.joins);
      await createLinkedStation(conn, req, viewer, id, Number(row.user_id), input, c);
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      const changed = changedFields(auditView(before), auditView(after));
      if (changed.length) await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'UPDATE', before: auditView(before), after: auditView(after) });
      return { request: after, changed };
    });
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
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status === 'approved' || before.status === 'rejected') throw new HttpError(409, `This request is already ${before.status}.`, 'NOT_PENDING');
      if (!canDecide(viewer, row)) {
        throw forbidden(Number(row.user_id) === viewer.id ? 'You cannot approve or reject your own request. Ask your reporting manager or an administrator.'
          : before.status === 'pending_l2' ? 'Only the HoD or an administrator can decide this request now.'
          : 'Only the reporting manager or an administrator can decide this request now.');
      }
      const stage = before.status === 'pending_l2' ? 2 : 1;
      let outcome: 'approved' | 'forwarded' | 'rejected';
      if (action === 'reject') {
        outcome = 'rejected';
        await conn.query("UPDATE leave_requests SET status = 'rejected', decided_stage = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?", [stage, viewer.id, comment, id]);
      } else if (stage === 1 && Number(row.stages) === 2 && viewer.role !== 'administrator') {
        outcome = 'forwarded';
        await conn.query("UPDATE leave_requests SET status = 'pending_l2', l1_by = ?, l1_at = NOW(3), l1_comment = ? WHERE id = ?", [viewer.id, comment, id]);
      } else {
        outcome = 'approved';
        await conn.query("UPDATE leave_requests SET status = 'approved', decided_stage = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?", [stage, viewer.id, comment, id]);
      }
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: comment ? `${outcome === 'forwarded' ? 'Forwarded to HoD' : outcome === 'approved' ? 'Approved' : 'Rejected'}: ${comment}` : outcome === 'forwarded' ? 'Forwarded to HoD' : null,
      });
      return { request: after, outcome };
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Takes a step back: a decision returns to the stage it was taken at; a forward returns to the reporting manager. */
export async function undoDecision(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<LeaveRequest> {
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status === 'pending_l1') throw new HttpError(409, 'This request has nothing to undo.', 'NOT_DECIDED');
      if (!canUndo(viewer, row)) {
        const once = viewer.role === 'reporting_manager' ? Number(row.undo_count ?? 0) >= 1 : viewer.role === 'reviewing_manager' ? Number(row.undo2_count ?? 0) >= 1 : false;
        throw forbidden(once ? 'You have already undone a step on this request once.' : 'You cannot undo this step.');
      }
      if (before.status === 'pending_l2') {
        await conn.query("UPDATE leave_requests SET status = 'pending_l1', l1_by = NULL, l1_at = NULL, l1_comment = NULL, undo_count = undo_count + 1 WHERE id = ?", [id]);
      } else if (Number(row.decided_stage) === 2) {
        await conn.query("UPDATE leave_requests SET status = 'pending_l2', decided_stage = NULL, action_by = NULL, action_at = NULL, manager_comment = NULL, undo2_count = undo2_count + 1 WHERE id = ?", [id]);
      } else {
        await conn.query("UPDATE leave_requests SET status = 'pending_l1', decided_stage = NULL, action_by = NULL, action_at = NULL, manager_comment = NULL, l1_by = NULL, l1_at = NULL, l1_comment = NULL, undo_count = undo_count + 1 WHERE id = ?", [id]);
      }
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: reason ? `Step undone: ${reason}` : 'Step undone',
      });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function deleteRequest(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<LeaveRequest> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot delete leave.');
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || (viewer.role !== 'administrator' && Number(row.user_id) !== viewer.id)) throw notFound('Request not found.');
      if (row.linked_to) throw new HttpError(409, 'This station leave follows its leave request. Delete that leave request instead.', 'LINKED');
      const target = toRequest(viewer, row);
      if (target.status !== 'pending_l1') throw new HttpError(409, 'Only a leave that has not been looked at yet can be deleted. Ask for the step to be undone first.', 'NOT_PENDING');
      if (!canModify(viewer, row)) throw new HttpError(409, DATE_PASSED_MESSAGE, 'DATE_PASSED');
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(target), action: 'DELETE', before: auditView(target), reason });
      await dropLinkedStation(conn, req, viewer, id);
      await conn.query('DELETE FROM leave_certificates WHERE request_id = ?', [id]);
      await conn.query('DELETE FROM leave_requests WHERE id = ?', [id]);
      return target;
    });
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
export async function applicableEmployees(viewer: Viewer): Promise<{ id: string; biometricId: string; name: string; designation: string }[]> {
  if (viewer.role !== 'administrator') return [];
  const found = await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, p.designation FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE LOWER(u.status) = 'active' ORDER BY u.name`);
  return found.map((r) => ({ id: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), designation: String(r.designation ?? '') }));
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export interface BalanceRow {
  userId: string; biometricId: string; name: string; designation: string; department: string; employmentType: string; basis: 'CY' | 'FY'; cycle: string; asOn: string;
  balances: Record<string, (Balance & { eligible: boolean }) | null>;
}

/** Balances of the people the viewer may see (self; managers their team; administrator and auditor everyone) for one leave year. */
/** The Leave Balance page: administrators and auditors only. (The dashboard and the apply form read a person's own balance through listBalances.) */
export async function listBalancesPage(viewer: Viewer, yearRaw: unknown): ReturnType<typeof listBalances> {
  if (viewer.role !== 'administrator' && viewer.role !== 'audit') throw forbidden('Only an administrator or auditor can see leave balances.');
  return listBalances(viewer, yearRaw);
}

export async function listBalances(viewer: Viewer, yearRaw: unknown): Promise<{ year: number; years: number[]; employeeTypes: Array<{ code: string; name: string }>; types: Array<{ id: string; code: string; name: string; isDebited: boolean }>; rows: BalanceRow[] }> {
  const year = yearRaw === undefined || yearRaw === '' ? Number(todayInIndia().slice(0, 4)) : Number(yearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Choose a year between 2000 and 2100.');
  try {
    const typeRows = await rows(pool, "SELECT * FROM leave_types WHERE status = 'active' ORDER BY name");
    const policies = await attachQuotas(pool, typeRows.map(toPolicy));
    const people = await rows(pool,
      `SELECT u.id, u.biometric_id, u.name, p.designation, p.department, p.employment_type, p.joining_date, p.profile_data
         FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE LOWER(u.status) = 'active' ORDER BY u.name`);
    const visible = people.filter((r) => canSee(viewer, { ...r, user_id: r.id }));
    const grants = await rows(pool, 'SELECT user_id, leave_type_id, total, carry_forward FROM leave_balances WHERE cycle_year = ?', [year]);
    const sums = await rows(pool,
      `SELECT user_id, leave_type_id,
              COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count + encash_days ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count + encash_days ELSE 0 END), 0) AS pending
         FROM leave_requests WHERE cycle_year = ? GROUP BY user_id, leave_type_id`, [year]);
    const linkedRows = await rows(pool,
      `SELECT r.user_id, t.debit_from_type_id AS base_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
        WHERE t.debit_from_type_id IS NOT NULL AND r.cycle_year = ? GROUP BY r.user_id, t.debit_from_type_id`, [year]);
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
        const asOf = balanceAsOn(year, basis, today);
        const total = g ? Number(g.total) : creditedQuota(p, emp.employmentType, year, basis, asOf, emp.isPwd), carryForward = g ? Number(g.carry_forward) : 0;
        const l = linkedOf.get(`${r.id}:${p.id}`);
        const used = Number(s?.used ?? 0) + Number(l?.used ?? 0), pending = Number(s?.pending ?? 0) + Number(l?.pending ?? 0);
        balances[String(p.id)] = { total, carryForward, used: num(used), pending: num(pending), available: num(total + carryForward - used - pending), eligible };
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
    if (!person || !canSee(viewer, { ...person, user_id: person.id })) throw notFound('Employee not found.');
    const data = profileData(person.profile_data);
    const basis: 'CY' | 'FY' = data.leaveCycle === 'FY' ? 'FY' : 'CY';
    const policies = await attachQuotas(pool, (await rows(pool, 'SELECT * FROM leave_types ORDER BY name')).map(toPolicy));
    const grants = await rows(pool, 'SELECT cycle_year, cycle_type, leave_type_id, total, carry_forward FROM leave_balances WHERE user_id = ?', [userId]);
    const sums = await rows(pool,
      `SELECT cycle_year, leave_type_id,
              COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count + encash_days ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count + encash_days ELSE 0 END), 0) AS pending
         FROM leave_requests WHERE user_id = ? GROUP BY cycle_year, leave_type_id`, [userId]);
    const linked = await rows(pool,
      `SELECT r.cycle_year, t.debit_from_type_id AS base_id,
              COALESCE(SUM(CASE WHEN r.status = 'approved' THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN r.status IN ('pending_l1', 'pending_l2') THEN (r.days_count + r.encash_days) * t.debit_factor ELSE 0 END), 0) AS pending
         FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
        WHERE r.user_id = ? AND t.debit_from_type_id IS NOT NULL GROUP BY r.cycle_year, t.debit_from_type_id`, [userId]);
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
  if (viewer.role !== 'administrator') throw forbidden('Only an administrator can change leave balances.');
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
  v.assert();
  try {
    return await inTransaction(async (conn) => {
      const emp = await loadEmployee(conn, Number(userId));
      const policy = await loadPolicy(conn, Number(leaveTypeId));
      if (!policy) throw badRequest('Please correct the highlighted fields.', { leaveTypeId: 'Choose a leave type from the list.' });
      await rows(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [emp.id]);
      const quotaPolicy = { id: policy.id, quota: creditedQuota(policy, emp.employmentType, year!, emp.basis, todayInIndia(), emp.isPwd) };
      const before = await balanceOf(conn, emp.id, quotaPolicy, year!);
      if (total + carryForward < before.used + before.pending) {
        throw badRequest('Please correct the highlighted fields.', { total: `Days already used or pending are ${num(before.used + before.pending)}; the grant cannot be lower.` });
      }
      await conn.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE total = VALUES(total), carry_forward = VALUES(carry_forward), cycle_type = VALUES(cycle_type)`,
        [emp.id, policy.id, year, total, carryForward, emp.basis],
      );
      const after = await balanceOf(conn, emp.id, quotaPolicy, year!);
      const [who] = await rows(conn, 'SELECT name, biometric_id FROM users WHERE id = ?', [emp.id]);
      const view = (b: Balance) => ({ total: b.total, carryForward: b.carryForward });
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
