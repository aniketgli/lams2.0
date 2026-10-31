import { expect, test, mock, describe, beforeEach } from 'bun:test';
let grp: any[]; let links: any[]; let audits: any[]; let nextId: number; let counts: Record<string, number>;
const query = async (q: string, p: any[] = []) => {
  q = q.replace(/\s+/g, ' ');
  if (q.includes('INSERT INTO master_audit_logs')) { audits.push({ key: p[0], action: p[3], label: p[2], reason: p[7] }); return [{}]; }
  if (q.startsWith("SELECT id FROM leave_types WHERE status = 'active'")) return [[{ id: 1 }, { id: 2 }, { id: 3 }]];
  if (q.startsWith("SELECT id, code, name FROM leave_types WHERE status = 'active'")) return [[{ id: 1, code: 'CL', name: 'Casual Leave' }]];
  if (q.startsWith('INSERT INTO leave_groups')) {
    if (grp.some((g) => g.code === p[0])) throw Object.assign(new Error('d'), { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry for key 'uq_leave_groups_code'" });
    grp.push({ id: nextId, code: p[0], name: p[1], leave_year: p[2], status: p[3], updated_at: new Date() }); return [{ insertId: nextId++ }];
  }
  if (q.startsWith('DELETE FROM leave_group_types')) { links = links.filter((l) => l.group_id !== p[0]); return [{}]; }
  if (q.startsWith('INSERT INTO leave_group_types')) { links.push({ group_id: p[0], leave_type_id: p[1] }); return [{}]; }
  if (q.startsWith('DELETE FROM leave_groups')) { grp = grp.filter((g) => g.id !== p[0]); return [{}]; }
  if (q.startsWith('SELECT id FROM leave_groups WHERE id = ? FOR UPDATE')) return [grp.filter((g) => g.id === p[0])];
  if (q.startsWith('UPDATE leave_groups SET')) { const g = grp.find((x) => x.id === p[4])!; Object.assign(g, { code: p[0], name: p[1], leave_year: p[2], status: p[3] }); return [{}]; }
  if (q.includes('FROM leave_group_types g JOIN leave_types t')) return [links.filter((l) => p.includes(l.group_id)).map((l) => ({ group_id: l.group_id, id: l.leave_type_id, code: 'C' + l.leave_type_id, name: 'T' + l.leave_type_id }))];
  if (q.includes("JSON_EXTRACT(profile_data, '$.leaveGroup')")) return [Object.entries(counts).map(([code, n]) => ({ code, n }))];
  if (q.includes('FROM leave_groups')) return [q.includes('WHERE id = ?') ? grp.filter((g) => g.id === p[0]) : grp];
  throw new Error('unexpected SQL ' + q);
};
const conn = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
mock.module('/home/claude/lams2.0/src/db/index.ts', () => ({ db: {}, pool: { query, getConnection: async () => conn } }));
mock.module('/home/claude/lams2.0/src/db/schema.ts', () => ({ master_audit_logs: {} }));
const G = await import('/home/claude/lams2.0/server/leave/groups.ts');
const req = { auth: { account: { id: 1, biometricId: '0001', name: 'Admin' }, activeRole: 'administrator' }, ip: '1.1.1.1' } as any;
beforeEach(() => { grp = []; links = []; audits = []; nextId = 1; counts = {}; });
const body = (o: any = {}) => ({ code: 'perm', name: 'Permanent staff leaves', leaveYear: 'FY', leaveTypeIds: ['1', '2'], status: 'active', ...o });

describe('leave groups', () => {
  test('nothing pre-filled; create stores name, code, leave year, leaves; audited', async () => {
    expect((await G.listLeaveGroups()).groups).toEqual([]);
    const g = await G.createLeaveGroup(req, body());
    expect(g).toMatchObject({ code: 'PERM', name: 'Permanent staff leaves', leaveYear: 'FY', leaveTypeIds: ['1', '2'], status: 'active', employeeCount: 0 });
    expect(g.leaves.map((l: any) => l.code)).toEqual(['C1', 'C2']);
    expect(audits).toEqual([{ key: 'leave_group', action: 'CREATE', label: 'Permanent staff leaves (PERM)', reason: null }]);
  });
  test('validation', async () => {
    const bad = async (o: any) => { try { await G.createLeaveGroup(req, body(o)); return null; } catch (e: any) { return e.details; } };
    expect(await bad({ name: '', code: '' })).toMatchObject({ name: expect.any(String), code: expect.any(String) });
    expect(await bad({ code: 'a b' })).toMatchObject({ code: expect.any(String) });
    expect(await bad({ leaveYear: 'XX' })).toMatchObject({ leaveYear: expect.any(String) });
    expect(await bad({ leaveTypeIds: [] })).toMatchObject({ leaveTypeIds: expect.stringContaining('at least one') });
    expect(await bad({ leaveTypeIds: ['99'] })).toMatchObject({ leaveTypeIds: expect.any(String) });
    expect(await bad({ status: 'gone' })).toMatchObject({ status: expect.any(String) });
    expect(grp.length).toBe(0);
  });
  test('duplicate code is a 409 with the field', async () => {
    await G.createLeaveGroup(req, body());
    await expect(G.createLeaveGroup(req, body({ name: 'Other' }))).rejects.toMatchObject({ status: 409, details: { code: expect.any(String) } });
  });
  test('update changes leaves and status (audited); code and leave year are locked while employees are in the group', async () => {
    const g = await G.createLeaveGroup(req, body());
    const u = await G.updateLeaveGroup(req, Number(g.id), body({ leaveTypeIds: ['3'], status: 'inactive', name: 'Renamed' }));
    expect(u).toMatchObject({ name: 'Renamed', leaveTypeIds: ['3'], status: 'inactive' });
    expect(audits.at(-1)).toMatchObject({ action: 'STATUS' });
    const n = audits.length;
    await G.updateLeaveGroup(req, Number(g.id), body({ leaveTypeIds: ['3'], status: 'inactive', name: 'Renamed' }));
    expect(audits.length).toBe(n);
    counts = { PERM: 4 };
    await expect(G.updateLeaveGroup(req, Number(g.id), body({ code: 'NEW' }))).rejects.toMatchObject({ status: 409, details: { code: expect.any(String) } });
    await expect(G.updateLeaveGroup(req, Number(g.id), body({ leaveYear: 'CY' }))).rejects.toMatchObject({ status: 409, details: { leaveYear: expect.any(String) } });
    expect((await G.updateLeaveGroup(req, Number(g.id), body({ leaveTypeIds: ['1'] }))).employeeCount).toBe(4);
    await expect(G.updateLeaveGroup(req, 99, body())).rejects.toMatchObject({ status: 404 });
  });
  test('delete is blocked while employees are in the group', async () => {
    const g = await G.createLeaveGroup(req, body());
    counts = { PERM: 2 };
    await expect(G.deleteLeaveGroup(req, Number(g.id), null)).rejects.toMatchObject({ status: 409 });
    counts = {};
    await G.deleteLeaveGroup(req, Number(g.id), 'not needed');
    expect(grp.length).toBe(0);
    expect(audits.at(-1)).toMatchObject({ action: 'DELETE', reason: 'not needed' });
  });
  test('group leave types: unknown or empty group means no restriction', async () => {
    const g = await G.createLeaveGroup(req, body());
    void g;
    expect(await G.groupLeaveTypeIds({ query } as any, '')).toBeNull();
    expect(await G.groupLeaveTypeIds({ query } as any, undefined)).toBeNull();
  });
});
