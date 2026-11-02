import { brandedMail } from '../notifications/notify';
import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { EmailService } from '../integrations/email/email.service';
import { HttpError, notFound } from '../lib/http';
import { ROLE_LABELS, normalizeModule, normalizeRole, type RoleId } from '../lib/roles';
import { inTransaction } from '../lib/tx';
import { todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import { REPORTS, REPORT_KEYS, findReport } from './catalog';
import { renderReport } from './render';
import {
  describeTiming, isDue, occursOn, parseScheduleInput, periodFor, type Frequency, type ReportFormat, type ScheduleInput,
} from './schedule';

/**
 * Report schedules: what is sent, to whom, how often and when (Indian time). Only administrators manage them and every change is
 * audited (master_key 'report_schedule') in the same transaction. Nothing is pre-filled. Each run (automatic or "send now")
 * is kept in report_runs, with how many people it reached.
 */

export const AUDIT_KEY = 'report_schedule';

export interface ScheduleView {
  id: string;
  name: string;
  reportKey: string;
  reportLabel: string;
  frequency: Frequency;
  weekday: number | null;
  monthDay: number | null;
  sendTime: string;
  timing: string;
  formats: ReportFormat[];
  status: 'active' | 'paused';
  users: { id: string; name: string; email: string }[];
  roles: { id: string; label: string }[];
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
  nextRun: string | null;
}

export interface RunView { id: string; ranAt: string; trigger: 'schedule' | 'manual'; periodFrom: string | null; periodTo: string | null; status: string; sentCount: number; message: string | null }

const rows = async (sql: string, params: unknown[] = [], q: { query: typeof pool.query } = pool): Promise<RowDataPacket[]> => (await q.query<RowDataPacket[]>(sql, params))[0];

function missingTable(error: unknown): never | void {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Reports are not set up yet. Ask the administrator to run the report migration.', 'NOT_CONFIGURED');
  }
}

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const dateOnly = (v: unknown): string | null => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v ? String(v).slice(0, 10) : null);

/** The next day (within a year) this schedule fires, as YYYY-MM-DD, counting today only if its time has not passed. */
export function nextRunDate(t: { frequency: string; weekday: number | null; monthDay: number | null; sendTime: string; status: string }, today: string, nowTime: string): string | null {
  if (t.status !== 'active') return null;
  let day = today;
  for (let i = 0; i < 400; i++) {
    if (occursOn(t, day) && (i > 0 || t.sendTime > nowTime)) return day;
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    day = d.toISOString().slice(0, 10);
  }
  return null;
}

export const nowTimeInIndia = (): string => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(/^24/, '00');

async function toViews(list: RowDataPacket[]): Promise<ScheduleView[]> {
  if (!list.length) return [];
  const ids = list.map((r) => Number(r.id));
  const marks = ids.map(() => '?').join(',');
  const recipients = await rows(
    `SELECT r.schedule_id, r.kind, r.user_id, r.role_id, u.name, u.email FROM report_schedule_recipients r LEFT JOIN users u ON u.id = r.user_id WHERE r.schedule_id IN (${marks})`, ids);
  const today = todayInIndia(), now = nowTimeInIndia();
  return list.map((r) => {
    const mine = recipients.filter((x) => Number(x.schedule_id) === Number(r.id));
    const timing = { frequency: String(r.frequency), weekday: r.weekday === null ? null : Number(r.weekday), monthDay: r.month_day === null ? null : Number(r.month_day), sendTime: String(r.send_time) };
    return {
      id: String(r.id), name: String(r.name), reportKey: String(r.report_key), reportLabel: findReport(String(r.report_key))?.label ?? String(r.report_key),
      frequency: timing.frequency as Frequency, weekday: timing.weekday, monthDay: timing.monthDay, sendTime: timing.sendTime, timing: describeTiming(timing),
      formats: String(r.formats).split(',').filter(Boolean) as ReportFormat[], status: String(r.status) === 'paused' ? 'paused' : 'active',
      users: mine.filter((x) => x.kind === 'user').map((x) => ({ id: String(x.user_id), name: String(x.name ?? ''), email: String(x.email ?? '') })),
      roles: mine.filter((x) => x.kind === 'role').map((x) => ({ id: String(x.role_id), label: ROLE_LABELS[x.role_id as RoleId] ?? String(x.role_id) })),
      lastRunAt: iso(r.last_run_at), lastStatus: r.last_status ? String(r.last_status) : null, lastMessage: r.last_message ? String(r.last_message) : null,
      nextRun: nextRunDate({ ...timing, status: String(r.status) }, today, now),
    };
  });
}

export async function listSchedules(): Promise<ScheduleView[]> {
  try {
    return await toViews(await rows('SELECT * FROM report_schedules ORDER BY name'));
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

async function loadOne(id: number, q: { query: typeof pool.query } = pool, lock = false): Promise<RowDataPacket | null> {
  const [row] = await rows(`SELECT * FROM report_schedules WHERE id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id], q);
  return row ?? null;
}

export async function getSchedule(id: number): Promise<ScheduleView> {
  try {
    const row = await loadOne(id);
    if (!row) throw notFound('Report schedule not found.');
    return (await toViews([row]))[0];
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** What the chooser shows: the reports, and the people who can receive them (active accounts with a registered email). */
export async function scheduleOptions() {
  const people = await rows(
    `SELECT u.id, u.name, u.biometric_id, u.email, p.designation FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE LOWER(u.status) = 'active' AND u.is_system = 0 AND u.email <> '' ORDER BY u.name`);
  return {
    reports: REPORTS.map((r) => ({ key: r.key, label: r.label, description: r.description, snapshot: r.snapshot })),
    roles: Object.entries(ROLE_LABELS).map(([id, label]) => ({ id, label })),
    people: people.map((p) => ({ id: String(p.id), name: String(p.name), biometricId: String(p.biometric_id), email: String(p.email), designation: String(p.designation ?? '') })),
  };
}

const auditView = (s: ScheduleView): Record<string, unknown> => ({
  name: s.name, report: s.reportLabel, when: s.timing, formats: s.formats.join(', ').toUpperCase(), status: s.status,
  people: s.users.map((u) => u.name).sort().join(', '), roles: s.roles.map((r) => r.label).sort().join(', '),
});

async function saveRecipients(conn: { query: typeof pool.query }, scheduleId: number, input: ScheduleInput): Promise<void> {
  await conn.query('DELETE FROM report_schedule_recipients WHERE schedule_id = ?', [scheduleId]);
  if (input.userIds.length) {
    const found = await rows(`SELECT id FROM users WHERE id IN (${input.userIds.map(() => '?').join(',')}) AND LOWER(status) = 'active' AND email <> ''`, input.userIds, conn);
    if (found.length !== input.userIds.length) {
      throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { recipients: 'One of the chosen people is no longer active or has no registered email.' });
    }
    for (const id of input.userIds) await conn.query("INSERT INTO report_schedule_recipients (schedule_id, kind, user_id) VALUES (?, 'user', ?)", [scheduleId, id]);
  }
  for (const role of input.roles) await conn.query("INSERT INTO report_schedule_recipients (schedule_id, kind, role_id) VALUES (?, 'role', ?)", [scheduleId, role]);
}

const reasonOf = (body: unknown) => {
  const r = (body as { reason?: unknown })?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};

export async function createSchedule(req: Request, body: unknown): Promise<ScheduleView> {
  const input = parseScheduleInput(body, REPORT_KEYS);
  try {
    return await inTransaction(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO report_schedules (name, report_key, frequency, weekday, month_day, send_time, formats, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.name, input.reportKey, input.frequency, input.weekday, input.monthDay, input.sendTime, input.formats.join(','), input.status, req.auth?.account.biometricId ?? null]);
      const id = Number((result as { insertId: number }).insertId);
      await saveRecipients(conn, id, input);
      const created = (await toViews([(await loadOne(id, conn))!]))[0];
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: created.name, action: 'CREATE', after: auditView(created), reason: reasonOf(body) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function updateSchedule(req: Request, id: number, body: unknown): Promise<{ schedule: ScheduleView; changed: string[] }> {
  const input = parseScheduleInput(body, REPORT_KEYS);
  try {
    return await inTransaction(async (conn) => {
      const row = await loadOne(id, conn, true);
      if (!row) throw notFound('Report schedule not found.');
      const before = (await toViews([row]))[0];
      // A changed time or day starts afresh: today's occurrence counts again if its time is still to come.
      const timingChanged = before.frequency !== input.frequency || before.weekday !== input.weekday || before.monthDay !== input.monthDay || before.sendTime !== input.sendTime;
      await conn.query(
        `UPDATE report_schedules SET name = ?, report_key = ?, frequency = ?, weekday = ?, month_day = ?, send_time = ?, formats = ?, status = ?${timingChanged ? ', last_slot = NULL' : ''} WHERE id = ?`,
        [input.name, input.reportKey, input.frequency, input.weekday, input.monthDay, input.sendTime, input.formats.join(','), input.status, id]);
      await saveRecipients(conn, id, input);
      const after = (await toViews([(await loadOne(id, conn))!]))[0];
      const changed = changedFields(auditView(before), auditView(after));
      if (changed.length) await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: after.name, action: 'UPDATE', before: auditView(before), after: auditView(after), reason: reasonOf(body) });
      return { schedule: after, changed };
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function setScheduleStatus(req: Request, id: number, statusRaw: unknown): Promise<ScheduleView> {
  if (statusRaw !== 'active' && statusRaw !== 'paused') throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { status: 'Choose active or paused.' });
  try {
    return await inTransaction(async (conn) => {
      const row = await loadOne(id, conn, true);
      if (!row) throw notFound('Report schedule not found.');
      const before = (await toViews([row]))[0];
      if (before.status === statusRaw) return before;
      await conn.query('UPDATE report_schedules SET status = ? WHERE id = ?', [statusRaw, id]);
      const after = (await toViews([(await loadOne(id, conn))!]))[0];
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: after.name, action: 'STATUS', before: { status: before.status }, after: { status: after.status } });
      return after;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function deleteSchedule(req: Request, id: number, reason: string | null): Promise<ScheduleView> {
  try {
    return await inTransaction(async (conn) => {
      const row = await loadOne(id, conn, true);
      if (!row) throw notFound('Report schedule not found.');
      const before = (await toViews([row]))[0];
      await conn.query('DELETE FROM report_schedule_recipients WHERE schedule_id = ?', [id]);
      await conn.query('DELETE FROM report_runs WHERE schedule_id = ?', [id]);
      await conn.query('DELETE FROM report_schedules WHERE id = ?', [id]);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: before.name, action: 'DELETE', before: auditView(before), reason });
      return before;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function listRuns(id: number): Promise<RunView[]> {
  try {
    if (!(await loadOne(id))) throw notFound('Report schedule not found.');
    const found = await rows('SELECT * FROM report_runs WHERE schedule_id = ? ORDER BY ran_at DESC, id DESC LIMIT 20', [id]);
    return found.map((r) => ({
      id: String(r.id), ranAt: iso(r.ran_at) ?? '', trigger: r.trigger_type === 'manual' ? 'manual' : 'schedule', periodFrom: dateOnly(r.period_from), periodTo: dateOnly(r.period_to),
      status: String(r.status), sentCount: Number(r.sent_count), message: r.message ? String(r.message) : null,
    }));
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Registered emails of the chosen people and of everyone who holds a chosen HRMS role, without repeats. */
export async function resolveRecipients(scheduleId: number): Promise<{ email: string; name: string }[]> {
  const chosen = await rows('SELECT kind, user_id, role_id FROM report_schedule_recipients WHERE schedule_id = ?', [scheduleId]);
  const userIds = new Set(chosen.filter((c) => c.kind === 'user').map((c) => Number(c.user_id)));
  const roles = new Set(chosen.filter((c) => c.kind === 'role').map((c) => String(c.role_id)));
  if (roles.size) {
    const grants = await rows("SELECT u.id, g.module_id, g.role_id FROM user_module_roles g JOIN users u ON u.biometric_id = g.biometric_id WHERE LOWER(g.status) = 'active'");
    for (const g of grants) {
      const role = normalizeRole(g.role_id);
      if (normalizeModule(g.module_id) === 'hrms' && role && roles.has(role)) userIds.add(Number(g.id));
    }
  }
  if (!userIds.size) return [];
  const people = await rows(`SELECT name, email FROM users WHERE id IN (${[...userIds].map(() => '?').join(',')}) AND LOWER(status) = 'active' AND email <> '' ORDER BY name`, [...userIds]);
  const seen = new Set<string>();
  return people.filter((p) => { const k = String(p.email).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).map((p) => ({ email: String(p.email), name: String(p.name) }));
}

/** The scheduler acts for nobody: the audit log shows it as the "Report scheduler". */
const systemRequest = { auth: { account: { biometricId: null, name: 'Report scheduler' }, activeRole: null }, ip: 'scheduler' } as unknown as Request;

const pretty = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export interface RunResult { status: 'sent' | 'partial' | 'failed' | 'no_recipients'; sent: number; message: string }

/** Builds the report and emails it to each recipient separately. The result is recorded in report_runs and on the schedule. */
export async function runSchedule(row: RowDataPacket, trigger: 'schedule' | 'manual', today = todayInIndia()): Promise<RunResult> {
  const id = Number(row.id);
  const def = findReport(String(row.report_key));
  const period = def?.snapshot ? { from: today, to: today } : periodFor(String(row.frequency), today);
  let result: RunResult;
  try {
    if (!def) throw new Error('This report no longer exists.');
    const recipients = await resolveRecipients(id);
    if (!recipients.length) {
      result = { status: 'no_recipients', sent: 0, message: 'There is nobody with a registered email to send it to.' };
    } else {
      const table = await def.build(period, systemRequest);
      const periodText = def.snapshot ? `as on ${pretty(today)}` : period.from === period.to ? pretty(period.from) : `${pretty(period.from)} to ${pretty(period.to)}`;
      const formats = String(row.formats).split(',').filter(Boolean) as ReportFormat[];
      const attachments = renderReport(table, formats, `${def.label}_${def.snapshot ? today : period.from}${!def.snapshot && period.from !== period.to ? `_to_${period.to}` : ''}`,
        [`${def.label} · ${periodText}`, `Sent automatically by WII Portal on ${pretty(today)}`]);
      let sent = 0;
      const failures: string[] = [];
      for (const to of recipients) {
        const letter = await brandedMail({
          title: 'Scheduled report', name: to.name,
          intro: `Please find the ${def.label} report attached.`,
          details: [['Report', def.label], ['Period', periodText], ['Rows', table.rows.length]],
        });
        const mail = await EmailService.sendEmail({
          to: to.email, toName: to.name, subject: `${String(row.name)} — ${periodText}`, category: 'REPORT', eventType: 'SCHEDULED_REPORT', referenceId: `report-${id}`, attachments: [...attachments, ...letter.logo],
          html: letter.html, text: letter.text,
        });
        if (mail.status === 'delivered') sent += 1;
        else failures.push(mail.message);
      }
      result = sent === recipients.length ? { status: 'sent', sent, message: `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}.` }
        : sent === 0 ? { status: 'failed', sent, message: (failures[0] ?? 'The email could not be sent.').slice(0, 450) }
        : { status: 'partial', sent, message: `Sent to ${sent} of ${recipients.length}. ${failures[0] ?? ''}`.trim().slice(0, 450) };
    }
  } catch (error) {
    result = { status: 'failed', sent: 0, message: (error instanceof Error ? error.message : 'The report could not be made.').slice(0, 450) };
  }
  try {
    await pool.query('INSERT INTO report_runs (schedule_id, trigger_type, period_from, period_to, status, sent_count, message) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, trigger, period.from, period.to, result.status, result.sent, result.message]);
    await pool.query('UPDATE report_schedules SET last_run_at = NOW(3), last_status = ?, last_message = ? WHERE id = ?', [result.status, result.message, id]);
  } catch (error) {
    console.error('[reports] could not record the run:', error instanceof Error ? error.message : error);
  }
  return result;
}

/** "Send now": one run for today, whenever it is asked for; the schedule's own timing is not touched. Audited as the administrator's act. */
export async function sendNow(req: Request, id: number): Promise<{ schedule: ScheduleView; result: RunResult }> {
  try {
    const row = await loadOne(id);
    if (!row) throw notFound('Report schedule not found.');
    const result = await runSchedule(row, 'manual');
    const schedule = await getSchedule(id);
    await inTransaction(async (conn) => {
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: schedule.name, action: 'UPDATE', after: { sentNow: result.status, people: result.sent } });
    });
    return { schedule, result };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Runs every schedule that is due now. Each occurrence is claimed first (last_slot), so two servers never send the same one twice. */
export async function runDueSchedules(today = todayInIndia(), nowTime = nowTimeInIndia()): Promise<number> {
  let found: RowDataPacket[];
  try {
    found = await rows("SELECT * FROM report_schedules WHERE status = 'active'");
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return 0; // migration not run yet
    throw error;
  }
  let ran = 0;
  for (const row of found) {
    const timing = { frequency: String(row.frequency), weekday: row.weekday === null ? null : Number(row.weekday), monthDay: row.month_day === null ? null : Number(row.month_day), sendTime: String(row.send_time), lastSlot: row.last_slot ? String(row.last_slot) : null, status: String(row.status) };
    if (!isDue(timing, today, nowTime)) continue;
    const [claim] = await pool.query('UPDATE report_schedules SET last_slot = ? WHERE id = ? AND (last_slot IS NULL OR last_slot <> ?)', [today, row.id, today]);
    if (Number((claim as { affectedRows?: number }).affectedRows ?? 0) !== 1) continue;
    await runSchedule(row, 'schedule', today);
    ran += 1;
  }
  return ran;
}
