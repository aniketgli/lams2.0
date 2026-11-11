/**
 * Rules of leave types that need more than dates and a balance:
 *
 *  - Purpose list: a leave type may list the purposes it can be taken for (one per line in the
 *    Leave Types master, e.g. Special Casual Leave: National sports / cultural event, Family planning,
 *    Natural calamity, Bandh). The apply form then asks for one of them and the server accepts only those.
 *
 *  - Paternity Leave (code PAT), for a male employee with less than two surviving children:
 *      birth of a child: from 15 days before up to 6 months after the date of delivery;
 *      adoption of a child less than one year old: up to 6 months after the date of adoption.
 *    At most 15 days for one birth / adoption. Not taken in that time, it lapses. It can be joined
 *    with any other kind of leave.
 *
 *  - Maternity Leave (code MAT), for a female employee:
 *      birth of a child / adoption of a child less than one year old, with less than two surviving children:
 *        180 days in one go (holidays included). An adoption leave starts on the date of adoption.
 *      abortion / miscarriage: up to 45 days, after it has happened, with a medical certificate, once in the
 *        whole service.
 *    Birth / adoption maternity leave can be joined with any other kind of leave.
 *
 *  - Child Care Leave (code CCL), for a female employee, for one of her two eldest surviving children below
 *    18 years (any age for a child with a disability): at most 730 days in the whole service, at most 3 spells
 *    in a calendar year (6 for a single mother), counted like Earned Leave (holidays inside count), only with
 *    prior approval (it cannot start today or in the past).
 *
 * Pure functions only (no database), so they are unit tested in specialLeave.test.ts.
 */

export const PATERNITY_CODE = 'PAT';
export const PATERNITY_DAYS = 15;
export const PATERNITY_DAYS_BEFORE = 15;
export const PATERNITY_MONTHS_AFTER = 6;
/** delivery / adoption: birth or adoption; loss: abortion / miscarriage (Maternity Leave); care: Child Care Leave. */
export const CHILD_EVENTS = ['delivery', 'adoption', 'loss', 'care'] as const;

export const MATERNITY_CODE = 'MAT';
export const MATERNITY_DAYS = 180;
export const MATERNITY_LOSS_DAYS = 45;
export const CHILD_CARE_CODE = 'CCL';
export const CHILD_CARE_LIFETIME_DAYS = 730;
export const CHILD_CARE_SPELLS = 3;
export const CHILD_CARE_SPELLS_SINGLE_MOTHER = 6;
export const CHILD_CARE_AGE_LIMIT = 18;
export type ChildEvent = (typeof CHILD_EVENTS)[number];

export const MAX_PURPOSES = 20;
export const MAX_PURPOSE_LENGTH = 150;

export interface ChildDetails {
  event: ChildEvent | null;
  /** Date of delivery (or the expected date when applied before it) / date of adoption. */
  eventDate: string | null;
  /** Adoption only: the child's date of birth. */
  birthDate: string | null;
  /** Surviving children before this child. */
  survivingChildren: number | null;
  /** Child Care Leave: 1 = eldest, 2 = second eldest surviving child. */
  childOrder?: 1 | 2 | null;
  /** Child Care Leave: the child has a disability (no age limit). */
  childDisabled?: boolean;
  /** Child Care Leave: the employee is a single mother (6 spells a year). */
  singleParent?: boolean;
}

/** The purpose list as stored (one per line), cleaned: trimmed, no blanks, no repeats. */
export function parsePurposes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const text = item.replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

/** Why a purpose list entered in the master cannot be saved, or null. */
export function purposesProblem(purposes: string[]): string | null {
  if (purposes.length > MAX_PURPOSES) return `Enter at most ${MAX_PURPOSES} purposes.`;
  if (purposes.some((p) => p.length > MAX_PURPOSE_LENGTH)) return `Each purpose can be at most ${MAX_PURPOSE_LENGTH} characters.`;
  return null;
}

/** The purpose as it will be stored: one of the list (matched ignoring case and spaces), or null when not allowed. */
export function matchPurpose(purposes: string[], chosen: string): string | null {
  const key = chosen.replace(/\s+/g, ' ').trim().toLowerCase();
  return purposes.find((p) => p.toLowerCase() === key) ?? null;
}

/** The same day n months later; the 31st becomes the last day of a shorter month. */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

const shift = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const dmy = (date: string) => `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}`;

/** Paternity Leave is taken in one go: the last day for a given first day (15 days, holidays included). */
export const paternityEnd = (startDate: string): string => shift(startDate, PATERNITY_DAYS - 1);

/** The dates a paternity leave for this birth / adoption must fall in. */
export function paternityWindow(child: Pick<ChildDetails, 'event' | 'eventDate'>): { from: string; to: string } | null {
  if (!child.event || !child.eventDate) return null;
  const from = child.event === 'delivery' ? shift(child.eventDate, -PATERNITY_DAYS_BEFORE) : child.eventDate;
  return { from, to: addMonths(child.eventDate, PATERNITY_MONTHS_AFTER) };
}

/** Field errors of a paternity leave application (empty when it is allowed). */
export function paternityProblems(child: ChildDetails, startDate: string, endDate: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!child.event) errors.childEvent = 'Choose: birth of a child or adoption.';
  if (!child.eventDate) errors.childEventDate = child.event === 'adoption' ? 'Enter the date of adoption.' : 'Enter the date of delivery (expected date if not yet).';
  if (child.survivingChildren === null) errors.survivingChildren = 'Enter the number of surviving children.';
  else if (child.survivingChildren >= 2) errors.survivingChildren = 'Paternity Leave is only for an employee with less than two surviving children.';
  if (child.event === 'adoption') {
    if (!child.birthDate) errors.childBirthDate = "Enter the child's date of birth.";
    else if (child.eventDate && child.birthDate > child.eventDate) errors.childBirthDate = 'The date of birth cannot be after the date of adoption.';
    else if (child.eventDate && child.eventDate >= addMonths(child.birthDate, 12)) errors.childBirthDate = 'The child must be less than one year old on the date of adoption.';
  }
  const window = paternityWindow(child);
  if (window && !errors.childEventDate) {
    if (startDate < window.from) {
      errors.startDate = child.event === 'delivery'
        ? `Paternity Leave can start at the earliest ${PATERNITY_DAYS_BEFORE} days before the date of delivery (${dmy(window.from)}).`
        : `Paternity Leave can start on or after the date of adoption (${dmy(window.from)}).`;
    }
    if (endDate > window.to) {
      errors.endDate = `Paternity Leave must end by ${dmy(window.to)} (${PATERNITY_MONTHS_AFTER} months from the date of ${child.event === 'delivery' ? 'delivery' : 'adoption'}). After that it lapses.`;
    }
  }
  return errors;
}

/** Why `days` more cannot be taken for this birth / adoption when `taken` days are already applied for, or null. */
export function paternityDaysProblem(taken: number, days: number): string | null {
  if (taken + days <= PATERNITY_DAYS) return null;
  const left = Math.max(0, PATERNITY_DAYS - taken);
  return `Paternity Leave is ${PATERNITY_DAYS} days for one birth / adoption: ${taken} already applied for, ${left} left.`;
}

// ---------------------------------------------------------------------------
// Maternity Leave
// ---------------------------------------------------------------------------

/** Birth / adoption maternity leave is taken in one go: the last day for a given first day (180 days, holidays included). */
export const maternityEnd = (startDate: string): string => shift(startDate, MATERNITY_DAYS - 1);

const daysIn = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

/** Field errors of a maternity leave application (empty when it is allowed). `today` for the abortion / miscarriage date. */
export function maternityProblems(child: ChildDetails, startDate: string, endDate: string, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (child.event !== 'delivery' && child.event !== 'adoption' && child.event !== 'loss') {
    errors.childEvent = 'Choose: birth of a child, adoption of a child, or abortion / miscarriage.';
    return errors;
  }
  if (!child.eventDate) {
    errors.childEventDate = child.event === 'adoption' ? 'Enter the date of adoption.' : child.event === 'loss' ? 'Enter the date of the abortion / miscarriage.' : 'Enter the date of delivery (expected date if not yet).';
  }
  if (child.event === 'loss') {
    if (child.eventDate && child.eventDate > today) errors.childEventDate = 'This leave is given after the abortion / miscarriage has happened.';
    else if (child.eventDate && startDate < child.eventDate) errors.startDate = `The leave can start on or after the date of the abortion / miscarriage (${dmy(child.eventDate)}).`;
    if (daysIn(startDate, endDate) > MATERNITY_LOSS_DAYS) errors.endDate = `Maternity Leave for abortion / miscarriage is at most ${MATERNITY_LOSS_DAYS} days.`;
    return errors;
  }
  if (child.survivingChildren === null) errors.survivingChildren = 'Enter the number of surviving children.';
  else if (child.survivingChildren >= 2) errors.survivingChildren = 'Maternity Leave is only for an employee with less than two surviving children.';
  if (child.event === 'adoption') {
    if (!child.birthDate) errors.childBirthDate = "Enter the child's date of birth.";
    else if (child.eventDate && child.birthDate > child.eventDate) errors.childBirthDate = 'The date of birth cannot be after the date of adoption.';
    else if (child.eventDate && child.eventDate >= addMonths(child.birthDate, 12)) errors.childBirthDate = 'The child must be less than one year old on the date of adoption.';
    if (child.eventDate && startDate !== child.eventDate) errors.startDate = `Maternity Leave on adoption starts on the date of adoption (${dmy(child.eventDate)}).`;
  }
  return errors;
}

/** Why `days` more cannot be taken for this birth / adoption when `taken` days are already applied for, or null. */
export function maternityDaysProblem(taken: number, days: number): string | null {
  if (taken + days <= MATERNITY_DAYS) return null;
  return `Maternity Leave is ${MATERNITY_DAYS} days for one birth / adoption: ${taken} already applied for, ${Math.max(0, MATERNITY_DAYS - taken)} left.`;
}

// ---------------------------------------------------------------------------
// Child Care Leave
// ---------------------------------------------------------------------------

/** Field errors of a child care leave application (empty when it is allowed). */
export function childCareProblems(child: ChildDetails, startDate: string, today: string, isAdmin: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (child.childOrder !== 1 && child.childOrder !== 2) errors.childOrder = 'Child Care Leave is for the two eldest surviving children only: choose which one.';
  if (!child.birthDate) errors.childBirthDate = "Enter the child's date of birth.";
  else if (child.birthDate > startDate) errors.childBirthDate = 'The date of birth cannot be after the start of the leave.';
  else if (!child.childDisabled && startDate >= addMonths(child.birthDate, CHILD_CARE_AGE_LIMIT * 12)) {
    errors.childBirthDate = `The child is ${CHILD_CARE_AGE_LIMIT} or older on the first day of leave. (There is no age limit for a child with a disability.)`;
  }
  if (!isAdmin && startDate <= today) errors.startDate = 'Child Care Leave needs approval before it starts: choose a date after today.';
  return errors;
}

/** Spells allowed in a calendar year. */
export const childCareSpells = (singleParent: boolean | undefined): number => (singleParent ? CHILD_CARE_SPELLS_SINGLE_MOTHER : CHILD_CARE_SPELLS);
