/**
 * Which dates a list (Attendance, Manual Attendance, Outdoor Duty, Leave) may show, and what it shows at first.
 *
 *   Administrator   any date in the past (one request is still limited in length by each list)
 *   everyone else   from 1 January of last year: this year and last year only
 *
 * Default range:  Attendance → this month;  Manual Attendance / OD / Leave → this year (1 Jan – 31 Dec).
 * The same rules are in src/shared/services/dateWindow.ts for the date pickers; the server is what enforces them.
 */

const year = (today: string) => Number(today.slice(0, 4));
const pad = (n: number) => String(n).padStart(2, '0');

export const yearStart = (today: string) => `${year(today)}-01-01`;
export const yearEnd = (today: string) => `${year(today)}-12-31`;
export const monthStart = (today: string) => `${today.slice(0, 7)}-01`;
export function monthEnd(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** The oldest date this role may ask for, or null for no limit (administrator). */
export function earliestViewable(role: string | null | undefined, today: string): string | null {
  return role === 'administrator' ? null : `${year(today) - 1}-01-01`;
}

/** Why a range starting on `from` is not allowed for this role, or null. */
export function historyProblem(role: string | null | undefined, from: string, today: string): string | null {
  const earliest = earliestViewable(role, today);
  if (!earliest || from >= earliest) return null;
  const [y, m, d] = earliest.split('-');
  return `You can see this year and last year only: choose a date from ${d}-${m}-${y} onwards.`;
}
