import type { RowDataPacket } from 'mysql2/promise';
import { approvedLeaveDays } from '../leave/requests';
import { pool } from '../../src/db';
import { HttpError, badRequest } from '../lib/http';
import { isValidIsoDate, todayInIndia } from '../lib/validate';
import type { RoleId } from '../lib/roles';
import { DayRecord, Punch, ShiftRule, buildDay, datesBetween, normalizeEmployeeCode, shiftRule, toMinutes, weekdayOf } from './compute';

/**
 * Attendance read from the biometric punch log (table `Attendance`), which the machine
 * software fills. The portal never writes to that table.
 *
 * Who sees whom: administrators and auditors everyone; reporting managers /
 * HoDs (while acting in that role) themselves and the people under them;
 * everyone else only themselves.
 */

export interface AttendanceViewer { id: number; role: RoleId | null }

export interface AttendanceRow extends DayRecord {
  userId: string;
  biometricId: string;
}

export interface AttendanceResult {
  from: string;
  to: string;
  /** False when no active attendance machine is registered (nothing can be counted). */
  machinesConfigured: boolean;
  records: AttendanceRow[];
  /** Shifts the records refer to (code, name, timings). */
  shifts: { code: string; name: string; startTime: string; endTime: string }[];
}

/** Longest range one request may ask for. */
export const MAX_RANGE_DAYS = 93;

async function rows(sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await pool.query<RowDataPacket[]>(sql, params);
  return result;
}

const dateText = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear(), m = value.getMonth() + 1, d = value.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const text = String(value).slice(0, 10);
  return isValidIsoDate(text) ? text : null;
};

function profileData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function nowTimeInIndia(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export function parseRange(query: { from?: unknown; to?: unknown }, today = todayInIndia()): { from: string; to: string } {
  const from = String(query.from ?? today);
  const to = String(query.to ?? from);
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw badRequest('Dates must be in YYYY-MM-DD format.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if (datesBetween(from, to).length > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

interface ScopedEmployee { userId: string; biometricId: string; joining: string | null; validUpto: string | null; shiftId: string | null }

async function employeesInScope(viewer: AttendanceViewer, onlyUserId: string | null): Promise<ScopedEmployee[]> {
  const found = await rows(
    `SELECT u.id, u.biometric_id, u.status, u.valid_upto, p.joining_date, p.shift_id, p.profile_data
       FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE LOWER(u.status) = 'active'`,
  );
  const all = viewer.role === 'administrator' || viewer.role === 'audit';
  const manager = viewer.role === 'reporting_manager' || viewer.role === 'reviewing_manager';
  return found
    .filter((r) => {
      if (onlyUserId && String(r.id) !== onlyUserId) return false;
      if (all || Number(r.id) === viewer.id) return true;
      if (!manager) return false;
      const data = profileData(r.profile_data);
      return String(data.reportingManagerId ?? '') === String(viewer.id) || String(data.reviewingManagerId ?? '') === String(viewer.id);
    })
    .map((r) => ({
      userId: String(r.id),
      biometricId: normalizeEmployeeCode(r.biometric_id),
      joining: dateText(r.joining_date),
      validUpto: dateText(r.valid_upto),
      shiftId: r.shift_id ? String(r.shift_id) : null,
    }));
}

async function attendanceMachines(): Promise<Map<string, string>> {
  const found = await rows(
    "SELECT serial_number, short_name FROM biometric_machines WHERE UPPER(status) = 'ACTIVE' AND UPPER(purpose) IN ('ATTENDANCE', 'BOTH')",
  );
  return new Map(found.map((m) => [String(m.serial_number).trim().toUpperCase(), String(m.short_name)]));
}

async function shiftRules(): Promise<{ byId: Map<string, ShiftRule>; fallback: ShiftRule }> {
  const found = await rows(
    'SELECT id, code, name, start_time, end_time, grace_period_mins, half_day_hours, full_day_hours, half_day_cutoff_time, applicable_days, is_default, status FROM shifts ORDER BY is_default DESC, id',
  );
  const byId = new Map<string, ShiftRule>();
  for (const s of found) {
    byId.set(String(s.id), shiftRule({
      code: String(s.code), name: String(s.name), startTime: String(s.start_time), endTime: String(s.end_time),
      gracePeriodMins: s.grace_period_mins, halfDayHours: s.half_day_hours, fullDayHours: s.full_day_hours,
      halfDayCutoffTime: s.half_day_cutoff_time, applicableDays: s.applicable_days,
    }));
  }
  const def = found.find((s) => s.is_default && String(s.status).toLowerCase() !== 'inactive') ?? found[0];
  const fallback = def ? byId.get(String(def.id))! : shiftRule({ code: 'GEN', name: 'General', startTime: '09:30', endTime: '18:00' });
  return { byId, fallback };
}

async function gazettedHolidays(from: string, to: string): Promise<Map<string, string>> {
  try {
    const found = await rows(
      "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d, name FROM holidays WHERE type = 'gazetted' AND holiday_date BETWEEN ? AND ?",
      [from, to],
    );
    return new Map(found.map((h) => [String(h.d), String(h.name)]));
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return new Map();
    throw error;
  }
}

/** Punches by employee code, then by date. Only registered attendance machines count. */
async function loadPunches(from: string, to: string, machines: Map<string, string>, codes: string[] | null): Promise<Map<string, Map<string, Punch[]>>> {
  const out = new Map<string, Map<string, Punch[]>>();
  if (machines.size === 0 || (codes && codes.length === 0)) return out;
  // Each code is tried as stored and without leading zeros ("0317" / "317").
  const variants = codes ? [...new Set(codes.flatMap((c) => [c, c.replace(/^0+/, '') || '0']))] : null;
  let found: RowDataPacket[];
  try {
    found = await rows(
      `SELECT EmployeeCode, DATE_FORMAT(LogDate, '%Y-%m-%d') AS d, DATE_FORMAT(LogDateTime, '%H:%i:%s') AS t, DeviceSR
         FROM Attendance
        WHERE LogDate BETWEEN ? AND ?${variants ? ` AND EmployeeCode IN (${variants.map(() => '?').join(', ')})` : ''}`,
      [from, to, ...(variants ?? [])],
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
      throw new HttpError(503, 'Biometric attendance is not set up yet. Ask the administrator to run the attendance migration.', 'NOT_CONFIGURED');
    }
    throw error;
  }
  for (const r of found) {
    const device = machines.get(String(r.DeviceSR ?? '').trim().toUpperCase());
    if (device === undefined) continue; // not a registered attendance machine
    const code = normalizeEmployeeCode(r.EmployeeCode);
    const byDate = out.get(code) ?? new Map<string, Punch[]>();
    const list = byDate.get(String(r.d)) ?? [];
    list.push({ time: String(r.t), device });
    byDate.set(String(r.d), list);
    out.set(code, byDate);
  }
  return out;
}

/** Approved manual attendance: user id → date → requested In / Out. A missing table means none. */
async function approvedManual(from: string, to: string): Promise<Map<string, Map<string, { inTime: string; outTime: string }>>> {
  const out = new Map<string, Map<string, { inTime: string; outTime: string }>>();
  try {
    const found = await rows(
      "SELECT user_id, DATE_FORMAT(att_date, '%Y-%m-%d') AS d, in_time, out_time FROM manual_attendance_requests WHERE status = 'approved' AND att_date BETWEEN ? AND ?",
      [from, to],
    );
    for (const r of found) {
      const byDate = out.get(String(r.user_id)) ?? new Map();
      byDate.set(String(r.d), { inTime: String(r.in_time), outTime: String(r.out_time) });
      out.set(String(r.user_id), byDate);
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

/** Approved outdoor duty: user id → date → location, for every date in the range. A missing table means none. */
async function approvedOutdoorDuty(from: string, to: string, onlyUserId: string | null = null): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  try {
    const found = await rows(
      `SELECT user_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS s, DATE_FORMAT(end_date, '%Y-%m-%d') AS e, location FROM outdoor_duty_requests
        WHERE status = 'approved' AND start_date <= ? AND end_date >= ?${onlyUserId ? ' AND user_id = ?' : ''}`,
      [to, from, ...(onlyUserId ? [onlyUserId] : [])],
    );
    for (const r of found) {
      const byDate = out.get(String(r.user_id)) ?? new Map<string, string>();
      for (const date of datesBetween(String(r.s) < from ? from : String(r.s), String(r.e) > to ? to : String(r.e))) byDate.set(date, String(r.location));
      out.set(String(r.user_id), byDate);
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

/** Dates in the range on which the employee is on approved outdoor duty. */
export async function outdoorDutyDates(userId: string, from: string, to: string): Promise<Set<string>> {
  return new Set((await approvedOutdoorDuty(from, to, userId)).get(userId)?.keys() ?? []);
}

/** What the biometric machines recorded for one day: the In and Out punch, each null when missing. */
export interface PunchDay { date: string; in: string | null; out: string | null }

/**
 * One punch is In when it falls in the first half of the shift (at or before the
 * half-day cutoff), otherwise it is the Out punch. Two or more punches (a minute or
 * more apart) are In (first) and Out (last).
 */
function classifyPunches(times: string[], shift: ShiftRule): { in: string | null; out: string | null } {
  const list = [...times].sort();
  if (list.length === 0) return { in: null, out: null };
  const first = list[0].slice(0, 5);
  const last = list[list.length - 1].slice(0, 5);
  if (toMinutes(list[list.length - 1]) - toMinutes(list[0]) >= 1) return { in: first, out: last };
  return toMinutes(first) <= toMinutes(shift.halfDayCutoff) ? { in: first, out: null } : { in: null, out: first };
}

async function shiftFor(shiftId: string | null): Promise<ShiftRule> {
  const shifts = await shiftRules();
  return (shiftId && shifts.byId.get(shiftId)) || shifts.fallback;
}

/** The biometric In / Out of one employee on one date (both null when nothing was recorded or the log is unavailable). */
export async function biometricDay(biometricId: string, shiftId: string | null, date: string): Promise<PunchDay> {
  const [machines, shift] = await Promise.all([attendanceMachines(), shiftFor(shiftId)]);
  const code = normalizeEmployeeCode(biometricId);
  try {
    const punches = await loadPunches(date, date, machines, [code]);
    return { date, ...classifyPunches((punches.get(code)?.get(date) ?? []).map((p) => p.time), shift) };
  } catch (error) {
    if (error instanceof HttpError) return { date, in: null, out: null };
    throw error;
  }
}

/**
 * Working days from `to` backwards (latest first) on which the In and / or Out punch is
 * missing. Weekly offs, gazetted holidays and days before joining are left out.
 */
export async function punchGaps(emp: { biometricId: string; shiftId: string | null; joining: string | null }, from: string, to: string): Promise<PunchDay[]> {
  const [machines, shift, holidays] = await Promise.all([attendanceMachines(), shiftFor(emp.shiftId), gazettedHolidays(from, to)]);
  const code = normalizeEmployeeCode(emp.biometricId);
  const punches = await loadPunches(from, to, machines, [code]);
  const out: PunchDay[] = [];
  for (const date of datesBetween(from, to).reverse()) {
    if (emp.joining && date < emp.joining) continue;
    if (holidays.has(date) || !shift.workingDays.includes(weekdayOf(date))) continue;
    const day = classifyPunches((punches.get(code)?.get(date) ?? []).map((p) => p.time), shift);
    if (day.in === null || day.out === null) out.push({ date, ...day });
  }
  return out;
}

export async function listAttendance(viewer: AttendanceViewer, query: { from?: unknown; to?: unknown; userId?: unknown }): Promise<AttendanceResult> {
  const today = todayInIndia();
  const { from, to } = parseRange(query, today);
  const onlyUserId = query.userId ? String(query.userId) : null;
  if (onlyUserId && !/^\d{1,20}$/.test(onlyUserId)) throw badRequest('Invalid employee.');

  const [employees, machines, shifts, holidays, manual, od, leave] = await Promise.all([
    employeesInScope(viewer, onlyUserId), attendanceMachines(), shiftRules(), gazettedHolidays(from, to), approvedManual(from, to), approvedOutdoorDuty(from, to),
    approvedLeaveDays(from, to, onlyUserId),
  ]);
  const everyone = viewer.role === 'administrator' || viewer.role === 'audit';
  const punches = await loadPunches(from, to, machines, everyone && !onlyUserId ? null : employees.map((e) => e.biometricId));

  const nowTime = nowTimeInIndia();
  const dates = datesBetween(from, to);
  const records: AttendanceRow[] = [];
  for (const emp of employees) {
    const shift = (emp.shiftId && shifts.byId.get(emp.shiftId)) || shifts.fallback;
    const mine = punches.get(emp.biometricId);
    for (const date of dates) {
      if (emp.joining && date < emp.joining) continue;
      if (emp.validUpto && date > emp.validUpto) continue;
      // An approved manual attendance request counts as an In and an Out punch (device "Manual").
      const approved = manual.get(emp.userId)?.get(date);
      const dayPunches = [...(mine?.get(date) ?? []), ...(approved ? [{ time: `${approved.inTime}:00`, device: 'Manual' }, { time: `${approved.outTime}:00`, device: 'Manual' }] : [])];
      const day = buildDay({ date, punches: dayPunches, shift, holiday: holidays.get(date) ?? null, today, nowTime });
      if (day) {
        // Approved outdoor duty marks a working day as OD, whatever the punches say; off days stay as they are.
        const odPlace = od.get(emp.userId)?.get(date);
        const onDuty = odPlace !== undefined && ['PP', 'PA', 'AP', 'AA'].includes(day.status);
        // Approved leave marks an unattended working day as LV (a half-day leave only adds a remark); punches always win.
        const away = leave.get(emp.userId)?.get(date);
        const onLeave = !onDuty && away !== undefined && !away.half && day.status === 'AA';
        const shaped = onDuty ? { ...day, status: 'OD' as const, workMode: 'field_od' as const, lateByMins: 0, earlyByMins: 0, remark: `Outdoor duty · ${odPlace}` }
          : onLeave ? { ...day, status: 'LV' as const, workMode: 'on_leave' as const, lateByMins: 0, earlyByMins: 0, remark: `Leave · ${away!.code}` }
          : away && !onDuty && ['PP', 'PA', 'AP', 'AA'].includes(day.status) ? { ...day, remark: `${away.half ? 'Half-day leave' : 'Leave'} · ${away.code}` }
          : day;
        records.push({ ...shaped, userId: emp.userId, biometricId: emp.biometricId });
      }
    }
  }
  const usedShifts = new Map<string, ShiftRule>();
  for (const emp of employees) {
    const shift = (emp.shiftId && shifts.byId.get(emp.shiftId)) || shifts.fallback;
    usedShifts.set(shift.code, shift);
  }
  return {
    from, to, machinesConfigured: machines.size > 0, records,
    shifts: [...usedShifts.values()].map((sh) => ({ code: sh.code, name: sh.name, startTime: sh.start, endTime: sh.end })),
  };
}
