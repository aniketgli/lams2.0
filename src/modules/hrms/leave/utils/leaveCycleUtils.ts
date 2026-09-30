import { User } from '../../../../shared/types/auth.types';

export type CadreAccountingCycle = 'CY' | 'FY';

/**
 * Cadre classification under CCS (Leave) Rules & Central Autonomous Body norms:
 * - Calendar Year (CY: Jan 1 - Dec 31): Permanent, Deputation, Trainees
 * - Financial Year (FY: Apr 1 - Mar 31): Contractual, Researchers, Interns, Students
 */
export const CY_CADRE_TYPES = ['permanent', 'deputation', 'diploma_trainee', 'trainee'];

export function isCalendarYearCadre(employmentType?: string): boolean {
  if (!employmentType) return true;
  return CY_CADRE_TYPES.includes(employmentType);
}

export function getCadreCycleType(employmentType?: string): CadreAccountingCycle {
  return isCalendarYearCadre(employmentType) ? 'CY' : 'FY';
}

/**
 * Robust helper to determine whether an employee's leaves are Calendar Year or Financial Year based.
 * Checks explicit user settings first, then falls back to employment cadre.
 */
export function getUserLeaveCycleType(
  user?: Partial<User> | null,
  fallbackEmploymentType?: string
): CadreAccountingCycle {
  if (user) {
    if (user.leaveCycle === 'CY' || user.leaveCycleBasis === 'calendar_year') {
      return 'CY';
    }
    if (user.leaveCycle === 'FY' || user.leaveCycleBasis === 'financial_year') {
      return 'FY';
    }
    if (user.employmentType) {
      return isCalendarYearCadre(user.employmentType) ? 'CY' : 'FY';
    }
  }
  if (fallbackEmploymentType) {
    return isCalendarYearCadre(fallbackEmploymentType) ? 'CY' : 'FY';
  }
  return 'CY';
}

/**
 * Returns formatted cycle label, e.g. "CY 2026" or "FY 2026-27"
 */
export function getAccountingCycleLabel(
  employmentTypeOrUser?: string | Partial<User>,
  referenceYear: number | string = new Date().getFullYear()
): string {
  const yr = typeof referenceYear === 'string' ? parseInt(referenceYear, 10) || new Date().getFullYear() : referenceYear;
  const isCY = typeof employmentTypeOrUser === 'object'
    ? getUserLeaveCycleType(employmentTypeOrUser) === 'CY'
    : isCalendarYearCadre(employmentTypeOrUser);

  if (isCY) {
    return `CY ${yr}`;
  }
  const nextYrShort = (yr + 1).toString().slice(-2);
  return `FY ${yr}-${nextYrShort}`;
}

/**
 * Detailed metadata for badges and explanatory subtitles
 */
export function getAccountingCycleMeta(
  employmentTypeOrUser?: string | Partial<User>,
  referenceYear: number | string = new Date().getFullYear()
): {
  cycleType: CadreAccountingCycle;
  badgeLabel: string;
  periodText: string;
  ruleSetText: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
} {
  const yr = typeof referenceYear === 'string' ? parseInt(referenceYear, 10) || new Date().getFullYear() : referenceYear;
  const isCY = typeof employmentTypeOrUser === 'object'
    ? getUserLeaveCycleType(employmentTypeOrUser) === 'CY'
    : isCalendarYearCadre(employmentTypeOrUser);

  if (isCY) {
    return {
      cycleType: 'CY',
      badgeLabel: `CY ${yr}`,
      periodText: `01 Jan ${yr} – 31 Dec ${yr}`,
      ruleSetText: 'CCS Leave Rules 1972 (Half-yearly advance credit on 1 Jan & 1 Jul)',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200/90'
    };
  }

  const nextYrShort = (yr + 1).toString().slice(-2);
  return {
    cycleType: 'FY',
    badgeLabel: `FY ${yr}-${nextYrShort}`,
    periodText: `01 Apr ${yr} – 31 Mar ${yr + 1}`,
    ruleSetText: 'Institutional Project Guidelines & GFR Norms (Annual Grant Basis)',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200/90'
  };
}

/**
 * Cycle filter options for Admin and Manager dropdown
 */
export interface CycleOption {
  value: string;
  label: string;
  group: 'all' | 'CY' | 'FY';
  cadre: string;
  dateRangeText: string;
}

export const LEAVE_CYCLE_OPTIONS: CycleOption[] = [
  {
    value: 'all',
    label: 'All Cycles (Both CY & FY)',
    group: 'all',
    cadre: 'All Cadres',
    dateRangeText: 'Full Institutional Overview'
  },
  // Calendar Year Options (Regular / Deputation / Trainee)
  {
    value: 'CY-2026',
    label: 'CY 2026 (Jan – Dec 2026) • Current Active',
    group: 'CY',
    cadre: 'Permanent / Deputation / Trainee',
    dateRangeText: '2026-01-01 to 2026-12-31'
  },
  {
    value: 'CY-2025',
    label: 'CY 2025 (Jan – Dec 2025)',
    group: 'CY',
    cadre: 'Permanent / Deputation / Trainee',
    dateRangeText: '2025-01-01 to 2025-12-31'
  },
  {
    value: 'CY-2024',
    label: 'CY 2024 (Jan – Dec 2024)',
    group: 'CY',
    cadre: 'Permanent / Deputation / Trainee',
    dateRangeText: '2024-01-01 to 2024-12-31'
  },
  {
    value: 'CY-2027',
    label: 'CY 2027 (Jan – Dec 2027)',
    group: 'CY',
    cadre: 'Permanent / Deputation / Trainee',
    dateRangeText: '2027-01-01 to 2027-12-31'
  },
  // Financial Year Options (Contractual / Researchers / Interns)
  {
    value: 'FY-2026-27',
    label: 'FY 2026-27 (Apr 2026 – Mar 2027) • Current Active',
    group: 'FY',
    cadre: 'Contractual / Researcher / Project Staff',
    dateRangeText: '2026-04-01 to 2027-03-31'
  },
  {
    value: 'FY-2025-26',
    label: 'FY 2025-26 (Apr 2025 – Mar 2026)',
    group: 'FY',
    cadre: 'Contractual / Researcher / Project Staff',
    dateRangeText: '2025-04-01 to 2026-03-31'
  },
  {
    value: 'FY-2024-25',
    label: 'FY 2024-25 (Apr 2024 – Mar 2025)',
    group: 'FY',
    cadre: 'Contractual / Researcher / Project Staff',
    dateRangeText: '2024-04-01 to 2025-03-31'
  },
  {
    value: 'FY-2027-28',
    label: 'FY 2027-28 (Apr 2027 – Mar 2028)',
    group: 'FY',
    cadre: 'Contractual / Researcher / Project Staff',
    dateRangeText: '2027-04-01 to 2028-03-31'
  }
];

/**
 * Returns options strictly matching the user's cadre / leave cycle:
 * - If user is Calendar Year based: returns ONLY CY options
 * - If user is Financial Year based: returns ONLY FY options
 */
export function getCyclesForUser(
  user?: Partial<User> | null,
  fallbackEmploymentType?: string
): CycleOption[] {
  const cycle = getUserLeaveCycleType(user, fallbackEmploymentType);
  return LEAVE_CYCLE_OPTIONS.filter((opt) => opt.group === cycle);
}

/**
 * Checks if a given leave record falls into the selected cycle
 */
export function matchesCycleFilter(
  leaveStartDate: string,
  leaveEndDate: string,
  selectedCycle: string,
  userEmploymentType?: string
): boolean {
  if (!selectedCycle || selectedCycle === 'all') return true;

  // If user selected a legacy plain year (e.g., "2026")
  if (!selectedCycle.includes('-')) {
    const startYr = leaveStartDate ? leaveStartDate.substring(0, 4) : '';
    const endYr = leaveEndDate ? leaveEndDate.substring(0, 4) : '';
    return startYr === selectedCycle || endYr === selectedCycle;
  }

  // Calendar Year Filter (e.g. "CY-2026")
  if (selectedCycle.startsWith('CY-')) {
    const targetYr = selectedCycle.replace('CY-', '');
    const cyStart = `${targetYr}-01-01`;
    const cyEnd = `${targetYr}-12-31`;

    // Must overlap with calendar year
    const overlaps = leaveStartDate <= cyEnd && leaveEndDate >= cyStart;
    if (!overlaps) return false;

    // Cadre match: if userEmploymentType is available, verify it belongs to CY cadre
    if (userEmploymentType) {
      return isCalendarYearCadre(userEmploymentType);
    }
    return true;
  }

  // Financial Year Filter (e.g. "FY-2026-27")
  if (selectedCycle.startsWith('FY-')) {
    const parts = selectedCycle.replace('FY-', '').split('-');
    const startYr = parts[0];
    const endYrPrefix = startYr.slice(0, 2);
    const endYr = `${endYrPrefix}${parts[1]}`;

    const fyStart = `${startYr}-04-01`;
    const fyEnd = `${endYr}-03-31`;

    const overlaps = leaveStartDate <= fyEnd && leaveEndDate >= fyStart;
    if (!overlaps) return false;

    if (userEmploymentType) {
      return !isCalendarYearCadre(userEmploymentType);
    }
    return true;
  }

  return true;
}
