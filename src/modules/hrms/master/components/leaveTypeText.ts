/**
 * Plain-words text for a leave type, shared by the Leave Policy table and its "Rules" window.
 * Balances are always set by the Leave Balance Manager / Administrator, so the quota text
 * says how much the leave gives, never who sets it.
 */

export interface LeaveTypeTextInput {
  code: string;
  defaultQuota: number;
  pwdQuota: number | null;
  accrual: 'yearly' | 'half_yearly' | string;
  isDebited: boolean;
  isPaid: boolean;
  debitFromTypeId: string;
  debitFactor: number;
  lifetimeMax: number;
  maxConsecutiveDays: number;
  maxSpellsPerYear: number;
  minServiceMonths: number;
  approvalStages: 1 | 2;
  hodAfterDays: number;
  halfDayAllowed: boolean;
  combineWith: 'none' | 'single' | 'double' | 'both';
  carryForward: boolean;
  maxCarryForward: number;
  certificateRequired: boolean;
  medicalCertDays: number;
  offDaysOnly: boolean;
  purposes: string[];
  gender: 'all' | 'male_only' | 'female_only' | string;
  pwdOnly: boolean;
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** Leaves whose entitlement is not a yearly number: what they give, in the institute's words. */
const BY_CODE: Record<string, string> = {
  MAT: '180 days per child',
  PAT: '15 days per child',
  EOL: '3 to 60 months, as per service',
  'C-OFF': '1 day for each holiday worked',
  STN: 'Weekly offs and holidays only',
};

/** The main quota line, e.g. "30 days a year", "730 days in service", "No limit". */
export function quotaText(t: LeaveTypeTextInput, nameOf: (id: string) => string): string {
  if (t.isDebited && t.defaultQuota > 0) {
    return t.accrual === 'half_yearly'
      ? `${t.defaultQuota} days a year (${t.defaultQuota / 2} + ${t.defaultQuota / 2} half-yearly)`
      : `${days(t.defaultQuota)} a year`;
  }
  if (BY_CODE[t.code]) return BY_CODE[t.code];
  if (t.debitFromTypeId && t.lifetimeMax) return `${days(t.lifetimeMax)} in service, from ${nameOf(t.debitFromTypeId)}`;
  if (t.debitFromTypeId) return `Uses ${nameOf(t.debitFromTypeId)}${t.debitFactor !== 1 ? ` (${t.debitFactor} days for each day)` : ''}`;
  if (!t.isPaid) return 'No limit';
  if (t.lifetimeMax) return `${days(t.lifetimeMax)} in service`;
  if (t.maxSpellsPerYear) return `${t.maxSpellsPerYear} a year`;
  if (t.maxConsecutiveDays) return `Up to ${days(t.maxConsecutiveDays)} each time`;
  if (t.purposes.length) return 'As needed, for the listed purposes';
  return t.isDebited ? '0 days a year' : 'As needed';
}

/** The few rules people ask about first, shown at the top of the "Rules" window. */
export function keyRules(t: LeaveTypeTextInput, nameOf: (id: string) => string): { label: string; value: string }[] {
  const who = t.pwdOnly ? 'Persons with disability'
    : t.gender === 'female_only' ? 'Female employees' : t.gender === 'male_only' ? 'Male employees' : 'All in the leave group';
  return [
    { label: 'Quota', value: quotaText(t, nameOf) + (t.pwdQuota !== null && t.isDebited ? ` · PwD ${days(t.pwdQuota)}` : '') },
    { label: 'Approval', value: t.approvalStages === 2 ? `Reporting Manager → HoD${t.hodAfterDays ? ` (above ${days(t.hodAfterDays)})` : ''}` : 'Reporting Manager' },
    { label: 'Who', value: who + (t.minServiceMonths ? ` · after ${t.minServiceMonths} months` : '') },
    { label: 'Holidays inside', value: t.approvalStages === 2 ? 'Counted' : 'Not counted' },
    { label: 'Half day', value: t.halfDayAllowed ? 'Allowed' : 'Not allowed' },
    { label: 'Each time', value: t.maxConsecutiveDays ? `Up to ${days(t.maxConsecutiveDays)}` : 'No limit' },
    { label: 'Join with', value: t.combineWith === 'none' ? 'No other leave' : t.combineWith === 'both' ? 'Any leave' : `${t.combineWith === 'single' ? '1-stage' : '2-stage'} leaves only` },
    { label: 'Year end', value: !t.isDebited ? 'No balance' : t.carryForward ? `Carried forward${t.maxCarryForward ? ` (up to ${days(t.maxCarryForward)})` : ''}` : 'Lapses' },
    { label: 'Certificate', value: t.certificateRequired ? 'Always' : t.medicalCertDays ? `Above ${days(t.medicalCertDays)}` : 'Not needed' },
  ];
}
