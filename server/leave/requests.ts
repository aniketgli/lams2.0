import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator, isValidIsoDate, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { RoleId } from '../lib/roles';
import type { ActivityScope } from '../employees/activity';
import { WEEK_DAYS } from '../attendance/compute';
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
const BALANCE_KEY = 'leave_balance';
export const ADMIN_BACKDATE_DAYS = 60;
/** An employee may apply this many days back when the leave type needs no notice (e.g. sick leave). */
export const EMPLOYEE_BACKDATE_DAYS = 7;
export const MAX_RANGE_DAYS = 400;

export const LEAVE_SCOPE: ActivityScope = {
  keys: ['leave_request', 'leave_balance', 'leave_export'],
  areaLabels: { leave_request: 'Leave request', leave_balance: 'Leave balance', leave_export: 'Log download' },
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
}

export interface LeaveInput {
  userId: string | null;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startSession: (typeof SESSIONS_START)[number];
  endSession: (typeof SESSIONS_END)[number];
  reason: string;
  certificate: boolean;
}

async function rows(q: { query: typeof pool.query }, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

function profileData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
const isoDate = (value: unknown): string => {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return String(value).slice(0, 10);
};
const isoTime = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);
const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const num = (n: number) => Math.round(n * 10) / 10;

const SELECT = `
  SELECT m.*, u.biometric_id, u.name AS user_name, p.designation, p.department, p.profile_data,
         t.name AS type_name, t.code AS type_code,
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
function managersOf(row: RowDataPacket): { reporting: string; reviewing: string } {
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

function canModify(viewer: Viewer, row: RowDataPacket): boolean {
  if (String(row.status) !== 'pending_l1') return false;
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

function auditView(r: LeaveRequest): Record<string, unknown> {
  return {
    employee: `${r.name} (${r.biometricId})`, leaveType: `${r.leaveTypeName} (${r.leaveTypeCode})`, startDate: r.startDate, endDate: r.endDate,
    startSession: r.startSession, endSession: r.endSession, days: r.daysCount, reason: r.reason, certificate: r.certificate, status: r.status,
    forwardedBy: r.forwardedByName, comment: r.comment,
  };
}
const label = (r: LeaveRequest) => `${r.name} (${r.biometricId}) · ${r.leaveTypeCode} · ${r.startDate}${r.endDate !== r.startDate ? ` to ${r.endDate}` : ''}`;

function missingTable(error: unknown): never | undefined {
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
  return { from, to, requests: found.filter((row) => canSee(viewer, row)).map((row) => toRequest(viewer, row)) };
}

// ---------------------------------------------------------------------------
// Employee, policy and balance lookups
// ---------------------------------------------------------------------------

interface Employee {
  id: number;
  employmentType: string;
  gender: string;
  joining: string | null;
  basis: 'CY' | 'FY';
  shiftId: string | null;
  reportingManagerId: string | null;
  reviewingManagerId: string | null;
}

async function loadEmployee(q: { query: typeof pool.query }, userId: number): Promise<Employee> {
  const [row] = await rows(q,
    `SELECT u.id, u.status, p.employment_type, p.joining_date, p.shift_id, p.profile_data FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  if (!row) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee from the list.' });
  if (String(row.status).toLowerCase() !== 'active') throw badRequest('Please correct the highlighted fields.', { userId: 'This employee is not active.' });
  const data = profileData(row.profile_data);
  const id = (v: unknown) => (/^\d+$/.test(String(v ?? '')) ? String(v) : null);
  return {
    id: Number(row.id),
    employmentType: String(row.employment_type ?? ''),
    gender: String(data.gender ?? ''),
    joining: row.joining_date ? isoDate(row.joining_date) : null,
    basis: data.leaveCycle === 'FY' ? 'FY' : 'CY',
    shiftId: row.shift_id ? String(row.shift_id) : null,
    reportingManagerId: id(data.reportingManagerId),
    reviewingManagerId: id(data.reviewingManagerId),
  };
}

interface Policy {
  id: number; code: string; name: string; quota: number; stages: 1 | 2; minNotice: number; halfDay: boolean; certDays: number;
  sandwich: 'included' | 'excluded'; employeeTypes: string[]; gender: string; minServiceMonths: number; maxConsecutive: number; debited: boolean;
  status: string; maxAccumulation: number; afterExhaustedId: number; lifetimeMax: number; maxSpells: number; quotas: Record<string, number>;
}

function toPolicy(r: RowDataPacket): Policy {
  return {
    id: Number(r.id), code: String(r.code), name: String(r.name), quota: Number(r.default_quota), stages: Number(r.approval_stages) === 2 ? 2 : 1,
    minNotice: Number(r.min_notice_days), halfDay: Boolean(r.half_day_allowed), certDays: Number(r.medical_cert_days),
    sandwich: String(r.sandwich_rule) === 'included' ? 'included' : 'excluded',
    employeeTypes: String(r.employee_types || '').split(',').map((s) => s.trim()).filter(Boolean), gender: String(r.gender),
    minServiceMonths: Number(r.min_service_months), maxConsecutive: Number(r.max_consecutive_days), debited: Boolean(r.is_debited),
    status: String(r.status), maxAccumulation: Number(r.max_accumulation), afterExhaustedId: Number(r.after_exhausted_type_id ?? 0),
    lifetimeMax: Number(r.lifetime_max ?? 0), maxSpells: Number(r.max_spells_per_year ?? 0), quotas: {},
  };
}

/** Quota of the employee type where the master sets one, else the leave type's default quota. */
export const quotaFor = (policy: Pick<Policy, 'quota' | 'quotas'>, employmentType: string): number => policy.quotas[employmentType] ?? policy.quota;

async function attachQuotas(q: { query: typeof pool.query }, policies: Policy[]): Promise<Policy[]> {
  if (!policies.length) return policies;
  const found = await rows(q, 'SELECT leave_type_id, employee_type, quota FROM leave_type_quotas');
  for (const p of policies) for (const f of found) if (Number(f.leave_type_id) === p.id) p.quotas[String(f.employee_type)] = Number(f.quota);
  return policies;
}

async function loadPolicy(q: { query: typeof pool.query }, id: number): Promise<Policy | null> {
  const [row] = await rows(q, 'SELECT * FROM leave_types WHERE id = ? LIMIT 1', [id]);
  if (!row) return null;
  const [policy] = await attachQuotas(q, [toPolicy(row)]);
  return policy;
}

const monthsBetween = (from: string, to: string): number =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) - (Number(to.slice(8, 10)) < Number(from.slice(8, 10)) ? 1 : 0);

/** Why this employee may not take this leave type, or null when eligible. */
export function eligibilityProblem(policy: Policy, emp: Pick<Employee, 'employmentType' | 'gender' | 'joining'>, onDate: string): string | null {
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
    `SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count ELSE 0 END), 0) AS pending
       FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND id <> ?`, [userId, policy.id, cycleYear, exceptRequestId]);
  const total = grant ? Number(grant.total) : policy.quota;
  const carryForward = grant ? Number(grant.carry_forward) : 0;
  const used = Number(sums?.used ?? 0), pending = Number(sums?.pending ?? 0);
  return { total, carryForward, used, pending, available: num(total + carryForward - used - pending) };
}

/** Working weekdays of the employee's shift and the gazetted holidays in a range, for counting leave days. */
async function dayRule(q: { query: typeof pool.query }, emp: Employee, policy: Policy, from: string, to: string) {
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
  return { sandwich: policy.sandwich, workingDays, gazetted };
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
  const certificate = v.bool('certificate');
  if (startDate && endDate && startDate > endDate) v.errors.endDate ||= 'End date cannot be before the start date.';
  v.assert();
  return { userId, leaveTypeId, startDate: startDate!, endDate: endDate!, startSession, endSession, reason: reason.replace(/\s+/g, ' '), certificate };
}

export interface Checked { days: number; cycleYear: number; policy: Policy; emp: Employee; balance: Balance }

/** Every rule of a leave application. Throws a field-level 400 / 409 when one fails. */
async function checkLeave(
  q: { query: typeof pool.query }, viewer: Viewer, input: LeaveInput, targetId: number, exceptId: number, today = todayInIndia(),
): Promise<Checked> {
  const emp = await loadEmployee(q, targetId);
  const policy = await loadPolicy(q, Number(input.leaveTypeId));
  const errors: Record<string, string> = {};
  if (!policy || policy.status !== 'active') throw badRequest('Please correct the highlighted fields.', { leaveTypeId: 'Choose a leave type from the list.' });

  const problem = eligibilityProblem(policy, emp, input.startDate);
  if (problem) errors.leaveTypeId = problem;

  const isAdmin = viewer.role === 'administrator';
  const earliest = isAdmin ? addDays(today, -ADMIN_BACKDATE_DAYS) : addDays(today, policy.minNotice === 0 ? -EMPLOYEE_BACKDATE_DAYS : 0);
  if (input.startDate < earliest) {
    errors.startDate = isAdmin ? `Dates more than ${ADMIN_BACKDATE_DAYS} days back cannot be entered.`
      : policy.minNotice === 0 ? `Leave can be applied up to ${EMPLOYEE_BACKDATE_DAYS} days back.` : 'The start date cannot be in the past.';
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
      const left = await balanceOf(q, targetId, { id: base.id, quota: quotaFor(base, emp.employmentType) }, cycleYear, 0);
      if (left.available > 0) errors.leaveTypeId = `${policy.name} can be taken only after ${base.name} is used up. ${left.available} days of ${base.name} are still available.`;
    }
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

  const rule = await dayRule(q, emp, policy, input.startDate, input.endDate);
  const { days } = countLeaveDays(input.startDate, input.endDate, input.startSession, input.endSession, rule);
  if (days <= 0) throw badRequest('Please correct the highlighted fields.', { startDate: 'No working day falls in these dates.' });
  if (policy.maxConsecutive && days > policy.maxConsecutive) errors.endDate = `${policy.name} can be taken for at most ${policy.maxConsecutive} days at a time.`;
  if (policy.certDays && days > policy.certDays && !input.certificate) errors.certificate = `A medical certificate is needed for more than ${policy.certDays} days. Confirm that it will be submitted.`;
  if (policy.lifetimeMax) {
    const [taken] = await rows(q, "SELECT COALESCE(SUM(days_count), 0) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, exceptId]);
    const before = Number(taken?.n ?? 0);
    if (before + days > policy.lifetimeMax) errors.endDate = `${policy.name} is limited to ${policy.lifetimeMax} days in the whole service; ${num(Math.max(0, policy.lifetimeMax - before))} days are left.`;
  }
  if (policy.maxSpells && !errors.endDate) {
    const [spells] = await rows(q, "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? AND status <> 'rejected' AND id <> ?", [targetId, policy.id, cycleYear, exceptId]);
    if (Number(spells?.n ?? 0) >= policy.maxSpells) errors.startDate = `${policy.name} can be applied for at most ${policy.maxSpells} times in a leave year.`;
  }
  if (policy.stages === 2 && !emp.reviewingManagerId) errors.leaveTypeId = 'This employee has no HoD set, which this leave type needs. Ask the administrator.';
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

  const [clash] = await rows(q,
    "SELECT id, start_date, end_date FROM leave_requests WHERE user_id = ? AND status <> 'rejected' AND id <> ? AND start_date <= ? AND end_date >= ? LIMIT 1",
    [targetId, exceptId, input.endDate, input.startDate]);
  if (clash) throw new HttpError(409, 'This employee already has a leave on these dates.', 'DUPLICATE', { startDate: `Overlaps a pending or approved leave (${isoDate(clash.start_date)} to ${isoDate(clash.end_date)}).` });

  const balance = await balanceOf(q, targetId, { id: policy.id, quota: quotaFor(policy, emp.employmentType) }, cycleYear, exceptId);
  if (policy.debited && days > balance.available) {
    const [next] = await rows(q, "SELECT name FROM leave_types WHERE after_exhausted_type_id = ? AND status = 'active' LIMIT 1", [policy.id]);
    const hint = next ? ` After it is used up, ${next.name} can be applied for.` : '';
    throw new HttpError(409, 'Not enough leave balance.', 'NO_BALANCE', { endDate: `${policy.name}: ${days} days asked, ${Math.max(0, balance.available)} available for ${cycleLabel(cycleYear, emp.basis)}.${hint}` });
  }
  return { days, cycleYear, policy, emp, balance };
}

export const cycleLabel = (year: number, basis: 'CY' | 'FY') => (basis === 'FY' ? `FY ${year}-${String(year + 1).slice(2)}` : `${year}`);

/** What the apply form shows while it is filled: the days and balance the server will use. Never writes. */
export async function previewLeave(viewer: Viewer, query: Record<string, unknown>): Promise<{ days: number; cycleYear: number; cycle: string; balance: Balance | null; error: string | null }> {
  const input = (() => {
    try {
      return parseLeaveInput({ ...query, reason: 'preview', certificate: true });
    } catch {
      return null;
    }
  })();
  const target = viewer.role === 'administrator' ? Number(input?.userId ?? 0) : viewer.id;
  if (!input || !target) return { days: 0, cycleYear: 0, cycle: '', balance: null, error: null };
  try {
    const c = await checkLeave(pool, viewer, input, target, 0);
    return { days: c.days, cycleYear: c.cycleYear, cycle: cycleLabel(c.cycleYear, c.emp.basis), balance: c.balance, error: null };
  } catch (error) {
    if (error instanceof HttpError) return { days: 0, cycleYear: 0, cycle: '', balance: null, error: Object.values(error.details ?? {})[0] ?? error.message };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function fetchOne(conn: { query: typeof pool.query }, id: number, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(conn, `${SELECT} WHERE m.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return row ?? null;
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
           (user_id, leave_type_id, start_date, end_date, start_session, end_session, days_count, cycle_year, reason, certificate, stages, status, applied_by, manager_id, reviewer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_l1', ?, ?, ?)`,
        [targetId, c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0,
          c.policy.stages, viewer.id, c.emp.reportingManagerId, c.emp.reviewingManagerId],
      );
      const id = Number((result as { insertId: number }).insertId);
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
      const before = toRequest(viewer, row);
      if (before.status !== 'pending_l1') throw new HttpError(409, 'Only a leave that has not been looked at yet can be edited. Ask for the step to be undone first.', 'NOT_PENDING');
      if (input.userId && input.userId !== String(row.user_id)) throw badRequest('Please correct the highlighted fields.', { userId: 'The employee of a request cannot be changed.' });
      const c = await checkLeave(conn, viewer, input, Number(row.user_id), id);
      await conn.query(
        `UPDATE leave_requests SET leave_type_id = ?, start_date = ?, end_date = ?, start_session = ?, end_session = ?, days_count = ?, cycle_year = ?,
           reason = ?, certificate = ?, stages = ?, manager_id = ?, reviewer_id = ? WHERE id = ?`,
        [c.policy.id, input.startDate, input.endDate, input.startSession, input.endSession, c.days, c.cycleYear, input.reason, input.certificate ? 1 : 0,
          c.policy.stages, c.emp.reportingManagerId, c.emp.reviewingManagerId, id],
      );
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
      const target = toRequest(viewer, row);
      if (target.status !== 'pending_l1') throw new HttpError(409, 'Only a leave that has not been looked at yet can be deleted. Ask for the step to be undone first.', 'NOT_PENDING');
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(target), action: 'DELETE', before: auditView(target), reason });
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
  userId: string; biometricId: string; name: string; designation: string; department: string; basis: 'CY' | 'FY'; cycle: string;
  balances: Record<string, (Balance & { eligible: boolean }) | null>;
}

/** Balances of the people the viewer may see (self; managers their team; administrator and auditor everyone) for one leave year. */
export async function listBalances(viewer: Viewer, yearRaw: unknown): Promise<{ year: number; types: Array<{ id: string; code: string; name: string; isDebited: boolean }>; rows: BalanceRow[] }> {
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
              COALESCE(SUM(CASE WHEN status = 'approved' THEN days_count ELSE 0 END), 0) AS used,
              COALESCE(SUM(CASE WHEN status IN ('pending_l1', 'pending_l2') THEN days_count ELSE 0 END), 0) AS pending
         FROM leave_requests WHERE cycle_year = ? GROUP BY user_id, leave_type_id`, [year]);
    const grantOf = new Map(grants.map((g) => [`${g.user_id}:${g.leave_type_id}`, g]));
    const sumOf = new Map(sums.map((s) => [`${s.user_id}:${s.leave_type_id}`, s]));
    const out: BalanceRow[] = visible.map((r) => {
      const data = profileData(r.profile_data);
      const basis: 'CY' | 'FY' = data.leaveCycle === 'FY' ? 'FY' : 'CY';
      const emp = { employmentType: String(r.employment_type ?? ''), gender: String(data.gender ?? ''), joining: r.joining_date ? isoDate(r.joining_date) : null };
      const balances: BalanceRow['balances'] = {};
      for (const p of policies) {
        const eligible = eligibilityProblem(p, emp, `${year}-12-31`) === null;
        const g = grantOf.get(`${r.id}:${p.id}`), s = sumOf.get(`${r.id}:${p.id}`);
        if (!eligible && !g && !s) { balances[String(p.id)] = null; continue; }
        const total = g ? Number(g.total) : quotaFor(p, emp.employmentType), carryForward = g ? Number(g.carry_forward) : 0;
        const used = Number(s?.used ?? 0), pending = Number(s?.pending ?? 0);
        balances[String(p.id)] = { total, carryForward, used, pending, available: num(total + carryForward - used - pending), eligible };
      }
      return { userId: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), designation: String(r.designation ?? ''), department: String(r.department ?? ''), basis, cycle: cycleLabel(year, basis), balances };
    });
    return { year, types: policies.map((p) => ({ id: String(p.id), code: p.code, name: p.name, isDebited: p.debited })), rows: out };
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
      const quotaPolicy = { id: policy.id, quota: quotaFor(policy, emp.employmentType) };
      const before = await balanceOf(conn, emp.id, quotaPolicy, year!);
      if (total + carryForward < before.used + before.pending) {
        throw badRequest('Please correct the highlighted fields.', { total: `Days already used or pending are ${num(before.used + before.pending)}; the grant cannot be lower.` });
      }
      await conn.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE total = VALUES(total), carry_forward = VALUES(carry_forward)`,
        [emp.id, policy.id, year, total, carryForward],
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
