import { weekdayOf } from '../attendance/compute';

/**
 * Which leaves may be taken straight before or after another one.
 * A leave type says which kinds it can be joined with: none, only 1-stage leaves
 * (Reporting Manager approves), only 2-stage leaves (HoD approves) or both.
 * Two leaves are straight when no working day on which the employee punched lies between them:
 * weekends, holidays and days without a punch do not break the chain.
 */

export const COMBINES = ['none', 'single', 'double', 'both'] as const;
export type Combine = (typeof COMBINES)[number];

export const toCombine = (raw: unknown): Combine => (COMBINES as readonly string[]).includes(String(raw)) ? (String(raw) as Combine) : 'both';

/** Whether a leave type with this setting may be joined with a leave of `stages` approval stages. */
export const allowsStages = (combine: Combine, stages: 1 | 2): boolean =>
  combine === 'both' || (combine === 'single' && stages === 1) || (combine === 'double' && stages === 2);

export interface CombinePolicy { id: number; name: string; stages: 1 | 2; combineWith: Combine }
export interface Neighbour extends CombinePolicy { start: string; end: string }

const shift = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** How far from the new leave the search for a straight leave goes (days). */
export const LOOK_DAYS = 45;

/**
 * The first problem of joining the new leave [start, end] with the employee's other leaves, or null.
 * `others` are the employee's other pending / approved leaves; `worked` the dates with a punch.
 */
export function combineProblem(
  policy: CombinePolicy, start: string, end: string, others: Neighbour[],
  workingDays: readonly string[], gazetted: ReadonlySet<string>, worked: ReadonlySet<string>,
): string | null {
  const isWorking = (d: string) => workingDays.includes(weekdayOf(d)) && !gazetted.has(d);
  const find = (from: string, step: 1 | -1): Neighbour | null => {
    for (let i = 0, d = from; i < LOOK_DAYS; i++, d = shift(d, step)) {
      const leave = others.find((o) => o.start <= d && d <= o.end);
      if (leave) return leave;
      if (isWorking(d) && worked.has(d)) return null; // a day at work: the leaves are not straight
    }
    return null;
  };
  const before = find(shift(start, -1), -1);
  const after = find(shift(end, 1), 1);
  for (const [other, where] of [[before, 'straight after'], [after, 'straight before']] as const) {
    if (!other || other.id === policy.id) continue;
    if (allowsStages(policy.combineWith, other.stages) && allowsStages(other.combineWith, policy.stages)) continue;
    return `${policy.name} cannot be taken ${where} ${other.name} (${other.start === other.end ? other.start : `${other.start} to ${other.end}`}). The employee must work at least one day, with a punch, in between.`;
  }
  return null;
}
