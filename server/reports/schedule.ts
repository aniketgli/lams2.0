import { Validator, isValidIsoDate } from '../lib/validate';

/**
 * Rules for a report schedule, kept free of the database so they can be tested alone.
 * Times are Indian time. A schedule fires once per occurrence day: daily every day, weekly on its weekday,
 * monthly on its day of the month (1 to 28, so every month has it).
 */

export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FORMATS = ['csv', 'pdf'] as const;
export type ReportFormat = (typeof FORMATS)[number];
export const RECIPIENT_ROLES = ['administrator', 'audit', 'reviewing_manager', 'reporting_manager', 'general_staff'] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];
export const MAX_RECIPIENTS = 200;

export interface ScheduleInput {
  name: string;
  reportKey: string;
  frequency: Frequency;
  weekday: number | null;
  monthDay: number | null;
  sendTime: string;
  formats: ReportFormat[];
  userIds: number[];
  roles: RecipientRole[];
  status: 'active' | 'paused';
}

export function parseScheduleInput(body: unknown, reportKeys: readonly string[]): ScheduleInput {
  const v = new Validator(body);
  const name = v.string('name', { min: 3, max: 120 });
  const reportKey = v.oneOf('reportKey', reportKeys) ?? '';
  const frequency = v.oneOf('frequency', FREQUENCIES) ?? 'daily';
  const sendTime = v.string('sendTime', { pattern: /^([01]\d|2[0-3]):[0-5]\d$/, patternMessage: 'Choose a time of day.' });
  const weekday = frequency === 'weekly' ? v.int('weekday', { min: 1, max: 7 }) : null;
  const monthDay = frequency === 'monthly' ? v.int('monthDay', { min: 1, max: 28 }) : null;
  const status = v.oneOf('status', ['active', 'paused'] as const, false) ?? 'active';

  const raw = (body ?? {}) as Record<string, unknown>;
  const formats = [...new Set(Array.isArray(raw.formats) ? raw.formats : [])] as string[];
  if (!formats.length) v.errors.formats = 'Choose CSV, PDF or both.';
  else if (formats.some((f) => !(FORMATS as readonly string[]).includes(f))) v.errors.formats = 'Choose CSV, PDF or both.';

  const idsRaw = Array.isArray(raw.userIds) ? raw.userIds : [];
  const userIds = [...new Set(idsRaw.map((x) => Number(x)))];
  if (userIds.some((n) => !Number.isInteger(n) || n < 1)) v.errors.recipients = 'One of the chosen people is not valid.';
  const rolesRaw = Array.isArray(raw.roles) ? raw.roles : [];
  const roles = [...new Set(rolesRaw.map(String))] as string[];
  if (roles.some((r) => !(RECIPIENT_ROLES as readonly string[]).includes(r))) v.errors.recipients = 'One of the chosen roles is not valid.';
  if (!v.errors.recipients && !userIds.length && !roles.length) v.errors.recipients = 'Choose at least one person or role to send it to.';
  if (userIds.length + roles.length > MAX_RECIPIENTS) v.errors.recipients = `Choose at most ${MAX_RECIPIENTS} recipients.`;

  v.assert();
  return {
    name, reportKey, frequency, weekday, monthDay, sendTime,
    formats: formats as ReportFormat[], userIds, roles: roles as RecipientRole[], status,
  };
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export interface Timing { frequency: string; weekday: number | null; monthDay: number | null; sendTime: string; lastSlot: string | null; status: string }

/** Does this schedule occur on `date`? */
export function occursOn(t: Pick<Timing, 'frequency' | 'weekday' | 'monthDay'>, date: string): boolean {
  if (!isValidIsoDate(date)) return false;
  if (t.frequency === 'daily') return true;
  if (t.frequency === 'weekly') return t.weekday === isoWeekday(date);
  if (t.frequency === 'monthly') return t.monthDay === Number(date.slice(8, 10));
  return false;
}

/** Due when it occurs today, its time has come, and today's occurrence has not been handled yet (a late start still sends the same day). */
export function isDue(t: Timing, today: string, nowTime: string): boolean {
  return t.status === 'active' && occursOn(t, today) && t.sendTime <= nowTime && t.lastSlot !== today;
}

/** The days a report covers when it runs on `slot`: daily = yesterday, weekly = the 7 days before today, monthly = the previous calendar month. */
export function periodFor(frequency: string, slot: string): { from: string; to: string } {
  if (frequency === 'weekly') return { from: addDays(slot, -7), to: addDays(slot, -1) };
  if (frequency === 'monthly') {
    const firstOfThis = `${slot.slice(0, 8)}01`;
    const to = addDays(firstOfThis, -1);
    return { from: `${to.slice(0, 8)}01`, to };
  }
  const y = addDays(slot, -1);
  return { from: y, to: y };
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "Every day at 09:00", "Every Monday at 09:00", "On the 1st of every month at 09:00". */
export function describeTiming(t: Pick<Timing, 'frequency' | 'weekday' | 'monthDay' | 'sendTime'>): string {
  const at = `${t.sendTime} IST`;
  if (t.frequency === 'weekly' && t.weekday) return `Every ${WEEKDAYS[t.weekday - 1]} at ${at}`;
  if (t.frequency === 'monthly' && t.monthDay) return `On the ${ordinal(t.monthDay)} of every month at ${at}`;
  return `Every day at ${at}`;
}
