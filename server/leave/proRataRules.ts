/**
 * Pro-rata leave quota for employees on a fixed term (Contract, Project staff, PhD scholars, Interns).
 *
 * Rules (decided with the administrator, Nov 2026):
 *  - The year's quota (e.g. CL20 = 20, CL30 = 30) is shared out by month: quota × months ÷ 12.
 *  - Every month the employee is valid in, even for a single day, counts as a full month.
 *  - The result is rounded to the nearest half day (6.67 → 6.5, 6.8 → 7).
 *  - Only months inside the leave year count (CY: Jan–Dec; FY: Apr–Mar).
 *  - Extension / reactivation adds only the months not credited before; leave already taken is untouched.
 *  - A new leave year credits active employees for the months up to their "Valid up to".
 * Pure functions, so they are unit-tested without a database.
 */
import { todayInIndia } from '../lib/validate';

export type Basis = 'CY' | 'FY';
export interface Span { from: string; to: string }

/** Employee form layouts that receive a pro-rata quota. */
export const PRO_RATA_LAYOUTS: ReadonlySet<string> = new Set(['contractual', 'researcher', 'phd_student', 'intern']);

/** First and last day of a leave year. `cycleYear` is the calendar year (CY) or the year the financial year starts (FY). */
export function leaveYearRange(cycleYear: number, basis: Basis): Span {
  return basis === 'FY'
    ? { from: `${cycleYear}-04-01`, to: `${cycleYear + 1}-03-31` }
    : { from: `${cycleYear}-01-01`, to: `${cycleYear}-12-31` };
}

/** The leave year a date falls in. */
export function cycleYearFor(date: string, basis: Basis): number {
  const year = Number(date.slice(0, 4));
  return basis === 'FY' && Number(date.slice(5, 7)) < 4 ? year - 1 : year;
}

/** "YYYY-MM" of every month touched by the span, limited to the leave year. */
export function monthsTouched(span: Span, year: Span): Set<string> {
  const from = span.from > year.from ? span.from : year.from;
  const to = span.to < year.to ? span.to : year.to;
  const out = new Set<string>();
  if (!from || !to || from > to) return out;
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.add(key);
    if (key === endKey) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** quota × months ÷ 12, rounded to the nearest half day. */
export function proRataDays(quota: number, months: number): number {
  if (!(quota > 0) || !(months > 0)) return 0;
  return Math.round(((quota * Math.min(months, 12)) / 12) * 2) / 2;
}

/** Days for the months of all spans together (a month counted once) inside one leave year. */
export function entitlement(quota: number, spans: Span[], year: Span): { months: number; days: number } {
  const months = new Set<string>();
  for (const s of spans) for (const k of monthsTouched(s, year)) months.add(k);
  return { months: months.size, days: proRataDays(quota, months.size) };
}

/**
 * Days to add when the valid periods of a leave year grow from `before` to `before + added`
 * (new employee: before = []; extension: the old validity; reactivation: the old validity, added = from the
 * reactivation day). Never negative: shortening a validity does not take days back.
 */
export function daysToAdd(quota: number, before: Span[], added: Span, year: Span): { days: number; monthsBefore: number; monthsAfter: number } {
  const was = entitlement(quota, before, year);
  const now = entitlement(quota, [...before, added], year);
  return { days: Math.max(0, now.days - was.days), monthsBefore: was.months, monthsAfter: now.months };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 2026 – Mar 2027" for the audit log. */
export function spanLabel(span: Span, year: Span): string {
  const months = [...monthsTouched(span, year)].sort();
  if (!months.length) return '—';
  const name = (k: string) => `${MONTH_NAMES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
  return months.length === 1 ? name(months[0]) : `${name(months[0])} – ${name(months[months.length - 1])}`;
}

export interface ProRataChange {
  /** Valid periods already credited (empty for a new employee). */
  before: Span[];
  /** The period being added. */
  added: Span;
  reason: string;
  /** Only credit leave types with no balance row yet for the year (the new-leave-year job). */
  onlyMissing?: boolean;
}

const DAY_MS = 86_400_000;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** New employee: the months from joining to "Valid up to". */
export function spanForNewEmployee(joining: string | null, validUpto: string | null, today = todayInIndia()): Span {
  return { from: joining || today, to: validUpto || '9999-12-31' };
}

/**
 * "Valid up to" moved from `oldTo` to `newTo`. Credited already: joining → old date. Added: the days after the old
 * date (from today when the account had expired, so the gap while it was expired earns nothing). Null when the
 * validity did not grow.
 */
export function spansForExtension(joining: string | null, oldTo: string | null, newTo: string | null, wasExpired: boolean, today = todayInIndia()): ProRataChange | null {
  if (!newTo || !oldTo || newTo <= oldTo) return null;
  const from = nextDay(oldTo);
  const start = wasExpired && today > from ? today : from;
  return { before: [{ from: joining || oldTo, to: oldTo }], added: { from: start, to: newTo }, reason: `"Valid up to" extended from ${oldTo} to ${newTo}` };
}

