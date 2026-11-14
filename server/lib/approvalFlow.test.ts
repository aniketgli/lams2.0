import { describe, expect, test } from 'bun:test';
import { INCREMENT, NOW, decide, moveStatus, undoProblem, undoTarget, type UndoCheck } from './approvalFlow';

describe('decide', () => {
  test('one-stage: pending to approved / rejected only', () => {
    expect(decide('one_stage', 'pending', 'approve', { stages: 1, byAdmin: false })?.to).toBe('approved');
    expect(decide('one_stage', 'pending', 'reject', { stages: 1, byAdmin: false })?.to).toBe('rejected');
    expect(decide('one_stage', 'approved', 'approve', { stages: 1, byAdmin: false })).toBeNull();
    expect(decide('one_stage', 'pending_l1', 'approve', { stages: 1, byAdmin: false })).toBeNull();
  });
  test('two-stage: the RM forwards, the HoD decides, an administrator is final', () => {
    expect(decide('two_stage', 'pending_l1', 'approve', { stages: 2, byAdmin: false })).toEqual({ to: 'pending_l2', outcome: 'forwarded', stage: 1 });
    expect(decide('two_stage', 'pending_l1', 'approve', { stages: 1, byAdmin: false })?.to).toBe('approved');
    expect(decide('two_stage', 'pending_l1', 'approve', { stages: 2, byAdmin: true })?.to).toBe('approved');
    expect(decide('two_stage', 'pending_l2', 'approve', { stages: 2, byAdmin: false })).toEqual({ to: 'approved', outcome: 'approved', stage: 2 });
    expect(decide('two_stage', 'pending_l2', 'reject', { stages: 2, byAdmin: false })).toEqual({ to: 'rejected', outcome: 'rejected', stage: 2 });
    expect(decide('two_stage', 'rejected', 'approve', { stages: 2, byAdmin: true })).toBeNull();
    expect(decide('two_stage', 'pending', 'approve', { stages: 2, byAdmin: true })).toBeNull();
  });
});

describe('undoTarget', () => {
  test('goes back one step', () => {
    expect(undoTarget('one_stage', 'approved', null)).toBe('pending');
    expect(undoTarget('one_stage', 'pending', null)).toBeNull();
    expect(undoTarget('two_stage', 'pending_l2', null)).toBe('pending_l1');
    expect(undoTarget('two_stage', 'approved', 2)).toBe('pending_l2');
    expect(undoTarget('two_stage', 'rejected', 1)).toBe('pending_l1');
    expect(undoTarget('two_stage', 'pending_l1', null)).toBeNull();
  });
});

describe('undoProblem', () => {
  const base: UndoCheck = { status: 'approved', ageSeconds: 30, viewerId: 5, isAdmin: false, isReporting: true, isReviewing: false, decidedStage: 1, actionBy: 5, forwardedBy: null, undoCount: 0, undo2Count: 0 };
  test('the reporting manager undoes their own step once, within 10 minutes', () => {
    expect(undoProblem(base)).toBeNull();
    expect(undoProblem({ ...base, undoCount: 1 })).toBe('once');
    expect(undoProblem({ ...base, ageSeconds: 601 })).toBe('expired');
    expect(undoProblem({ ...base, actionBy: 9 })).toBe('not_yours');
  });
  test('a forward counts as the reporting manager\'s one undo too', () => {
    const fwd = { ...base, status: 'pending_l2', decidedStage: null, actionBy: null, forwardedBy: 5 };
    expect(undoProblem(fwd)).toBeNull();
    expect(undoProblem({ ...fwd, undoCount: 1 })).toBe('once');
  });
  test('the HoD undoes their own stage-2 decision once', () => {
    const hod = { ...base, isReporting: false, isReviewing: true, decidedStage: 2 };
    expect(undoProblem(hod)).toBeNull();
    expect(undoProblem({ ...hod, undo2Count: 1 })).toBe('once');
    expect(undoProblem({ ...hod, decidedStage: 1 })).toBe('not_yours');
  });
  test('an administrator any step, but not after the window', () => {
    const admin = { ...base, isAdmin: true, isReporting: false, actionBy: 9, undoCount: 3 };
    expect(undoProblem(admin)).toBeNull();
    expect(undoProblem({ ...admin, ageSeconds: 700 })).toBe('expired');
    expect(undoProblem({ ...admin, status: 'pending_l1' })).toBe('nothing');
  });
});

describe('moveStatus', () => {
  test('changes the row only from the status that was read', async () => {
    const calls: Array<[string, unknown]> = [];
    const conn = { query: async (sql: string, v?: unknown) => { calls.push([sql, v]); return [{ affectedRows: 1 }]; } };
    await moveStatus(conn, 'leave_requests', 7, 'pending_l1', 'approved', { action_by: 3, action_at: NOW, undo_count: INCREMENT });
    expect(calls[0][0]).toBe('UPDATE leave_requests SET status = ?, action_by = ?, action_at = NOW(3), undo_count = undo_count + 1 WHERE id = ? AND status = ?');
    expect(calls[0][1]).toEqual(['approved', 3, 7, 'pending_l1']);
  });
  test('someone else got there first: 409', async () => {
    const conn = { query: async () => [{ affectedRows: 0 }] };
    await expect(moveStatus(conn, 'leave_requests', 7, 'pending_l1', 'approved')).rejects.toMatchObject({ status: 409 });
  });
});
