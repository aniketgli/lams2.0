import { expect, test, mock, describe, beforeEach } from 'bun:test';
let pol: any[]; let items: any[]; let audits: any[]; let nextId: number;
const cols = (q: string, re: RegExp) => (q.match(re)![1]).split(',').map((c) => c.trim());
const query = async (q: string, p: any[] = []) => {
  q = q.replace(/\s+/g, ' ');
  if (q.includes('INSERT INTO master_audit_logs')) { audits.push({ key: p[0], id: p[1], action: p[3], reason: p[7] }); return [{}]; }
  if (q.includes("lookup_type = 'employee_type'")) return [[{ code: 'permanent', name: 'Permanent' }, { code: 'researcher', name: 'Researcher' }]];
  if (q.startsWith("SELECT id FROM leave_types WHERE status = 'active'")) return [[{ id: 1 }, { id: 2 }]];
  if (q.startsWith('SELECT id, code, name FROM leave_types')) return [[]];
  if (q.includes('FROM organization_units')) return [[{ name: 'Library' }, { name: 'GIS Cell' }]];
  if (q.includes('FROM designations')) return [[{ name: 'Scientist' }]];
  if (q.startsWith('INSERT INTO leave_policies')) {
    const c = [...cols(q, /\(([^)]*)\) VALUES/)]; const row: any = { id: nextId, updated_at: new Date() }; c.forEach((k, i) => (row[k] = p[i]));
    if (pol.some((r) => r.code === row.code && r.version === row.version)) throw Object.assign(new Error('d'), { code: 'ER_DUP_ENTRY' });
    pol.push(row); return [{ insertId: nextId++ }];
  }
  if (q.startsWith('INSERT INTO leave_policy_items')) { items.push({ policy_id: p[0], leave_type_id: p[1], annual_entitlement: p[2], accrual: p[3], accrual_quantity: p[4], max_balance: p[5], min_application: p[6], max_application: p[7], carry_forward: p[8], carry_limit: p[9], encashment: p[10], encash_limit: p[11], half_day: p[12], document_required: p[13], probation_applicable: p[14], negative_balance: p[15], conditions: p[16], sort_order: p[17], id: items.length + 1 }); return [{}]; }
  if (q.startsWith('DELETE FROM leave_policy_items')) { items = items.filter((i) => i.policy_id !== p[0]); return [{}]; }
  if (q.startsWith('DELETE FROM leave_policies')) { pol = pol.filter((r) => r.id !== p[0]); return [{}]; }
  if (q.startsWith('SELECT id FROM leave_policies WHERE id = ? FOR UPDATE')) return [pol.filter((r) => r.id === p[0])];
  if (q.startsWith('UPDATE leave_policies SET status = ?')) { pol.find((r) => r.id === p[1]).status = p[0]; return [{}]; }
  if (q.startsWith("UPDATE leave_policies SET status = 'active'")) { pol.find((r) => r.id === p[0]).status = 'active'; return [{}]; }
  if (q.startsWith('UPDATE leave_policies SET effective_to = ?')) { pol.find((r) => r.id === p[1]).effective_to = p[0]; return [{}]; }
  if (q.startsWith('UPDATE leave_policies SET')) {
    const c = cols(q.replace(/ = \?/g, ''), /SET (.*) WHERE/); const r = pol.find((x) => x.id === p[c.length])!; c.forEach((k, i) => (r[k] = p[i])); return [{}];
  }
  if (q.includes('FROM leave_policy_items i JOIN leave_types')) return [items.filter((i) => p.includes(i.policy_id)).map((i) => ({ ...i, type_name: 'T' + i.leave_type_id, type_code: 'C' + i.leave_type_id }))];
  if (q.includes('FROM leave_policies')) {
    let r = pol;
    if (q.includes('WHERE id = ?')) r = pol.filter((x) => x.id === p[0]);
    else if (q.includes("WHERE status = 'active' AND employee_category = ? AND id <> ?")) r = pol.filter((x) => x.status === 'active' && x.employee_category === p[0] && x.id !== p[1]);
    return [r];
  }
  throw new Error('unexpected SQL ' + q);
};
const conn = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
mock.module('/home/claude/lams2.0/src/db/index.ts', () => ({ db: {}, pool: { query, getConnection: async () => conn } }));
mock.module('/home/claude/lams2.0/src/db/schema.ts', () => ({ master_audit_logs: {} }));
const P = await import('/home/claude/lams2.0/server/leave/policies.ts');
const req = { auth: { account: { id: 1, biometricId: '0001', name: 'Admin' }, activeRole: 'administrator' }, ip: '1.1.1.1' } as any;
beforeEach(() => { pol = []; items = []; audits = []; nextId = 1; });

const item = (o: any = {}) => ({ leaveTypeId: '1', annualEntitlement: 8, accrual: 'yearly', accrualQuantity: 0, maxBalance: 0, minApplication: 0.5, maxApplication: 5, carryForward: false, carryLimit: 0, encashment: false, encashLimit: 0, halfDay: true, documentRequired: false, probationApplicable: true, negativeBalance: false, conditions: '', ...o });
const body = (o: any = {}) => ({ code: 'perm-2026', name: 'Permanent staff leave policy', employeeCategory: 'permanent', version: '1.0', effectiveFrom: '2026-04-01', effectiveTo: '', yearCycle: 'financial', status: 'draft', description: '',
  items: [item(), item({ leaveTypeId: '2', annualEntitlement: 30, accrual: 'monthly', accrualQuantity: 2.5, carryForward: true, carryLimit: 300 })],
  proRata: true, midYearJoining: 'prorata', backdatedLeave: 'not_allowed', noticePeriodLeave: 'not_allowed', sandwichRule: 'excluded', weeklyOff: 'excluded', publicHoliday: 'excluded', separationBalance: 'lapse', generalRemarks: '',
  approvalMode: 'two_level', workflowStatus: 'enabled', l1Role: 'reporting_manager', l1Mandatory: true, l2Role: 'reviewing_manager', l2Mandatory: true,
  assignmentMethod: 'default_override', departmentScope: 'all', departments: [], designationScope: 'selected', designations: ['Scientist'], assignmentRemarks: '', referenceNo: '', orderDate: '', officialRemarks: '', ...o });

describe('leave policies', () => {
  test('saves a draft with its leave types; code upper-cased; audited; nothing pre-filled', async () => {
    expect(await P.listPolicies()).toEqual([]);
    const p = await P.createPolicy(req, body());
    expect(p).toMatchObject({ code: 'PERM-2026', status: 'draft', editable: true, version: '1.0', designations: ['Scientist'] });
    expect(p.items.map((i: any) => i.leaveTypeId)).toEqual(['1', '2']);
    expect(audits).toEqual([{ key: 'leave_policy', id: '1', action: 'CREATE', reason: null }]);
  });
  test('validation: required fields, categories, duplicates, limits, approval levels, assignment', async () => {
    const bad = async (o: any) => { try { await P.createPolicy(req, body(o)); return null; } catch (e: any) { return e.details ?? e.message; } };
    expect(await bad({ name: '', effectiveFrom: '' , yearCycle: '' })).toMatchObject({ name: expect.any(String), effectiveFrom: expect.any(String), yearCycle: expect.any(String) });
    expect(await bad({ employeeCategory: 'ghost' })).toMatchObject({ employeeCategory: expect.any(String) });
    expect(await bad({ effectiveFrom: '2026-02-31' })).toMatchObject({ effectiveFrom: expect.any(String) });
    expect(await bad({ effectiveTo: '2026-03-01' })).toMatchObject({ effectiveTo: 'Cannot be before the start date.' });
    expect(await bad({ items: [item(), item()] })).toMatchObject({ 'items.1.leaveTypeId': expect.stringContaining('already added') });
    expect(await bad({ items: [item({ leaveTypeId: '99' })] })).toMatchObject({ 'items.0.leaveTypeId': expect.any(String) });
    expect(await bad({ items: [item({ annualEntitlement: 12, maxBalance: 10 })] })).toMatchObject({ 'items.0.maxBalance': expect.any(String) });
    expect(await bad({ items: [item({ minApplication: 6, maxApplication: 5 })] })).toMatchObject({ 'items.0.maxApplication': expect.any(String) });
    expect(await bad({ items: [item({ carryForward: true, carryLimit: 0 })] })).toMatchObject({ 'items.0.carryLimit': expect.any(String) });
    expect(await bad({ items: [item({ accrual: 'monthly', accrualQuantity: 0 })] })).toMatchObject({ 'items.0.accrualQuantity': expect.any(String) });
    expect(await bad({ items: [item({ annualEntitlement: 8.3 })] })).toMatchObject({ 'items.0.annualEntitlement': expect.any(String) });
    expect(await bad({ l2Role: 'reporting_manager' })).toMatchObject({ l2Role: expect.any(String) });
    expect(await bad({ l1Role: 'general_staff' })).toMatchObject({ l1Role: expect.any(String) });
    expect(await bad({ designationScope: 'selected', designations: [] })).toMatchObject({ designations: expect.any(String) });
    expect(await bad({ departmentScope: 'selected', departments: ['Nowhere'] })).toMatchObject({ departments: expect.any(String) });
    expect(await bad({ status: 'active', items: [] })).toMatchObject({ items: expect.stringContaining('at least one') });
    expect(pol.length).toBe(0);
  });
  test('single level / disabled workflow needs no second level; scope "all" stores no names', async () => {
    const p = await P.createPolicy(req, body({ approvalMode: 'single_level', l2Role: 'administrator', designationScope: 'all', designations: ['Scientist'] }));
    expect(p).toMatchObject({ l2Role: '', designations: [] });
    const d = await P.createPolicy(req, body({ code: 'X2', workflowStatus: 'disabled', l1Role: '' }));
    expect(d).toMatchObject({ workflowStatus: 'disabled', l1Role: '' });
  });
  test('duplicate code and version', async () => {
    await P.createPolicy(req, body());
    await expect(P.createPolicy(req, body())).rejects.toMatchObject({ status: 409, details: { version: expect.any(String) } });
  });
  test('draft can be edited and deleted; active cannot', async () => {
    const d = await P.createPolicy(req, body());
    const e = await P.updatePolicy(req, 1, body({ name: 'Renamed policy', items: [item()] }));
    expect(e.name).toBe('Renamed policy'); expect(e.items.length).toBe(1);
    expect(audits.at(-1)).toMatchObject({ action: 'UPDATE' });
    const a = await P.updatePolicy(req, 1, body({ status: 'active' }));
    expect(a).toMatchObject({ status: 'active', editable: false });
    expect(audits.at(-1)).toMatchObject({ action: 'STATUS' });
    await expect(P.updatePolicy(req, 1, body())).rejects.toMatchObject({ status: 409, code: 'LOCKED' });
    await expect(P.deletePolicy(req, 1, null)).rejects.toMatchObject({ status: 409 });
    const d2 = await P.createPolicy(req, body({ code: 'D2' }));
    await P.deletePolicy(req, Number(d2.id), 'not needed');
    expect(pol.map((r) => r.code)).toEqual(['PERM-2026']);
    expect(audits.at(-1)).toMatchObject({ action: 'DELETE', reason: 'not needed' });
    expect(d.status).toBe('draft');
  });
  test('new version: copy as draft, activating ends the earlier version the day before', async () => {
    await P.createPolicy(req, body({ status: 'active' }));
    await expect(P.newPolicyVersion(req, 1, { version: '1.0', effectiveFrom: '2027-04-01' })).rejects.toMatchObject({ details: { version: expect.any(String) } });
    await expect(P.newPolicyVersion(req, 1, { version: '2.0', effectiveFrom: '2026-04-01' })).rejects.toMatchObject({ details: { effectiveFrom: expect.any(String) } });
    const v2 = await P.newPolicyVersion(req, 1, { version: '2.0', effectiveFrom: '2027-04-01' });
    expect(v2).toMatchObject({ status: 'draft', version: '2.0', effectiveFrom: '2027-04-01', effectiveTo: '' });
    expect(v2.items.length).toBe(2);
    const active = await P.setPolicyStatus(req, Number(v2.id), { status: 'active' });
    expect(active.status).toBe('active');
    expect(pol.find((r) => r.id === 1)).toMatchObject({ status: 'active', effective_to: '2027-03-31' });
  });
  test('overlapping active policy of the same category is refused; other category is fine', async () => {
    await P.createPolicy(req, body({ status: 'active' }));
    await expect(P.createPolicy(req, body({ code: 'OTHER', status: 'active' }))).rejects.toMatchObject({ status: 409, code: 'OVERLAP' });
    const ok = await P.createPolicy(req, body({ code: 'RES', employeeCategory: 'researcher', status: 'active' }));
    expect(ok.status).toBe('active');
  });
  test('status changes: inactive then active again; only active can be made inactive; empty policy cannot activate', async () => {
    const a = await P.createPolicy(req, body({ status: 'active' }));
    expect((await P.setPolicyStatus(req, Number(a.id), { status: 'inactive' })).status).toBe('inactive');
    await expect(P.setPolicyStatus(req, Number(a.id), { status: 'inactive' })).rejects.toMatchObject({ status: 409 });
    expect((await P.setPolicyStatus(req, Number(a.id), { status: 'active' })).status).toBe('active');
    const e = await P.createPolicy(req, body({ code: 'EMPTY', employeeCategory: 'researcher', items: [] }));
    await expect(P.setPolicyStatus(req, Number(e.id), { status: 'active' })).rejects.toMatchObject({ status: 409, code: 'EMPTY' });
    await expect(P.setPolicyStatus(req, 99, { status: 'active' })).rejects.toMatchObject({ status: 404 });
  });
});
