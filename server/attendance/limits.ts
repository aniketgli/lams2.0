/** How much attendance one request may ask for (pure rules, no database). */

/** Longest range for one employee (a whole year). */
export const MAX_RANGE_DAYS_ONE = 366;
/** Longest range when more than one employee is shown. */
export const MAX_RANGE_DAYS = 93;
/** Most employee-days one request may build; bigger asks must be narrowed (the whole answer is held in memory and sent as JSON). */
export const MAX_EMPLOYEE_DAYS = 100_000;

/** Checks the size of an answer before it is built: many employees over a long range would overload the server and the browser. */
export function sizeProblem(employees: number, days: number): string | null {
  if (employees > 1 && days > MAX_RANGE_DAYS) return `For more than one employee choose a range of at most ${MAX_RANGE_DAYS} days, or pick a single employee for up to ${MAX_RANGE_DAYS_ONE} days.`;
  if (employees * days > MAX_EMPLOYEE_DAYS) return `That is ${(employees * days).toLocaleString('en-IN')} employee-days; at most ${MAX_EMPLOYEE_DAYS.toLocaleString('en-IN')} can be shown at once. Choose fewer employees or a shorter range.`;
  return null;
}
