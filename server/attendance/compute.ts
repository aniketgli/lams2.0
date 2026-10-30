/**
 * Daily attendance from biometric punches (pure functions, no database).
 *
 * One employee, one date:
 *   - the first punch of the day is In, the last punch is Out (the machine's
 *     Direction column is not trusted);
 *   - hours worked = Out − In, compared with the employee's shift;
 *   - no punch on a working day = Absent; gazetted holidays and the shift's
 *     non-working days are off days (a punch on one = "working on" that day).
 */

export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface Punch {
  /** HH:mm:ss */
  time: string;
  /** Registered machine name (short name). */
  device: string;
}

export interface ShiftRule {
  code: string;
  name: string;
  /** HH:mm */
  start: string;
  end: string;
  graceMins: number;
  halfDayHours: number;
  fullDayHours: number;
  /** In at or before this time counts as the first half; HH:mm. */
  halfDayCutoff: string;
  /** 'Mon' … 'Sun' */
  workingDays: string[];
}

export type DayStatus = 'PP' | 'AA' | 'PA' | 'AP' | 'WW' | 'WW#' | 'GH' | 'HH#';

export interface DayRecord {
  date: string;
  /** HH:mm, null when there is no punch. */
  clockIn: string | null;
  /** HH:mm, null when there is only one punch. */
  clockOut: string | null;
  totalHours: number | null;
  punches: number;
  status: DayStatus;
  workMode: 'in_office' | 'absent';
  shiftCode: string;
  lateByMins: number;
  earlyByMins: number;
  devices: string[];
  remark: string;
}

/** Minutes since midnight for "HH:mm" or "HH:mm:ss". */
export function toMinutes(time: string): number {
  const [h, m, s] = time.split(':').map(Number);
  return h * 60 + (m || 0) + (s || 0) / 60;
}

const hhmm = (time: string) => time.slice(0, 5);

export function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEK_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Dates from `from` to `to` inclusive (YYYY-MM-DD). */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 400; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (iso > to) break;
    out.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Shift values with sensible defaults when the master leaves them empty. */
export function shiftRule(row: {
  code: string; name: string; startTime: string; endTime: string; gracePeriodMins?: number | null;
  halfDayHours?: number | null; fullDayHours?: number | null; halfDayCutoffTime?: string | null; applicableDays?: unknown;
}): ShiftRule {
  const start = hhmm(row.startTime || '09:30');
  const end = hhmm(row.endTime || '18:00');
  const span = Math.max(1, (toMinutes(end) - toMinutes(start)) / 60);
  const full = Number(row.fullDayHours) > 0 ? Number(row.fullDayHours) : span;
  const half = Number(row.halfDayHours) > 0 ? Number(row.halfDayHours) : full / 2;
  const mid = Math.round((toMinutes(start) + toMinutes(end)) / 2);
  const cutoff = row.halfDayCutoffTime ? hhmm(row.halfDayCutoffTime)
    : `${String(Math.floor(mid / 60)).padStart(2, '0')}:${String(mid % 60).padStart(2, '0')}`;
  let days: unknown = row.applicableDays;
  if (typeof days === 'string') { try { days = JSON.parse(days); } catch { days = []; } }
  const workingDays = Array.isArray(days) && days.length ? days.map(String) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return {
    code: row.code, name: row.name, start, end,
    graceMins: Math.max(0, Number(row.gracePeriodMins) || 0),
    halfDayHours: half, fullDayHours: full, halfDayCutoff: cutoff, workingDays,
  };
}

export interface DayContext {
  date: string;
  punches: Punch[];
  shift: ShiftRule;
  /** Gazetted holiday name on this date, if any. */
  holiday: string | null;
  /** Today's date and the current time (HH:mm) in India. */
  today: string;
  nowTime: string;
}

/** The day's record, or null when nothing should be shown yet (a future date, or today before the shift has started). */
export function buildDay(ctx: DayContext): DayRecord | null {
  const { date, shift, holiday, today } = ctx;
  if (date > today) return null;
  const isToday = date === today;
  const now = toMinutes(ctx.nowTime);
  const offDay = holiday !== null || !shift.workingDays.includes(weekdayOf(date));
  const base = { date, shiftCode: shift.code, lateByMins: 0, earlyByMins: 0 };

  const punches = [...ctx.punches].sort((a, b) => a.time.localeCompare(b.time));
  if (punches.length === 0) {
    const empty = { ...base, clockIn: null, clockOut: null, totalHours: null, punches: 0, workMode: 'absent' as const, devices: [] };
    if (holiday !== null) return { ...empty, status: 'GH', remark: holiday };
    if (offDay) return { ...empty, status: 'WW', remark: '' };
    if (isToday && now < toMinutes(shift.start) + shift.graceMins) return null;
    return { ...empty, status: 'AA', remark: isToday && now < toMinutes(shift.end) ? 'No punch yet' : '' };
  }

  const first = punches[0].time;
  const last = punches[punches.length - 1].time;
  // Repeated taps within a minute are one punch.
  const hasOut = toMinutes(last) - toMinutes(first) >= 1;
  const clockIn = hhmm(first);
  const clockOut = hasOut ? hhmm(last) : null;
  const totalHours = hasOut ? Math.round(((toMinutes(last) - toMinutes(first)) / 60) * 100) / 100 : null;
  const lateByMins = Math.max(0, Math.floor(toMinutes(first) - toMinutes(shift.start) - shift.graceMins));
  const earlyByMins = hasOut ? Math.max(0, Math.floor(toMinutes(shift.end) - toMinutes(last))) : 0;
  const devices = [...new Set(punches.map((p) => p.device).filter(Boolean))];
  const notes: string[] = [];
  const dayInProgress = isToday && now < toMinutes(shift.end);

  let status: DayStatus;
  if (offDay) {
    status = holiday !== null ? 'HH#' : 'WW#';
    if (holiday) notes.push(holiday);
  } else if (dayInProgress) {
    status = 'PP';
    notes.push('Day in progress');
  } else {
    const firstHalf = toMinutes(first) <= toMinutes(shift.halfDayCutoff);
    if (!hasOut) {
      status = firstHalf ? 'PA' : 'AP';
      notes.push('Out punch missing');
    } else if (totalHours! >= shift.fullDayHours) {
      status = 'PP';
    } else if (totalHours! >= shift.halfDayHours) {
      status = firstHalf ? 'PA' : 'AP';
    } else {
      status = 'AA';
      notes.push(`Worked ${totalHours}h`);
    }
  }
  if (!offDay && lateByMins > 0) notes.push(`Late by ${lateByMins} min`);
  if (!offDay && !dayInProgress && earlyByMins > 0) notes.push(`Left ${earlyByMins} min early`);

  return {
    ...base, clockIn, clockOut, totalHours, punches: punches.length, status, workMode: 'in_office',
    lateByMins: offDay ? 0 : lateByMins, earlyByMins: offDay || dayInProgress ? 0 : earlyByMins, devices, remark: notes.join(' · '),
  };
}

/** Machine codes like "317" and "0317" are the same employee. */
export function normalizeEmployeeCode(code: unknown): string {
  const text = String(code ?? '').trim();
  if (!/^\d+$/.test(text)) return text.toUpperCase();
  const stripped = text.replace(/^0+/, '') || '0';
  return stripped.padStart(4, '0');
}
