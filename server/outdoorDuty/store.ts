import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { PATTERNS, Validator, isValidIsoDate, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { RoleId } from '../lib/roles';
import type { ActivityScope } from '../employees/activity';

/**
 * Outdoor duty (OD): official work away from the institute for one or more days.
 * Every rule is checked here, never in the browser.
 *
 *   User                 applies for themselves; edits / deletes before a decision and before the start date
 *   Reporting Manager    approves / rejects the OD of the people who report to them, up to the start date;
 *                        may undo their own decision once
 *   HoD                  sees the OD of the people under them (view only)
 *   Administrator        applies for anyone, edits / deletes before a decision, approves / rejects, undoes any time
 *   Auditor              sees every request and the activity log (who did what, when)
 *
 * An approved OD shows as "OD" on the Attendance page. Every change is audited
 * (master_key 'outdoor_duty') in the same transaction as the change.
 */

export const OD_TYPES = ['Domestic', 'International'] as const;
export const STATUSES = ['pending', 'approved', 'rejected'] as const;
export type OdStatus = (typeof STATUSES)[number];

const AUDIT_KEY = 'outdoor_duty';
export const MAX_OD_DAYS = 60;
/** How far back an administrator may enter an OD. */
export const ADMIN_BACKDATE_DAYS = 60;
export const MAX_RANGE_DAYS = 400;

export const OD_SCOPE: ActivityScope = {
  keys: ['outdoor_duty', 'outdoor_duty_export'],
  areaLabels: { outdoor_duty: 'Outdoor duty', outdoor_duty_export: 'Log download' },
  actionLabels: { CREATE: 'Applied', UPDATE: 'Edited', STATUS: 'Approved / rejected', DELETE: 'Deleted' },
  exportKey: 'outdoor_duty_export',
  title: 'Outdoor duty activity log',
  filePrefix: 'WII_Outdoor_Duty_Activity',
};

export interface Viewer { id: number; role: RoleId | null }

export interface OdRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysCount: number;
  odType: string;
  location: string;
  estimatedFunds: number;
  fundingSource: string | null;
  purpose: string;
  status: OdStatus;
  appliedAt: string;
  appliedById: string;
  appliedByName: string;
  managerId: string | null;
  managerName: string | null;
  actionByName: string | null;
  actionAt: string | null;
  comment: string | null;
  canDecide: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
}

export interface OdInput {
  userId: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  odType: (typeof OD_TYPES)[number];
  location: string;
  estimatedFunds: number;
  fundingSource: string | null;
  purpose: string;
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

const SELECT = `
  SELECT m.*, u.biometric_id, u.name AS user_name, p.designation, p.department, p.profile_data,
         ab.name AS applied_by_name, mg.name AS manager_name, ac.name AS action_by_name
    FROM outdoor_duty_requests m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
    LEFT JOIN users ab ON ab.id = m.applied_by
    LEFT JOIN users mg ON mg.id = m.manager_id
    LEFT JOIN users ac ON ac.id = m.action_by`;

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

/** Managers and employees act up to the start date (inclusive); an administrator any time. */
const notStarted = (row: RowDataPacket, today: string) => today <= isoDate(row.start_date);

function canDecide(viewer: Viewer, row: RowDataPacket, today = todayInIndia()): boolean {
  if (String(row.status) !== 'pending') return false;
  if (viewer.role === 'administrator') return true;
  if (Number(row.user_id) === viewer.id) return false;
  return viewer.role === 'reporting_manager' && managersOf(row).reporting === String(viewer.id) && notStarted(row, today);
}

function canModify(viewer: Viewer, row: RowDataPacket, today = todayInIndia()): boolean {
  if (String(row.status) !== 'pending') return false;
  if (viewer.role === 'administrator') return true;
  return viewer.role === 'general_staff' && Number(row.user_id) === viewer.id && notStarted(row, today);
}

function canUndo(viewer: Viewer, row: RowDataPacket): boolean {
  if (String(row.status) === 'pending') return false;
  if (viewer.role === 'administrator') return true;
  return viewer.role === 'reporting_manager' && managersOf(row).reporting === String(viewer.id)
    && Number(row.action_by) === viewer.id && Number(row.undo_count ?? 0) < 1;
}

function toRequest(viewer: Viewer, row: RowDataPacket): OdRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    biometricId: String(row.biometric_id ?? ''),
    name: String(row.user_name ?? ''),
    designation: String(row.designation ?? ''),
    department: String(row.department ?? ''),
    startDate: isoDate(row.start_date),
    endDate: isoDate(row.end_date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    daysCount: Number(row.days_count),
    odType: String(row.od_type),
    location: String(row.location),
    estimatedFunds: Number(row.estimated_funds ?? 0),
    fundingSource: row.funding_source ? String(row.funding_source) : null,
    purpose: String(row.purpose),
    status: String(row.status) as OdStatus,
    appliedAt: isoTime(row.created_at) ?? '',
    appliedById: String(row.applied_by),
    appliedByName: String(row.applied_by_name ?? ''),
    managerId: row.manager_id ? String(row.manager_id) : null,
    managerName: row.manager_name ? String(row.manager_name) : null,
    actionByName: row.action_by_name ? String(row.action_by_name) : null,
    actionAt: isoTime(row.action_at),
    comment: row.manager_comment ? String(row.manager_comment) : null,
    canDecide: canDecide(viewer, row),
    canEdit: canModify(viewer, row),
    canDelete: canModify(viewer, row),
    canUndo: canUndo(viewer, row),
  };
}

function auditView(r: OdRequest): Record<string, unknown> {
  return {
    employee: `${r.name} (${r.biometricId})`, type: r.odType, startDate: r.startDate, endDate: r.endDate, startTime: r.startTime, endTime: r.endTime,
    location: r.location, estimatedFunds: r.estimatedFunds, budgetHead: r.fundingSource, purpose: r.purpose, status: r.status, comment: r.comment,
  };
}
const label = (r: OdRequest) => `${r.name} (${r.biometricId}) · ${r.startDate}${r.endDate !== r.startDate ? ` to ${r.endDate}` : ''}`;

function missingTable(error: unknown): never | undefined {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Outdoor duty is not set up yet. Ask the administrator to run the outdoor duty migration.', 'NOT_CONFIGURED');
  }
  return undefined;
}

export function parseRange(query: { from?: unknown; to?: unknown }, today = todayInIndia()): { from: string; to: string } {
  const from = String(query.from ?? addDays(today, -90));
  const to = String(query.to ?? addDays(today, 60));
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Dates must be in YYYY-MM-DD format.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

/** Requests whose dates overlap the range. */
export async function listRequests(viewer: Viewer, query: { from?: unknown; to?: unknown }): Promise<{ from: string; to: string; requests: OdRequest[] }> {
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
// Validation
// ---------------------------------------------------------------------------

export function parseOdInput(body: unknown): OdInput {
  const v = new Validator(body);
  const userId = v.string('userId', { required: false, pattern: /^\d{1,20}$/, patternMessage: 'Invalid employee.' }) || null;
  const startDate = v.date('startDate');
  const endDate = v.date('endDate');
  const startTime = v.string('startTime', { pattern: PATTERNS.time24, patternMessage: 'Use the 24-hour format HH:mm.' });
  const endTime = v.string('endTime', { pattern: PATTERNS.time24, patternMessage: 'Use the 24-hour format HH:mm.' });
  const odType = v.oneOf('odType', OD_TYPES);
  const location = v.string('location', { min: 3, max: 200 });
  const purpose = v.string('purpose', { min: 10, max: 1000 });
  const fundingSource = v.optionalString('fundingSource', { max: 100 });
  const rawFunds = v.raw('estimatedFunds');
  let estimatedFunds = 0;
  if (rawFunds !== undefined && rawFunds !== null && rawFunds !== '') {
    const n = typeof rawFunds === 'number' ? rawFunds : typeof rawFunds === 'string' ? Number(rawFunds) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999 || Math.round(n * 100) !== n * 100 && Math.abs(Math.round(n * 100) - n * 100) > 1e-6) {
      v.errors.estimatedFunds = 'Enter an amount from 0 to 9,99,99,999 with at most two decimals.';
    } else estimatedFunds = Math.round(n * 100) / 100;
  }
  if (startDate && endDate) {
    if (startDate > endDate) v.errors.endDate ||= 'End date cannot be before the start date.';
    else if (daysBetween(startDate, endDate) > MAX_OD_DAYS) v.errors.endDate ||= `An outdoor duty can cover at most ${MAX_OD_DAYS} days.`;
    else if (startDate === endDate && startTime && endTime && !v.errors.startTime && !v.errors.endTime && endTime <= startTime) v.errors.endTime ||= 'End time must be later than start time for a single-day OD.';
  }
  v.assert();
  return { userId, startDate: startDate!, endDate: endDate!, startTime, endTime, odType: odType!, location: location.replace(/\s+/g, ' '), estimatedFunds, fundingSource, purpose: purpose.replace(/\s+/g, ' ') };
}

interface Target { id: number; joining: string | null; reportingManagerId: string | null }

async function loadTarget(q: { query: typeof pool.query }, userId: number): Promise<Target> {
  const [row] = await rows(q,
    `SELECT u.id, u.status, p.joining_date, p.profile_data FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  if (!row) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee from the list.' });
  if (String(row.status).toLowerCase() !== 'active') throw badRequest('Please correct the highlighted fields.', { userId: 'This employee is not active.' });
  const manager = String(profileData(row.profile_data).reportingManagerId ?? '');
  return { id: Number(row.id), joining: row.joining_date ? isoDate(row.joining_date) : null, reportingManagerId: /^\d+$/.test(manager) ? manager : null };
}

/** Dates rule: employees apply from today; administrators may enter up to ADMIN_BACKDATE_DAYS back. */
function checkDates(viewer: Viewer, input: OdInput, joining: string | null, today = todayInIndia()): void {
  const earliest = viewer.role === 'administrator' ? addDays(today, -ADMIN_BACKDATE_DAYS) : today;
  const errors: Record<string, string> = {};
  if (input.startDate < earliest) errors.startDate = viewer.role === 'administrator' ? `Dates more than ${ADMIN_BACKDATE_DAYS} days back cannot be entered.` : 'The start date cannot be in the past.';
  else if (joining && input.startDate < joining) errors.startDate = `This is before the employee joined (${joining}).`;
  else if (input.startDate > addDays(today, 365)) errors.startDate = 'The start date is more than a year away.';
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
}

async function overlaps(q: { query: typeof pool.query }, userId: number, input: OdInput, exceptId: number): Promise<RowDataPacket | null> {
  const [found] = await rows(q,
    "SELECT id, start_date, end_date FROM outdoor_duty_requests WHERE user_id = ? AND status <> 'rejected' AND id <> ? AND start_date <= ? AND end_date >= ? LIMIT 1",
    [userId, exceptId, input.endDate, input.startDate]);
  return found ?? null;
}
const overlapError = (found: RowDataPacket) =>
  new HttpError(409, 'This employee already has an outdoor duty on these dates.', 'DUPLICATE', { startDate: `Overlaps a pending or approved OD (${isoDate(found.start_date)} to ${isoDate(found.end_date)}).` });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function fetchOne(conn: { query: typeof pool.query }, id: number, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(conn, `${SELECT} WHERE m.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return row ?? null;
}

export async function createRequest(req: Request, viewer: Viewer, body: unknown): Promise<OdRequest> {
  const input = parseOdInput(body);
  let targetId: number;
  if (viewer.role === 'administrator') {
    if (!input.userId) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee.' });
    targetId = Number(input.userId);
  } else if (viewer.role === 'general_staff') {
    if (input.userId && Number(input.userId) !== viewer.id) throw forbidden('You can only apply for your own outdoor duty.');
    targetId = viewer.id;
  } else {
    throw forbidden('Your current role cannot apply for outdoor duty.');
  }
  const target = await loadTarget(pool, targetId);
  checkDates(viewer, input, target.joining);
  try {
    return await inTransaction(async (conn) => {
      const clash = await overlaps(conn, target.id, input, 0);
      if (clash) throw overlapError(clash);
      const [result] = await conn.query(
        `INSERT INTO outdoor_duty_requests
           (user_id, start_date, end_date, start_time, end_time, days_count, od_type, location, estimated_funds, funding_source, purpose, status, applied_by, manager_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [target.id, input.startDate, input.endDate, input.startTime, input.endTime, daysBetween(input.startDate, input.endDate), input.odType, input.location,
          input.estimatedFunds, input.fundingSource, input.purpose, viewer.id, target.reportingManagerId],
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

export async function updateRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<{ request: OdRequest; changed: string[] }> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot edit outdoor duty.');
  const input = parseOdInput(body);
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || (viewer.role !== 'administrator' && Number(row.user_id) !== viewer.id)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status !== 'pending') throw new HttpError(409, 'Only a request that is not yet approved or rejected can be edited. Undo the decision first.', 'NOT_PENDING');
      if (!canModify(viewer, row)) throw forbidden('The start date has passed, so you can no longer edit this request.');
      if (input.userId && input.userId !== String(row.user_id)) throw badRequest('Please correct the highlighted fields.', { userId: 'The employee of a request cannot be changed.' });
      const target = await loadTarget(conn, Number(row.user_id));
      checkDates(viewer, input, target.joining);
      const clash = await overlaps(conn, target.id, input, id);
      if (clash) throw overlapError(clash);
      await conn.query(
        `UPDATE outdoor_duty_requests SET start_date = ?, end_date = ?, start_time = ?, end_time = ?, days_count = ?, od_type = ?, location = ?,
           estimated_funds = ?, funding_source = ?, purpose = ? WHERE id = ?`,
        [input.startDate, input.endDate, input.startTime, input.endTime, daysBetween(input.startDate, input.endDate), input.odType, input.location, input.estimatedFunds, input.fundingSource, input.purpose, id],
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

export async function decideRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<OdRequest> {
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
      if (before.status !== 'pending') throw new HttpError(409, `This request is already ${before.status}.`, 'NOT_PENDING');
      if (!canDecide(viewer, row)) {
        throw forbidden(Number(row.user_id) === viewer.id ? 'You cannot approve or reject your own request. Ask your reporting manager or an administrator.'
          : viewer.role === 'reporting_manager' && managersOf(row).reporting === String(viewer.id) ? 'The start date has passed. Ask an administrator to decide this request.'
          : 'Only the reporting manager or an administrator can approve or reject this request.');
      }
      const status: OdStatus = action === 'approve' ? 'approved' : 'rejected';
      await conn.query('UPDATE outdoor_duty_requests SET status = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?', [status, viewer.id, comment, id]);
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after), reason: comment });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Takes an approval / rejection back: the request is pending again, with the decision kept in the audit log. */
export async function undoDecision(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<OdRequest> {
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status === 'pending') throw new HttpError(409, 'This request has no decision to undo.', 'NOT_DECIDED');
      if (!canUndo(viewer, row)) {
        throw forbidden(viewer.role === 'reporting_manager' && Number(row.action_by) === viewer.id ? 'You have already undone a decision on this request once.' : 'You cannot undo this decision.');
      }
      await conn.query("UPDATE outdoor_duty_requests SET status = 'pending', action_by = NULL, action_at = NULL, manager_comment = NULL, undo_count = undo_count + 1 WHERE id = ?", [id]);
      const after = toRequest(viewer, (await fetchOne(conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: reason ? `Decision undone: ${reason}` : 'Decision undone',
      });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function deleteRequest(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<OdRequest> {
  if (viewer.role !== 'administrator' && viewer.role !== 'general_staff') throw forbidden('Your current role cannot delete outdoor duty.');
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(conn, id, true);
      if (!row || (viewer.role !== 'administrator' && Number(row.user_id) !== viewer.id)) throw notFound('Request not found.');
      const target = toRequest(viewer, row);
      if (target.status !== 'pending') throw new HttpError(409, `This request is already ${target.status}. Undo the decision first.`, 'NOT_PENDING');
      if (!canModify(viewer, row)) throw forbidden('The start date has passed, so you can no longer delete this request.');
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(target), action: 'DELETE', before: auditView(target), reason });
      await conn.query('DELETE FROM outdoor_duty_requests WHERE id = ?', [id]);
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
