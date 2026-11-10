/**
 * Which dates the Attendance, Manual Attendance, Outdoor Duty and Leave lists open on, and how far back each role
 * may look (the same rules as server/lib/dateWindow.ts, which enforces them):
 *   Attendance → this month;  Manual Attendance / OD / Leave → this year (1 Jan – 31 Dec).
 *   Administrator: any past date;  everyone else: from 1 January of last year.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Today in the browser's time zone, YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const yearStart = (today = todayLocal()) => `${today.slice(0, 4)}-01-01`;
export const yearEnd = (today = todayLocal()) => `${today.slice(0, 4)}-12-31`;
export const monthStart = (today = todayLocal()) => `${today.slice(0, 7)}-01`;
export function monthEnd(today = todayLocal()): string {
  const [y, m] = today.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
}

/** The oldest date this role may pick, or undefined for no limit (administrator). */
export function earliestViewable(role: string | null | undefined, today = todayLocal()): string | undefined {
  return role === 'administrator' ? undefined : `${Number(today.slice(0, 4)) - 1}-01-01`;
}
