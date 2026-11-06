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
 * Pure functions only (no database), so they are unit tested in specialLeave.test.ts.
 */

export const PATERNITY_CODE = 'PAT';
export const PATERNITY_DAYS = 15;
export const PATERNITY_DAYS_BEFORE = 15;
export const PATERNITY_MONTHS_AFTER = 6;
export const CHILD_EVENTS = ['delivery', 'adoption'] as const;
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
