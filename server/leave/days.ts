import { datesBetween, weekdayOf } from '../attendance/compute';

/**
 * Leave days, worked out on the server. Never typed by the user.
 *   sandwichRule 'excluded' : weekly offs and gazetted holidays inside the leave do not count
 *   sandwichRule 'included' : every calendar day counts
 * A half day removes 0.5: the first day may start after lunch, the last day may end before lunch.
 */

export const SESSIONS_START = ['full', 'second_half'] as const;
export const SESSIONS_END = ['full', 'first_half'] as const;

export interface DayRule {
  sandwich: 'included' | 'excluded';
  /** Working weekdays of the employee's shift, e.g. ['Mon', 'Tue', …]. */
  workingDays: readonly string[];
  /** Gazetted holiday dates (YYYY-MM-DD). */
  gazetted: ReadonlySet<string>;
}

export function countLeaveDays(
  start: string, end: string, startSession: (typeof SESSIONS_START)[number], endSession: (typeof SESSIONS_END)[number], rule: DayRule,
): { days: number; counted: string[] } {
  const counted = datesBetween(start, end).filter((d) =>
    rule.sandwich === 'included' || (rule.workingDays.includes(weekdayOf(d)) && !rule.gazetted.has(d)));
  let days = counted.length;
  if (counted.includes(start) && startSession === 'second_half') days -= 0.5;
  if (counted.includes(end) && endSession === 'first_half') days -= 0.5;
  return { days, counted };
}

/** Year of the leave cycle a date belongs to: the calendar year (CY), or the year the financial year starts (FY). */
export function cycleYearOf(date: string, basis: 'CY' | 'FY'): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return basis === 'FY' && month < 4 ? year - 1 : year;
}
