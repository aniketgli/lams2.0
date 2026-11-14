import { HttpError } from './http';

/**
 * The one approval state machine behind leave requests, joining reports, manual attendance and outdoor duty.
 *
 *   One-stage  (manual attendance, outdoor duty):  pending ──approve──▶ approved
 *                                                   pending ──reject───▶ rejected
 *   Two-stage  (leave, joining report):             pending_l1 ──forward (RM of a 2-stage item)──▶ pending_l2
 *                                                   pending_l1 ──approve (1-stage item, or admin)──▶ approved
 *                                                   pending_l2 ──approve──▶ approved
 *                                                   pending_l1 / pending_l2 ──reject──▶ rejected
 *   Undo, within UNDO_WINDOW_MINUTES of the step:   pending_l2 → pending_l1;  approved / rejected → the stage they were decided at.
 *
 * Every store asks this module for the next status and moves the row with `moveStatus`, which changes it only if
 * it is still in the status that was read, so two people acting at once cannot both win.
 */

export type FlowStatus = 'pending' | 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';
export type Flow = 'one_stage' | 'two_stage';
export type Outcome = 'approved' | 'forwarded' | 'rejected';

/** A step (approve, forward, reject) can be undone only for a short time after it was taken. */
export const UNDO_WINDOW_MINUTES = 10;

export const isPending = (status: string): boolean => status === 'pending' || status === 'pending_l1' || status === 'pending_l2';
export const isDecided = (status: string): boolean => status === 'approved' || status === 'rejected';
/** The status a new (or resubmitted) item starts in. */
export const startStatus = (flow: Flow): FlowStatus => (flow === 'one_stage' ? 'pending' : 'pending_l1');

/** The stage an item is waiting at: 1 (reporting manager) or 2 (HoD). */
export const stageOf = (status: string): 1 | 2 => (status === 'pending_l2' ? 2 : 1);

/**
 * Where a decision takes the item, or null when the item is not waiting for one.
 * `stages` is how many approvals the item needs (1 or 2); an administrator's approval is always final.
 */
export function decide(flow: Flow, from: string, action: 'approve' | 'reject', opts: { stages: 1 | 2; byAdmin: boolean }): { to: FlowStatus; outcome: Outcome; stage: 1 | 2 } | null {
  if (!isPending(from)) return null;
  if (flow === 'one_stage' && from !== 'pending') return null;
  if (flow === 'two_stage' && from === 'pending') return null;
  const stage = stageOf(from);
  if (action === 'reject') return { to: 'rejected', outcome: 'rejected', stage };
  if (flow === 'two_stage' && stage === 1 && opts.stages === 2 && !opts.byAdmin) return { to: 'pending_l2', outcome: 'forwarded', stage };
  return { to: 'approved', outcome: 'approved', stage };
}

/** Where an undo takes the item back to, or null when there is nothing to undo. */
export function undoTarget(flow: Flow, from: string, decidedStage: number | null): FlowStatus | null {
  if (flow === 'one_stage') return isDecided(from) ? 'pending' : null;
  if (from === 'pending_l2') return 'pending_l1';
  if (isDecided(from)) return Number(decidedStage) === 2 ? 'pending_l2' : 'pending_l1';
  return null;
}

/** `ageSeconds` is how long ago the step was taken, measured by the database clock. */
export function withinUndoWindow(ageSeconds: unknown): boolean {
  if (ageSeconds === null || ageSeconds === undefined || ageSeconds === '') return false;
  const age = Number(ageSeconds);
  return Number.isFinite(age) && age >= 0 && age <= UNDO_WINDOW_MINUTES * 60;
}

export interface UndoCheck {
  status: string;
  /** Seconds since the last step (approve / forward / reject). */
  ageSeconds: unknown;
  viewerId: number;
  isAdmin: boolean;
  /** The viewer is this employee's reporting manager (acting in that role). */
  isReporting: boolean;
  /** The viewer is this employee's HoD / reviewing manager (acting in that role). */
  isReviewing: boolean;
  decidedStage: number | null;
  actionBy: number | null;
  /** Who forwarded it to the HoD (two-stage only). */
  forwardedBy: number | null;
  undoCount: number;
  undo2Count: number;
}

/**
 * Who may undo a step: an administrator any step; the reporting manager their own stage-1 step, once;
 * the HoD their own stage-2 decision, once. Nobody after UNDO_WINDOW_MINUTES.
 */
export function undoProblem(c: UndoCheck): 'nothing' | 'expired' | 'once' | 'not_yours' | null {
  if (!isDecided(c.status) && c.status !== 'pending_l2') return 'nothing';
  if (!withinUndoWindow(c.ageSeconds)) return 'expired';
  if (c.isAdmin) return null;
  const decidedAt1 = isDecided(c.status) && Number(c.decidedStage ?? 1) !== 2;
  if (c.isReporting) {
    const own = (decidedAt1 && c.actionBy === c.viewerId) || (c.status === 'pending_l2' && c.forwardedBy === c.viewerId);
    if (!own) return 'not_yours';
    return c.undoCount < 1 ? null : 'once';
  }
  if (c.isReviewing) {
    const own = isDecided(c.status) && Number(c.decidedStage) === 2 && c.actionBy === c.viewerId;
    if (!own) return 'not_yours';
    return c.undo2Count < 1 ? null : 'once';
  }
  return 'not_yours';
}

export const UNDO_MESSAGES: Record<NonNullable<ReturnType<typeof undoProblem>>, string> = {
  nothing: 'There is no step to undo.',
  expired: `A step can be undone only within ${UNDO_WINDOW_MINUTES} minutes of it being taken.`,
  once: 'You have already undone a step on this request once.',
  not_yours: 'You cannot undo this step.',
};

/** Throws the right error for an undo that is not allowed. */
export function assertUndo(c: UndoCheck): void {
  const problem = undoProblem(c);
  if (!problem) return;
  if (problem === 'nothing') throw new HttpError(409, UNDO_MESSAGES.nothing, 'NOT_DECIDED');
  if (problem === 'expired') throw new HttpError(409, UNDO_MESSAGES.expired, 'UNDO_EXPIRED');
  throw new HttpError(403, UNDO_MESSAGES[problem], 'FORBIDDEN');
}

/** Placeholders for `moveStatus`: set the column to the database's current time / add one to it. */
export const NOW = Symbol('NOW');
export const INCREMENT = Symbol('INCREMENT');

type Conn = { query: (sql: string, values?: unknown) => Promise<unknown> };

/**
 * Moves one row from `from` to `to`, setting the other columns in `set` too. The row changes only if it is still in
 * `from`; otherwise someone else got there first and the caller gets a 409.
 */
export async function moveStatus(conn: Conn, table: string, id: number | string, from: string, to: FlowStatus, set: Record<string, unknown> = {}): Promise<void> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Bad table name: ${table}`);
  const cols = Object.keys(set);
  if (cols.some((c) => !/^[a-z0-9_]+$/.test(c))) throw new Error('Bad column name.');
  const parts = cols.map((c) => (set[c] === NOW ? `${c} = NOW(3)` : set[c] === INCREMENT ? `${c} = ${c} + 1` : `${c} = ?`));
  const values = cols.filter((c) => set[c] !== NOW && set[c] !== INCREMENT).map((c) => set[c]);
  const [result] = (await conn.query(
    `UPDATE ${table} SET status = ?${parts.length ? `, ${parts.join(', ')}` : ''} WHERE id = ? AND status = ?`,
    [to, ...values, id, from],
  )) as [{ affectedRows?: number }];
  if (!result || !result.affectedRows) {
    throw new HttpError(409, 'Someone else has just acted on this. Refresh the page and try again.', 'STATUS_CHANGED');
  }
}
