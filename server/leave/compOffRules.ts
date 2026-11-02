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

export interface Credit {
  date: string; in: string; out: string; hours: number; reason: string; validUntil: string;
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

/**
 * Whether the chosen credit can be taken on this leave date. One credit is one full day.
 * (The monthly limit is enforced by the common "times a month" rule of the leave type.)
 */
export function creditProblem(credit: Credit | undefined, leaveStart: string, leaveEnd: string, days: number): string | null {
  if (!credit) return 'Choose a day you worked on a weekly off or holiday.';
  if (credit.usedBy !== null) return 'This compensatory off is already used.';
  if (leaveStart !== leaveEnd || days !== 1) return 'One compensatory off is for a single full day.';
  if (leaveStart <= credit.date) return `Take it after the day you worked (${credit.date}).`;
  if (leaveStart > credit.validUntil) return `This compensatory off is valid up to ${credit.validUntil}.`;
  return null;
}
