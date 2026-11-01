import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator, todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import { biometricDay } from '../attendance/store';
import { datesBetween, weekdayOf } from '../attendance/compute';
import { detectCertificateType, parseCertificate } from './certificates';
import {
  addDays, dayRule, isoDate, isoTime, loadEmployee, managersOf, missingTable, profileData, rows, type Viewer,
} from './requests';

/**
 * Joining report. Every 2-stage leave (leave type "Joining form needed") is followed by one, filled on the first working
 * day after the leave. It exists whether the leave was approved or is still pending (a rejected leave needs none).
 *
 *   The form is made from the leave application and the biometric In / Out of the joining day; the employee only checks
 *   it and submits. The reporting manager forwards it and the HoD approves or rejects it (an administrator can decide at
 *   any stage). A rejected report can be corrected and submitted again.
 *   A fitness medical certificate (PDF) can be attached for leave types marked "Fitness certificate on joining" (HPL / Commuted).
 *
 * Everything is worked out here: the joining date, who may submit and decide, the punch, the file. The browser only shows it.
 */

export const JOINING_KEY = 'leave_joining';
export const JOINING_STATUSES = ['pending_l1', 'pending_l2', 'approved', 'rejected'] as const;
export type JoiningStatus = (typeof JOINING_STATUSES)[number];
/** Leaves that ended longer ago than this, and never got a report, are no longer listed as due. */
export const DUE_WINDOW_DAYS = 180;

export interface JoiningReport {
  id: string;
  status: JoiningStatus;
  punchIn: string | null;
  punchOut: string | null;
  submittedAt: string;
  submittedByName: string;
  managerName: string | null;
  reviewerName: string | null;
  forwardedByName: string | null;
  forwardedAt: string | null;
  forwardComment: string | null;
  actionByName: string | null;
  actionByRole: 'R.M.' | 'HoD' | 'Admin' | null;
  actionAt: string | null;
  comment: string | null;
  fitnessName: string | null;
  waitingFor: string | null;
}

export interface JoiningItem {
  requestId: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  startSession: string;
  endSession: string;
  days: number;
  reason: string;
  contactAddress: string;
  stationLeave: boolean;
  ltcType: string;
  prefixFrom: string | null;
  prefixTo: string | null;
  suffixFrom: string | null;
  suffixTo: string | null;
  leaveStatus: string;
  /** A fitness medical certificate can be attached. */
  fitnessAllowed: boolean;
  /** The first working day after the leave. */
  joiningDate: string;
  report: JoiningReport | null;
  canSubmit: boolean;
  canEdit: boolean;
  canDecide: boolean;
  decideStep: 'approve' | 'forward';
}

export interface JoiningList { today: string; items: JoiningItem[] }
export interface JoiningPrepared { item: JoiningItem; punch: { in: string | null; out: string | null } }

const isAdmin = (viewer: Viewer) => viewer.role === 'administrator';

const FROM = `
    FROM leave_requests m
    JOIN leave_types t ON t.id = m.leave_type_id
    JOIN users u ON u.id = m.user_id
    LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
    LEFT JOIN leave_joining_reports j ON j.request_id = m.id
    LEFT JOIN users sb ON sb.id = j.submitted_by
    LEFT JOIN users mg ON mg.id = COALESCE(j.manager_id, m.manager_id)
    LEFT JOIN users rv ON rv.id = COALESCE(j.reviewer_id, m.reviewer_id)
    LEFT JOIN users l1 ON l1.id = j.l1_by
    LEFT JOIN users ac ON ac.id = j.action_by`;
const SELECT = `
  SELECT m.id AS request_id, m.user_id, m.leave_type_id, m.start_date, m.end_date, m.start_session, m.end_session, m.days_count, m.reason, m.contact_address, m.station_leave,
         m.ltc_type, m.status AS leave_status, m.prefix_from, m.prefix_to, m.suffix_from, m.suffix_to, m.manager_id AS leave_manager_id, m.reviewer_id AS leave_reviewer_id,
         t.name AS type_name, t.code AS type_code, t.fitness_certificate, t.approval_stages,
         u.biometric_id, u.name AS user_name, p.designation, p.department, p.profile_data,
         j.id AS report_id, j.joining_date, j.punch_in, j.punch_out, j.status AS report_status, j.manager_id AS j_manager_id, j.reviewer_id AS j_reviewer_id,
         j.submitted_at, j.l1_by, j.l1_at, j.l1_comment, j.decided_stage, j.action_by, j.action_at, j.manager_comment,
         sb.name AS submitted_by_name, mg.name AS manager_name, rv.name AS reviewer_name, l1.name AS l1_name, ac.name AS action_by_name,
         (SELECT c.file_name FROM leave_joining_certificates c WHERE c.report_id = j.id) AS fitness_name
  ${FROM}`;
const WHERE_LEAVE = "t.joining_required = 1 AND m.status <> 'rejected' AND m.linked_to IS NULL";

const timeOf = (value: unknown): string | null => (value ? String(value).slice(0, 5) : null);

// ---------------------------------------------------------------------------
// Who may do what
// ---------------------------------------------------------------------------

function canSee(viewer: Viewer, row: RowDataPacket): boolean {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return true;
  if (Number(row.user_id) === viewer.id) return true;
  if (viewer.role !== 'reporting_manager' && viewer.role !== 'reviewing_manager') return false;
  const m = managersOf(row);
  return m.reporting === String(viewer.id) || m.reviewing === String(viewer.id);
}

const reportStatus = (row: RowDataPacket): JoiningStatus | null => (row.report_id ? (String(row.report_status) as JoiningStatus) : null);

function mayFile(viewer: Viewer, row: RowDataPacket): boolean {
  return isAdmin(viewer) || (viewer.role === 'general_staff' && Number(row.user_id) === viewer.id);
}

function canDecide(viewer: Viewer, row: RowDataPacket): boolean {
  const status = reportStatus(row);
  if (status !== 'pending_l1' && status !== 'pending_l2') return false;
  if (isAdmin(viewer)) return true;
  if (Number(row.user_id) === viewer.id) return false;
  const m = managersOf(row);
  if (status === 'pending_l1') return viewer.role === 'reporting_manager' && m.reporting === String(viewer.id);
  return viewer.role === 'reviewing_manager' && m.reviewing === String(viewer.id);
}

// ---------------------------------------------------------------------------
// The joining date
// ---------------------------------------------------------------------------

/** The first working day after `end`: not a weekly off of the shift and not a gazetted holiday. */
export function firstWorkingDayAfter(end: string, workingDays: string[], gazetted: Set<string>): string {
  for (const date of datesBetween(addDays(end, 1), addDays(end, 60))) {
    if (workingDays.includes(weekdayOf(date)) && !gazetted.has(date)) return date;
  }
  return addDays(end, 1);
}

async function joiningDateOf(q: { query: typeof pool.query }, row: RowDataPacket): Promise<string> {
  const emp = await loadEmployee(q, Number(row.user_id));
  const end = isoDate(row.end_date);
  // Only the shift's working days and the gazetted holidays matter here.
  const rule = await dayRule(q, emp, { sandwich: 'excluded', offDaysOnly: false } as never, addDays(end, 1), addDays(end, 60));
  return firstWorkingDayAfter(end, rule.workingDays, rule.gazetted);
}

// ---------------------------------------------------------------------------
// Rows -> items
// ---------------------------------------------------------------------------

function actionRole(row: RowDataPacket): 'R.M.' | 'HoD' | 'Admin' | null {
  if (!row.action_by) return null;
  const by = Number(row.action_by);
  if (by === Number(row.j_reviewer_id) && Number(row.decided_stage) === 2) return 'HoD';
  if (by === Number(row.j_manager_id)) return 'R.M.';
  if (by === Number(row.j_reviewer_id)) return 'HoD';
  return 'Admin';
}

function toItem(viewer: Viewer, row: RowDataPacket, joiningDate: string, today: string): JoiningItem {
  const status = reportStatus(row);
  const filed = Boolean(status);
  const mine = mayFile(viewer, row);
  const report: JoiningReport | null = status ? {
    id: String(row.report_id),
    status,
    punchIn: timeOf(row.punch_in),
    punchOut: timeOf(row.punch_out),
    submittedAt: isoTime(row.submitted_at) ?? '',
    submittedByName: String(row.submitted_by_name ?? ''),
    managerName: row.manager_name ? String(row.manager_name) : null,
    reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
    forwardedByName: row.l1_name ? String(row.l1_name) : null,
    forwardedAt: isoTime(row.l1_at),
    forwardComment: row.l1_comment ? String(row.l1_comment) : null,
    actionByName: row.action_by_name ? String(row.action_by_name) : null,
    actionByRole: actionRole(row),
    actionAt: isoTime(row.action_at),
    comment: row.manager_comment ? String(row.manager_comment) : null,
    fitnessName: row.fitness_name ? String(row.fitness_name) : null,
    waitingFor: status === 'pending_l1' ? 'Reporting Manager' : status === 'pending_l2' ? 'HoD' : null,
  } : null;
  return {
    requestId: String(row.request_id), userId: String(row.user_id), biometricId: String(row.biometric_id ?? ''), name: String(row.user_name ?? ''),
    designation: String(row.designation ?? ''), department: String(row.department ?? ''),
    leaveTypeCode: String(row.type_code), leaveTypeName: String(row.type_name),
    startDate: isoDate(row.start_date), endDate: isoDate(row.end_date), startSession: String(row.start_session), endSession: String(row.end_session),
    days: Number(row.days_count), reason: String(row.reason ?? ''), contactAddress: String(row.contact_address ?? ''), stationLeave: Boolean(row.station_leave), ltcType: String(row.ltc_type ?? 'none'),
    prefixFrom: row.prefix_from ? isoDate(row.prefix_from) : null, prefixTo: row.prefix_to ? isoDate(row.prefix_to) : null,
    suffixFrom: row.suffix_from ? isoDate(row.suffix_from) : null, suffixTo: row.suffix_to ? isoDate(row.suffix_to) : null,
    leaveStatus: String(row.leave_status), fitnessAllowed: Boolean(row.fitness_certificate), joiningDate, report,
    canSubmit: !filed && mine && joiningDate <= today,
    canEdit: filed && mine && (status === 'pending_l1' || status === 'rejected'),
    canDecide: canDecide(viewer, row),
    decideStep: status === 'pending_l1' && Number(row.approval_stages) === 2 && !isAdmin(viewer) ? 'forward' : 'approve',
  };
}

async function fetchLeave(q: { query: typeof pool.query }, requestId: number, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(q, `${SELECT} WHERE m.id = ? AND ${WHERE_LEAVE} LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [requestId]);
  return row ?? null;
}

/** Reports filed, and the leaves whose joining day has come and still need one. */
export async function listJoining(viewer: Viewer): Promise<JoiningList> {
  const today = todayInIndia();
  let found: RowDataPacket[];
  try {
    found = await rows(pool, `${SELECT} WHERE ${WHERE_LEAVE} AND m.end_date < ? AND (m.end_date >= ? OR j.id IS NOT NULL) ORDER BY m.end_date DESC, m.id DESC`, [today, addDays(today, -DUE_WINDOW_DAYS)]);
  } catch (error) {
    missingTable(error);
    throw error;
  }
  const items: JoiningItem[] = [];
  for (const row of found) {
    if (!canSee(viewer, row)) continue;
    let joiningDate: string;
    try {
      joiningDate = row.joining_date ? isoDate(row.joining_date) : await joiningDateOf(pool, row);
    } catch (error) {
      if (error instanceof HttpError) continue; // e.g. an employee who is no longer active
      throw error;
    }
    if (!row.report_id && joiningDate > today) continue; // the joining day has not come: shown from that day
    items.push(toItem(viewer, row, joiningDate, today));
  }
  return { today, items };
}

/** What the form shows: the leave's details and the biometric In / Out of the joining day. */
export async function prepareJoining(viewer: Viewer, requestIdRaw: unknown): Promise<JoiningPrepared> {
  const id = Number(requestIdRaw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Choose a leave.', { requestId: 'Choose a leave.' });
  const today = todayInIndia();
  try {
    const row = await fetchLeave(pool, id);
    if (!row || !canSee(viewer, row)) throw notFound('Leave not found.');
    const joiningDate = row.joining_date ? isoDate(row.joining_date) : await joiningDateOf(pool, row);
    const emp = await loadEmployee(pool, Number(row.user_id));
    const day = await biometricDay(emp.biometricId, emp.shiftId, joiningDate <= today ? joiningDate : today);
    return { item: toItem(viewer, row, joiningDate, today), punch: joiningDate <= today ? { in: day.in, out: day.out } : { in: null, out: null } };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Submit / correct
// ---------------------------------------------------------------------------

function auditView(item: JoiningItem): Record<string, unknown> {
  const r = item.report;
  return {
    employee: `${item.name} (${item.biometricId})`, leave: `${item.leaveTypeCode} ${item.startDate} to ${item.endDate}`, joiningDate: item.joiningDate,
    punchIn: r?.punchIn ?? null, punchOut: r?.punchOut ?? null, fitnessCertificate: r?.fitnessName ?? null, status: r?.status ?? null,
  };
}
const label = (item: JoiningItem) => `${item.name} (${item.biometricId}) · joining after ${item.leaveTypeCode} ${item.startDate}${item.endDate !== item.startDate ? ` to ${item.endDate}` : ''}`;

/** Null when nothing was sent; a PDF is the only fitness certificate the server keeps. */
function parseFitness(raw: unknown, allowed: boolean) {
  const file = parseCertificate(raw);
  if (!file) return null;
  if (!allowed) throw badRequest('Please correct the highlighted fields.', { certificate: 'A fitness certificate is not taken for this leave type.' });
  if (file.mime !== 'application/pdf') throw badRequest('Please correct the highlighted fields.', { certificate: 'The fitness certificate must be a PDF file.' });
  return file;
}

async function saveFitness(conn: { query: typeof pool.query }, reportId: number, file: NonNullable<ReturnType<typeof parseFitness>>, userId: number) {
  await conn.query(
    `INSERT INTO leave_joining_certificates (report_id, file_name, mime_type, size_bytes, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), data = VALUES(data),
       uploaded_by = VALUES(uploaded_by), uploaded_at = CURRENT_TIMESTAMP(3)`,
    [reportId, file.name, file.mime, file.bytes.length, file.bytes, userId],
  );
}

/** The punch of the joining day, read now from the biometric log. At least one punch is needed. */
async function joiningPunch(q: { query: typeof pool.query }, row: RowDataPacket, joiningDate: string) {
  const emp = await loadEmployee(q, Number(row.user_id));
  const day = await biometricDay(emp.biometricId, emp.shiftId, joiningDate);
  if (!day.in && !day.out) {
    throw badRequest('Please correct the highlighted fields.', {
      requestId: `No biometric punch is recorded for ${joiningDate}. Joining needs a punch on the joining day. If the machine missed it, apply for manual attendance first.`,
    });
  }
  return { emp, day };
}

export async function submitJoining(req: Request, viewer: Viewer, body: unknown): Promise<JoiningItem> {
  const v = new Validator(body);
  const requestId = v.string('requestId', { pattern: /^\d{1,20}$/, patternMessage: 'Choose a leave.' });
  v.assert();
  const raw = (body ?? {}) as Record<string, unknown>;
  const today = todayInIndia();
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchLeave(conn, Number(requestId), true);
      if (!row || !canSee(viewer, row)) throw notFound('Leave not found.');
      if (!mayFile(viewer, row)) throw forbidden('Only the employee, or an administrator, can submit the joining report.');
      if (row.report_id) throw new HttpError(409, 'The joining report of this leave is already submitted.', 'EXISTS');
      const joiningDate = await joiningDateOf(conn, row);
      if (joiningDate > today) throw badRequest('Please correct the highlighted fields.', { requestId: `The joining report can be submitted from the joining day, ${joiningDate}.` });
      const file = parseFitness(raw.certificate, Boolean(row.fitness_certificate));
      const { emp, day } = await joiningPunch(conn, row, joiningDate);
      if (!emp.reviewingManagerId) throw badRequest('Please correct the highlighted fields.', { requestId: 'This employee has no HoD set, which the joining report needs. Ask the administrator.' });
      const [result] = await conn.query(
        `INSERT INTO leave_joining_reports (request_id, user_id, joining_date, punch_in, punch_out, status, manager_id, reviewer_id, submitted_by)
         VALUES (?, ?, ?, ?, ?, 'pending_l1', ?, ?, ?)`,
        [row.request_id, row.user_id, joiningDate, day.in, day.out, emp.reportingManagerId, emp.reviewingManagerId, viewer.id],
      );
      const reportId = Number((result as { insertId: number }).insertId);
      if (file) await saveFitness(conn, reportId, file, viewer.id);
      const item = toItem(viewer, (await fetchLeave(conn, Number(requestId)))!, joiningDate, today);
      await writeMasterAuditSql(conn, req, { masterKey: JOINING_KEY, recordId: reportId, recordLabel: label(item), action: 'CREATE', after: auditView(item) });
      return item;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** A report that has not been looked at, or was rejected, is made again from the application and the punch, and goes back to the reporting manager. */
export async function correctJoining(req: Request, viewer: Viewer, requestIdRaw: unknown, body: unknown): Promise<JoiningItem> {
  const id = Number(requestIdRaw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Report not found.');
  const raw = (body ?? {}) as Record<string, unknown>;
  const today = todayInIndia();
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchLeave(conn, id, true);
      if (!row || !row.report_id || !canSee(viewer, row)) throw notFound('Report not found.');
      if (!mayFile(viewer, row)) throw forbidden('Only the employee, or an administrator, can change the joining report.');
      const status = reportStatus(row);
      if (status !== 'pending_l1' && status !== 'rejected') throw new HttpError(409, 'Only a report that has not been looked at yet, or was rejected, can be changed.', 'NOT_PENDING');
      const before = toItem(viewer, row, isoDate(row.joining_date), today);
      const file = parseFitness(raw.certificate, Boolean(row.fitness_certificate));
      const { emp, day } = await joiningPunch(conn, row, isoDate(row.joining_date));
      if (!emp.reviewingManagerId) throw badRequest('Please correct the highlighted fields.', { requestId: 'This employee has no HoD set, which the joining report needs. Ask the administrator.' });
      await conn.query(
        `UPDATE leave_joining_reports SET punch_in = ?, punch_out = ?, status = 'pending_l1', manager_id = ?, reviewer_id = ?, submitted_by = ?, submitted_at = NOW(3),
           l1_by = NULL, l1_at = NULL, l1_comment = NULL, decided_stage = NULL, action_by = NULL, action_at = NULL, manager_comment = NULL WHERE id = ?`,
        [day.in, day.out, emp.reportingManagerId, emp.reviewingManagerId, viewer.id, row.report_id],
      );
      if (file) await saveFitness(conn, Number(row.report_id), file, viewer.id);
      else if (raw.removeCertificate === true) await conn.query('DELETE FROM leave_joining_certificates WHERE report_id = ?', [row.report_id]);
      const after = toItem(viewer, (await fetchLeave(conn, id))!, isoDate(row.joining_date), today);
      const changed = changedFields(auditView(before), auditView(after));
      await writeMasterAuditSql(conn, req, {
        masterKey: JOINING_KEY, recordId: Number(row.report_id), recordLabel: label(after), action: 'UPDATE', before: auditView(before), after: auditView(after),
        reason: status === 'rejected' ? 'Submitted again after rejection' : changed.length ? null : 'Submitted again',
      });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------------

export async function decideJoining(req: Request, viewer: Viewer, requestIdRaw: unknown, body: unknown): Promise<{ item: JoiningItem; outcome: 'approved' | 'forwarded' | 'rejected' }> {
  const id = Number(requestIdRaw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Report not found.');
  const v = new Validator(body);
  const action = v.oneOf('action', ['approve', 'reject'] as const);
  const comment = v.optionalString('comment', { max: 500 });
  if (action === 'reject' && (!comment || comment.length < 3)) v.errors.comment ||= 'Say why the report is rejected.';
  v.assert();
  const today = todayInIndia();
  try {
    return await inTransaction(async (conn) => {
      const row = await fetchLeave(conn, id, true);
      if (!row || !row.report_id || !canSee(viewer, row)) throw notFound('Report not found.');
      const status = reportStatus(row)!;
      if (status === 'approved' || status === 'rejected') throw new HttpError(409, `This report is already ${status}.`, 'NOT_PENDING');
      if (!canDecide(viewer, row)) {
        throw forbidden(Number(row.user_id) === viewer.id ? 'You cannot approve or reject your own report. Ask your reporting manager or an administrator.'
          : status === 'pending_l2' ? 'Only the HoD or an administrator can decide this report now.' : 'Only the reporting manager or an administrator can decide this report now.');
      }
      const before = toItem(viewer, row, isoDate(row.joining_date), today);
      const stage = status === 'pending_l2' ? 2 : 1;
      let outcome: 'approved' | 'forwarded' | 'rejected';
      if (action === 'reject') {
        outcome = 'rejected';
        await conn.query("UPDATE leave_joining_reports SET status = 'rejected', decided_stage = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?", [stage, viewer.id, comment, row.report_id]);
      } else if (stage === 1 && !isAdmin(viewer)) {
        outcome = 'forwarded';
        await conn.query("UPDATE leave_joining_reports SET status = 'pending_l2', l1_by = ?, l1_at = NOW(3), l1_comment = ? WHERE id = ?", [viewer.id, comment, row.report_id]);
      } else {
        outcome = 'approved';
        await conn.query("UPDATE leave_joining_reports SET status = 'approved', decided_stage = ?, action_by = ?, action_at = NOW(3), manager_comment = ? WHERE id = ?", [stage, viewer.id, comment, row.report_id]);
      }
      const after = toItem(viewer, (await fetchLeave(conn, id))!, isoDate(row.joining_date), today);
      await writeMasterAuditSql(conn, req, {
        masterKey: JOINING_KEY, recordId: Number(row.report_id), recordLabel: label(after), action: 'STATUS', before: auditView(before), after: auditView(after),
        reason: comment ? `${outcome === 'forwarded' ? 'Forwarded to HoD' : outcome === 'approved' ? 'Approved' : 'Rejected'}: ${comment}` : outcome === 'forwarded' ? 'Forwarded to HoD' : null,
      });
      return { item: after, outcome };
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function fitnessOf(viewer: Viewer, requestIdRaw: unknown): Promise<{ name: string; mime: string; data: Buffer }> {
  const id = Number(requestIdRaw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Report not found.');
  try {
    const row = await fetchLeave(pool, id);
    if (!row || !row.report_id || !canSee(viewer, row)) throw notFound('Report not found.');
    const [file] = await rows(pool, 'SELECT file_name, data FROM leave_joining_certificates WHERE report_id = ? LIMIT 1', [row.report_id]);
    if (!file) throw notFound('No fitness certificate is attached to this report.');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const mime = detectCertificateType(data);
    if (!mime) throw notFound('No fitness certificate is attached to this report.');
    return { name: String(file.file_name), mime, data };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}
