/** Pure compensatory-off rules (no database access). */
export const COMP_OFF_CODE = 'C-OFF';

const MS_DAY = 86_400_000;
export const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_DAY).toISOString().slice(0, 10);

/** The same day next month (the last day of a shorter month), plus one day. */
export function creditValidUntil(workDate: string): string {
  const [y, m, d] = workDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m, 1)); // first of next month
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const sameDay = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
  return shift(sameDay, 1);
}

/**
 * Not taken within the month, a worked day can still be taken up to the end of the next calendar month after that
 * (CCS rules: "in the subsequent calendar month ... a maximum of two compensatory off", with permission).
 */
export function creditLateUntil(workDate: string): string {
  const [y, m] = creditValidUntil(workDate).split('-').map(Number);
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10); // last day of the month after
}

/** At most this many late compensatory offs (taken after the month) in one calendar month. */
export const LATE_COMP_OFF_PER_MONTH = 2;

export interface Credit {
  date: string; in: string; out: string; hours: number; reason: string; validUntil: string;
  /** Last day it can be taken late (after validUntil, at most 2 such a month). */
  lateUntil?: string;
  /** The leave request that uses it, when one does. */
  usedBy: number | null; usedStatus: 'pending' | 'approved' | null;
}

/** The balance shown for the compensatory off: valid credits, and how many of them are taken or waiting for approval. */
export function balanceFromCredits(credits: Credit[]) {
  const total = credits.length;
  const used = credits.filter((c) => c.usedStatus === 'approved').length;
  const pending = credits.filter((c) => c.usedStatus === 'pending').length;
  return { total, carryForward: 0, used, pending, available: total - used - pending };
}

export interface Pair { work: string; leave: string; /** Taken after the month: counts towards 2 a month. */ late?: boolean }

/**
 * Matches the chosen worked days to the leave days, earliest with earliest. Every chosen day must be an unused credit,
 * and each leave day must fall after the worked day that pays for it and within its validity.
 * (Several days at once are allowed; the monthly limit is checked separately.)
 */
export function matchCredits(credits: Credit[], chosen: string[], leaveDays: string[]): { problem: string | null; pairs: Pair[] } {
  const none = { problem: null as string | null, pairs: [] as Pair[] };
  const picks = [...new Set(chosen)].sort();
  if (picks.length === 0) return { ...none, problem: 'Choose the days you worked on a weekly off or holiday.' };
  if (picks.length !== chosen.length) return { ...none, problem: 'The same worked day is chosen twice.' };
  const mine = picks.map((d) => credits.find((c) => c.date === d));
  if (mine.some((c) => !c)) return { ...none, problem: 'One of the chosen days is not a worked weekly off or holiday that can still be taken.' };
  if (mine.some((c) => c!.usedBy !== null)) return { ...none, problem: 'One of the chosen days is already used.' };
  if (picks.length !== leaveDays.length) return { ...none, problem: `The leave is for ${leaveDays.length} day(s); choose exactly ${leaveDays.length} worked day(s) (${picks.length} chosen).` };
  const days = [...leaveDays].sort();
  const pairs: Pair[] = [];
  for (let i = 0; i < picks.length; i++) {
    const c = mine[i]!;
    if (days[i] <= c.date) return { ...none, problem: `Take ${days[i]} after the day you worked (${c.date}).` };
    const lateUntil = c.lateUntil ?? c.validUntil;
    if (days[i] > lateUntil) return { ...none, problem: `The day worked on ${c.date} could be taken up to ${lateUntil}; it has lapsed for ${days[i]}.` };
    pairs.push({ work: c.date, leave: days[i], late: days[i] > c.validUntil });
  }
  return { problem: null, pairs };
}

/**
 * Late compensatory offs per month (of the leave day): taken already + this leave must stay within the limit.
 * Within a month of the worked day there is no limit, so only late days are passed in.
 */
export function monthlyProblem(leaveDays: string[], takenByMonth: Record<string, number>, limit: number): string | null {
  if (!limit) return null;
  const add: Record<string, number> = {};
  for (const d of leaveDays) add[d.slice(0, 7)] = (add[d.slice(0, 7)] ?? 0) + 1;
  for (const [month, n] of Object.entries(add).sort()) {
    const before = takenByMonth[month] ?? 0;
    if (before + n > limit) return `A compensatory off not taken within a month of the day worked: at most ${limit} in a calendar month. ${before} already taken or waiting in ${month}, ${n} asked.`;
  }
  return null;
}

export const RESTRICTED_CODE = 'RH';
