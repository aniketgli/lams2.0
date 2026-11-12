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

// ---------------------------------------------------------------------------
// Leave Not Due (Rule 31) and Extraordinary Leave (Rule 32)
// ---------------------------------------------------------------------------

export const LND_CODE = 'LND';
export const EOL_CODE = 'EOL';
export const LND_LIFETIME_DAYS = 360;

/** The ground of a Leave Not Due: asked on the form (stored as its purpose). */
export const LND_GROUNDS = [
  'Illness, with a medical certificate',
  'TB / Leprosy / Cancer / Mental illness, with a medical certificate',
  'In continuation of Maternity Leave for child birth / adoption',
] as const;
const [LND_ILLNESS, LND_SERIOUS, LND_AFTER_MATERNITY] = LND_GROUNDS;

/** The ground of an Extraordinary Leave: it decides the limit for a temporary employee. */
export const EOL_GROUNDS = [
  'No other leave is admissible',
  'Other leave is admissible, but I apply for EOL in writing',
  'On a medical certificate',
  'Treatment in a recognised sanatorium (TB, tubercular pleurisy, leprosy, cancer, mental illness)',
  'Studies certified to be in public interest',
] as const;
const [, , EOL_MEDICAL, EOL_SANATORIUM, EOL_STUDIES] = EOL_GROUNDS;

/** LND and EOL take their purpose list from these rules, not from the Leave Types master. */
export function fixedPurposes(code: string, fromMaster: string[]): string[] {
  if (code === LND_CODE) return [...LND_GROUNDS];
  if (code === EOL_CODE) return [...EOL_GROUNDS];
  return fromMaster;
}

/** Whole months of service from the date of joining to `onDate`. */
export function serviceMonths(joining: string | null, onDate: string): number {
  if (!joining || joining > onDate) return 0;
  const [y1, m1, d1] = joining.split('-').map(Number);
  const [y2, m2, d2] = onDate.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export interface LndCase {
  permanent: boolean;
  serviceMonths: number;
  ground: string;
  hasCertificate: boolean;
  /** A birth / adoption Maternity Leave ends the day before this leave starts. */
  followsMaternity: boolean;
}

/** Field errors of a Leave Not Due application (empty when it is allowed). */
export function lndProblems(c: LndCase): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!c.permanent) {
    if (c.serviceMonths < 12) errors.leaveTypeId = 'Leave Not Due is for a temporary employee only after one year of service.';
    else if (c.ground !== LND_SERIOUS) errors.purpose = 'A temporary employee gets Leave Not Due only for TB, leprosy, cancer or mental illness.';
  }
  if (c.ground === LND_AFTER_MATERNITY) {
    if (!c.followsMaternity) errors.purpose = 'This Leave Not Due must start the day after a Maternity Leave for child birth / adoption ends.';
  } else if ((c.ground === LND_ILLNESS || c.ground === LND_SERIOUS) && !c.hasCertificate) {
    errors.certificate = 'Upload the medical certificate: Leave Not Due is given only on one.';
  }
  return errors;
}

/** Days from `from` to `to`, both counted. */
export const spanDays = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

export interface Spell { start: string; end: string; eol: boolean }

/**
 * The EOL spells that count as one continuous spell with the new one: leaves that follow each other without a gap,
 * of any kind ("two spells of EOL intervened by any other kind of leave are one continuous spell").
 */
export function continuousEol(others: readonly Spell[], spell: Spell): Spell[] {
  const all = [...others, spell].sort((a, b) => a.start.localeCompare(b.start));
  const next = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  // Grow the block from the new spell both ways while the leaves touch.
  let from = spell.start, to = spell.end, grew = true;
  const inBlock = new Set<Spell>([spell]);
  while (grew) {
    grew = false;
    for (const s of all) {
      if (inBlock.has(s)) continue;
      if (s.start <= next(to) && next(s.end) >= from) {
        inBlock.add(s); grew = true;
        if (s.start < from) from = s.start;
        if (s.end > to) to = s.end;
      }
    }
  }
  return [...inBlock].filter((s) => s.eol).sort((a, b) => a.start.localeCompare(b.start));
}

export interface EolCase {
  permanent: boolean;
  serviceMonths: number;
  ground: string;
  hasCertificate: boolean;
  /** The EOL spells of one continuous spell, the new one included (continuousEol). */
  spells: Spell[];
}

/** The longest EOL a case allows, in months (Infinity: no limit). */
export function eolLimitMonths(c: Pick<EolCase, 'permanent' | 'serviceMonths' | 'ground'>): { months: number; why: string } {
  if (c.permanent) return { months: 60, why: 'continuous absence of a permanent employee' };
  if (c.ground === EOL_SANATORIUM && c.serviceMonths >= 12) return { months: 18, why: 'sanatorium treatment, one year of service' };
  if (c.ground === EOL_STUDIES && c.serviceMonths >= 36) return { months: 24, why: 'studies in public interest, three years of service' };
  if (c.ground === EOL_MEDICAL && c.serviceMonths >= 12) return { months: 6, why: 'medical certificate, one year of service' };
  return { months: 3, why: 'a temporary employee on one occasion' };
}

/** Field errors of an Extraordinary Leave application (empty when it is allowed). */
export function eolProblems(c: EolCase): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!c.permanent) {
    if ((c.ground === EOL_MEDICAL || c.ground === EOL_SANATORIUM) && c.serviceMonths < 12) errors.purpose = 'This ground needs one year of continuous service. Choose another ground (up to 3 months).';
    if (c.ground === EOL_STUDIES && c.serviceMonths < 36) errors.purpose = 'EOL for studies needs three years of continuous service. Choose another ground (up to 3 months).';
  }
  if ((c.ground === EOL_MEDICAL || c.ground === EOL_SANATORIUM) && !c.hasCertificate) errors.certificate = 'Upload the medical certificate for this ground.';
  if (c.ground === EOL_STUDIES && !c.hasCertificate) errors.certificate = 'Upload the certificate that the studies are in public interest.';
  if (errors.purpose || !c.spells.length) return errors;
  const { months, why } = eolLimitMonths(c);
  const first = c.spells[0].start;
  const allowedEnd = addMonths(first, months);
  const days = c.spells.reduce((n, s) => n + spanDays(s.start, s.end), 0);
  const limit = spanDays(first, allowedEnd) - 1;
  if (days > limit) {
    const joined = c.spells.length > 1 ? ` (${c.spells.length} EOL spells joined by other leave count as one)` : '';
    errors.endDate = `EOL can be at most ${months} months at a stretch for ${why}: ${days} days asked${joined}, ${limit} allowed.`;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Rules built into the portal, shown with the leave type (Leave Types page)
// ---------------------------------------------------------------------------

/** Plain-language list of the rules the server checks for a leave type beyond its master settings. */
export function specialRulesOf(code: string): string[] {
  switch (code) {
    case PATERNITY_CODE:
      return [
        'Male employee with less than two surviving children.',
        `${PATERNITY_DAYS} days in one go for one birth / adoption: the To date is worked out from the From date (holidays included).`,
        `Birth: from ${PATERNITY_DAYS_BEFORE} days before up to ${PATERNITY_MONTHS_AFTER} months after the date of delivery. Adoption (child below one year): up to ${PATERNITY_MONTHS_AFTER} months after the date of adoption. Not taken in that time, it lapses.`,
        'At most 2 times in the whole service.',
        'Can be joined with any other kind of leave; may run across two leave years.',
      ];
    case MATERNITY_CODE:
      return [
        'Female employee.',
        `Birth / adoption (child below one year), with less than two surviving children: ${MATERNITY_DAYS} days in one go (To worked out, holidays included); adoption leave starts on the date of adoption.`,
        `Abortion / miscarriage: up to ${MATERNITY_LOSS_DAYS} days, after it has happened, on a medical certificate, once in the whole service.`,
        'Birth / adoption maternity leave can be joined with any other kind of leave; may run across two leave years.',
      ];
    case CHILD_CARE_CODE:
      return [
        'Female employee, for one of her two eldest surviving children below 18 years (any age for a child with a disability).',
        `At most ${CHILD_CARE_LIFETIME_DAYS} days in the whole service.`,
        `At most ${CHILD_CARE_SPELLS} spells in a calendar year (${CHILD_CARE_SPELLS_SINGLE_MOTHER} for a single mother).`,
        'Treated like Earned Leave: holidays inside it count.',
        'Only with prior approval: it cannot start today or earlier (the administrator can still enter one).',
      ];
    case LND_CODE:
      return [
        'Permanent employees; a temporary employee only after one year of service and only for TB, leprosy, cancer or mental illness.',
        'Only on a medical certificate, except in continuation of a Maternity Leave for child birth / adoption.',
        `At most ${LND_LIFETIME_DAYS} days in the whole service.`,
      ];
    case EOL_CODE:
      return [
        'Taken when no other leave is admissible, or when the employee applies for it in writing.',
        'Permanent employee: at most 5 years of continuous absence.',
        'Temporary employee: 3 months on one occasion; 6 months on a medical certificate and 18 months for treatment in a recognised sanatorium (after one year of service); 24 months for studies certified in public interest (after three years of service).',
        'EOL spells with other leave between them count as one continuous spell for these limits.',
      ];
    case 'C-OFF':
      return ['Each leave day is paid for by a weekly off or holiday on which the employee worked (biometric punches).'];
    case 'RH':
      return ['One day, chosen from the restricted holidays of the Holiday Calendar.'];
    default:
      return [];
  }
}
