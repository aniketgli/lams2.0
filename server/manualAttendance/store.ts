import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { PATTERNS, Validator, isValidIsoDate, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { RoleId } from '../lib/roles';
import type { ActivityScope } from '../employees/activity';
import { biometricInOut } from '../attendance/store';

/**
 * Manual attendance: a request to correct a missed or wrong punch (table
 * `manual_attendance_requests`). Every rule is checked here, never in the browser.
 *
 *   User                 apply for themselves; see their own requests and their status
 *   Reporting Manager    approve / reject requests of the people who report to them
 *   HoD                  see the requests of the people under them (view only)
 *   Administrator        apply / edit / delete for anyone; approve / reject any request
 *   Auditor              see every request and the activity log (who did what, when)
 *
 * An approved request counts as In / Out on the Attendance page. Every change is
 * audited (master_key 'manual_attendance') in the same transaction as the change.
 */

export const REASON_CATEGORIES = ['Forgot to Punch', 'Biometric Issue', 'Not Registered Yet', 'Registration Day', 'Urgent OD', 'Other'] as const;
export const STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RequestStatus = (typeof STATUSES)[number];

const AUDIT_KEY = 'manual_attendance';

/** The auditor's activity log: request changes and downloads of that log. */
export const MANUAL_SCOPE: ActivityScope = {
  keys: ['manual_attendance', 'manual_attendance_export'],
  areaLabels: { manual_attendance: 'Manual attendance', manual_attendance_export: 'Log download' },
  actionLabels: { CREATE: 'Applied', UPDATE: 'Edited', STATUS: 'Approved / rejected', DELETE: 'Deleted' },
  exportKey: 'manual_attendance_export',
  title: 'Manual attendance activity log',
  filePrefix: 'WII_Manual_Attendance_Activity',
};

export interface Viewer { id: number; role: RoleId | null }

export interface ManualRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  date: string;
  inTime: string;
  outTime: string;
  originalIn: string | null;
  originalOut: string | null;
  category: string;
  reason: string;
  status: RequestStatus;
  appliedAt: string;
  appliedById: string;
  appliedByName: string;
  managerId: string | null;
  managerName: string | null;
  actionByName: string | null;
  actionAt: string | null;
  comment: string | null;
  /** What this viewer may do with the request right now. */
  canDecide: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ManualInput {
  userId: string | null;
  date: string;
  inTime: string;
  outTime: string;
  category: (typeof REASON_CATEGORIES)[number];
  reason: string;
}

/** Longest range one list request may cover. */
export const MAX_RANGE_DAYS = 400;

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
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};
const isoTime = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);

const SELECT = `
  SELECT m.*, u.biometric_id, u.name AS user_name, p.designation, p.department, p.profile_data,
         ab.name AS applied_by_name, mg.name AS manager_name, ac.name AS action_by_name
    FROM manual_attendance_requests m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
    LEFT JOIN users ab ON ab.id = m.applied_by
    LEFT JOIN users mg ON mg.id = m.manager_id
    LEFT JOIN users ac ON ac.id = m.action_by`;

function managersOf(row: RowDataPacket): { reporting: string; reviewing: string } {
  const data = profileData(row.profile_data);
  return { reporting: String(data.reportingManagerId ?? ''), reviewing: String(data.reviewingManagerId ?? '') };
}

/** Whether `viewer` may see this employee's requests. */
function canSee(viewer: Viewer, row: RowDataPacket): boolean {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return true;
  if (Number(row.user_id) === viewer.id) return true;
  if (viewer.role !== 'reporting_manager' && viewer.role !== 'reviewing_manager') return false;
  const m = managersOf(row);
  return m.reporting === String(viewer.id) || m.reviewing === String(viewer.id);
}

function canDecide(viewer: Viewer, row: RowDataPacket): boolean {
  if (String(row.status) !== 'pending') return false;
  if (Number(row.user_id) === viewer.id) return false; // nobody approves their own request
  if (viewer.role === 'administrator') return true;
  return viewer.role === 'reporting_manager' && managersOf(row).reporting === String(viewer.id);
}

function toRequest(viewer: Viewer, row: RowDataPacket): ManualRequest {
  const admin = viewer.role === 'administrator';
  return {
    id: String(row.id),
    userId: String(row.user_id),
    biometricId: String(row.biometric_id ?? ''),
    name: String(row.user_name ?? ''),
    designation: String(row.designation ?? ''),
    department: String(row.department ?? ''),
    date: isoDate(row.att_date),
    inTime: String(row.in_time),
    outTime: String(row.out_time),
    originalIn: row.original_in ? String(row.original_in) : null,
    originalOut: row.original_out ? String(row.original_out) : null,
    category: String(row.category),
    reason: String(row.reason),
    status: String(row.status) as RequestStatus,
    appliedAt: isoTime(row.created_at) ?? '',
    appliedById: String(row.applied_by),
    appliedByName: String(row.applied_by_name ?? ''),
    managerId: row.manager_id ? String(row.manager_id) : null,
    managerName: row.manager_name ? String(row.manager_name) : null,
    actionByName: row.action_by_name ? String(row.action_by_name) : null,
    actionAt: isoTime(row.action_at),
    comment: row.manager_comment ? String(row.manager_comment) : null,
    canDecide: canDecide(viewer, row),
    canEdit: admin && String(row.status) === 'pending',
    canDelete: admin,
  };
}

/** What the audit trail records for a request. */
function auditView(r: ManualRequest): Record<string, unknown> {
  return {
    employee: `${r.name} (${r.biometricId})`, date: r.date, inTime: r.inTime, outTime: r.outTime, category: r.category,
    reason: r.reason, status: r.status, comment: r.comment,
  };
}
const label = (r: ManualRequest) => `${r.name} (${r.biometricId}) · ${r.date}`;

function missingTable(error: unknown): never | undefined {
  if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
    throw new HttpError(503, 'Manual attendance is not set up yet. Ask the administrator to run the manual attendance migration.', 'NOT_CONFIGURED');
  }
  return undefined;
}

export function parseRange(query: { from?: unknown; to?: unknown }, today = todayInIndia()): { from: string; to: string } {
  const back = new Date(`${today}T00:00:00Z`);
  back.setUTCDate(back.getUTCDate() - 90);
  const from = String(query.from ?? back.toISOString().slice(0, 10));
  const to = String(query.to ?? today);
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Dates must be in YYYY-MM-DD format.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

export async function listRequests(viewer: Viewer, query: { from?: unknown; to?: unknown }): Promise<{ from: string; to: string; requests: ManualRequest[] }> {
  const { from, to } = parseRange(query);
  let found: RowDataPacket[];
  try {
    found = await rows(pool, `${SELECT} WHERE m.att_date BETWEEN ? AND ? ORDER BY m.att_date DESC, m.id DESC`, [from, to]);
  } catch (error) {
    missingTable(error);
    throw error;
  }
  return { from, to, requests: found.filter((row) => canSee(viewer, row)).map((row) => toRequest(viewer, row)) };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function parseManualInput(body: unknown): ManualInput {
  const v = new Validator(body);
  const userId = v.string('userId', { required: false, pattern: /^\d{1,20}$/, patternMessage: 'Invalid employee.' }) || null;
  const date = v.date('date');
  const inTime = v.string('inTime', { pattern: PATTERNS.time24, patternMessage: 'Use the 24-hour format HH:mm.' });
  const outTime = v.string('outTime', { pattern: PATTERNS.time24, patternMessage: 'Use the 24-hour format HH:mm.' });
  const category = v.oneOf('category', REASON_CATEGORIES);
  const reason = v.string('reason', { min: 5, max: 500 });
  if (inTime && outTime && !v.errors.inTime && !v.errors.outTime && outTime <= inTime) v.errors.outTime ||= 'Check-Out must be later than Check-In.';
  v.assert();
  return { userId, date: date!, inTime, outTime, category: category!, reason: reason.replace(/\s+/g, ' ') };
}

/** Date rules that depend on the employee and today's date. */
function checkDate(input: ManualInput, joining: string | null, today = todayInIndia()): void {
  if (input.date >= today) throw badRequest('Please correct the highlighted fields.', { date: 'Manual attendance is only for past dates, up to yesterday.' });
  if (joining && input.date < joining) throw badRequest('Please correct the highlighted fields.', { date: `This is before the employee joined (${joining}).` });
}

interface Target { id: number; biometricId: string; joining: string | null; reportingManagerId: string | null }

async function loadTarget(q: { query: typeof pool.query }, userId: number): Promise<Target> {
  const [row] = await rows(q,
    `SELECT u.id, u.biometric_id, u.status, p.joining_date, p.profile_data
       FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  if (!row) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee from the list.' });
  if (String(row.status).toLowerCase() !== 'active') throw badRequest('Please correct the highlighted fields.', { userId: 'This employee is not active.' });
  const manager = String(profileData(row.profile_data).reportingManagerId ?? '');
  return {
    id: Number(row.id), biometricId: String(row.biometric_id),
    joining: row.joining_date ? isoDate(row.joining_date) : null,
    reportingManagerId: /^\d+$/.test(manager) ? manager : null,
  };
}

async function hasOpenRequest(q: { query: typeof pool.query }, userId: number, date: string, exceptId: number): Promise<boolean> {
  const found = await rows(q, "SELECT id, status FROM manual_attendance_requests WHERE user_id = ? AND att_date = ? AND status <> 'rejected' AND id <> ? LIMIT 1", [userId, date, exceptId]);
  return found.length > 0;
}

const duplicate = (date: string) => new HttpError(409, 'This employee already has a request for that date.', 'DUPLICATE', { date: `A pending or approved request already exists for ${date}.` });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function fetchOne(viewer: Viewer, conn: { query: typeof pool.query }, id: number, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(conn, `${SELECT} WHERE m.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return row ?? null;
}

export async function createRequest(req: Request, viewer: Viewer, body: unknown): Promise<ManualRequest> {
  const input = parseManualInput(body);
  let targetId: number;
  if (viewer.role === 'administrator') {
    if (!input.userId) throw badRequest('Please correct the highlighted fields.', { userId: 'Choose an employee.' });
    targetId = Number(input.userId);
  } else if (viewer.role === 'general_staff') {
    if (input.userId && Number(input.userId) !== viewer.id) throw forbidden('You can only apply for your own attendance.');
    targetId = viewer.id;
  } else {
    throw forbidden('Your current role cannot apply for manual attendance.');
  }

  const target = await loadTarget(pool, targetId);
  checkDate(input, target.joining);
  // The biometric punches found for that day, kept for the approver to compare.
  const original = await biometricInOut(target.biometricId, input.date);

  try {
    return await inTransaction(async (conn) => {
      if (await hasOpenRequest(conn, target.id, input.date, 0)) throw duplicate(input.date);
      const [result] = await conn.query(
        `INSERT INTO manual_attendance_requests
           (user_id, att_date, in_time, out_time, original_in, original_out, category, reason, status, applied_by, manager_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [target.id, input.date, input.inTime, input.outTime, original?.inTime ?? null, original?.outTime ?? null, input.category, input.reason, viewer.id, target.reportingManagerId],
      );
      const id = Number((result as { insertId: number }).insertId);
      const created = toRequest(viewer, (await fetchOne(viewer, conn, id))!);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(created) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function updateRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<{ request: ManualRequest; changed: string[] }> {
  if (viewer.role !== 'administrator') throw forbidden('Only an administrator can edit a request.');
  const input = parseManualInput(body);
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(viewer, conn, id, true);
      if (!row) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status !== 'pending') throw new HttpError(409, 'Only a pending request can be edited. Delete it and apply again if an approved one is wrong.', 'NOT_PENDING');
      const target = await loadTarget(conn, Number(row.user_id));
      checkDate(input, target.joining);
      if (await hasOpenRequest(conn, target.id, input.date, id)) throw duplicate(input.date);
      const original = input.date === before.date ? { inTime: before.originalIn, outTime: before.originalOut } : await biometricInOut(target.biometricId, input.date);
      await conn.query(
        'UPDATE manual_attendance_requests SET att_date = ?, in_time = ?, out_time = ?, original_in = ?, original_out = ?, category = ?, reason = ? WHERE id = ?',
        [input.date, input.inTime, input.outTime, original?.inTime ?? null, original?.outTime ?? null, input.category, input.reason, id],
      );
      const after = toRequest(viewer, (await fetchOne(viewer, conn, id))!);
      const changed = changedFields(auditView(before), auditView(after));
      if (changed.length) {
        await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'UPDATE', before: auditView(before), after: auditView(after) });
      }
      return { request: after, changed };
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function decideRequest(req: Request, viewer: Viewer, id: number, body: unknown): Promise<ManualRequest> {
  const v = new Validator(body);
  const action = v.oneOf('action', ['approve', 'reject'] as const);
  const comment = v.optionalString('comment', { max: 500 });
  if (action === 'reject' && !comment) v.errors.comment ||= 'Say why the request is rejected.';
  else if (action === 'reject' && comment && comment.length < 3) v.errors.comment ||= 'Say why the request is rejected.';
  v.assert();

  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(viewer, conn, id, true);
      if (!row || !canSee(viewer, row)) throw notFound('Request not found.');
      const before = toRequest(viewer, row);
      if (before.status !== 'pending') throw new HttpError(409, `This request is already ${before.status}.`, 'NOT_PENDING');
      if (!canDecide(viewer, row)) {
        throw forbidden(Number(row.user_id) === viewer.id ? 'You cannot approve or reject your own request.' : 'Only the reporting manager or an administrator can approve or reject this request.');
      }
      const status: RequestStatus = action === 'approve' ? 'approved' : 'rejected';
      await conn.query(
        'UPDATE manual_attendance_requests SET status = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?',
        [status, viewer.id, comment, id],
      );
      const after = toRequest(viewer, (await fetchOne(viewer, conn, id))!);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(after), action: 'STATUS',
        before: auditView(before), after: auditView(after), reason: comment,
      });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function deleteRequest(req: Request, viewer: Viewer, id: number, reason: string | null): Promise<ManualRequest> {
  if (viewer.role !== 'administrator') throw forbidden('Only an administrator can delete a request.');
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchOne(viewer, conn, id, true);
      if (!row) throw notFound('Request not found.');
      const target = toRequest(viewer, row);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(target), action: 'DELETE', before: auditView(target), reason });
      await conn.query('DELETE FROM manual_attendance_requests WHERE id = ?', [id]);
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
