import { expect, test, mock, describe } from 'bun:test';

const base = { name: 'Emp', department: 'IT', designation: 'JE', biometricId: '1' };
const manual = [
  { ...base, id: '1', userId: '3', status: 'pending', canDecide: true, category: 'Forgotten Punch', date: '2026-11-02', inTime: '09:30', outTime: '17:30', reason: 'missed' },
  { ...base, id: '2', userId: '3', status: 'approved', canDecide: false, category: 'x', date: '2026-11-01', inTime: '09:30', outTime: '17:30', reason: 'old' },
  { ...base, id: '3', userId: '4', status: 'pending', canDecide: false, category: 'x', date: '2026-11-02', inTime: '09:30', outTime: '17:30', reason: 'other team' },
];
const od = [
  { ...base, id: '5', userId: '3', status: 'pending', canDecide: true, startDate: '2026-11-03', endDate: '2026-11-05', daysCount: 3, location: 'Dehradun', purpose: 'survey' },
];
const leave = [
  { ...base, id: '7', userId: '3', status: 'pending_l1', canDecide: true, leaveTypeName: 'Casual Leave', startDate: '2026-11-09', endDate: '2026-11-09', daysCount: 1, reason: 'family', forwardedByName: null, forwardComment: null },
  { ...base, id: '8', userId: '3', status: 'pending_l2', canDecide: false, leaveTypeName: 'Earned Leave', startDate: '2026-11-10', endDate: '2026-11-12', daysCount: 3, reason: 'trip', forwardedByName: 'Mgr', forwardComment: 'ok' },
  { ...base, id: '9', userId: '4', status: 'pending_l2', canDecide: true, leaveTypeName: 'Earned Leave', startDate: '2026-11-10', endDate: '2026-11-12', daysCount: 3, reason: 'trip', forwardedByName: 'Mgr', forwardComment: 'ok' },
];
const calls: any[] = [];
mock.module('/home/claude/lams2.0/server/manualAttendance/store.ts', () => ({ listRequests: async (v: any, q: any) => { calls.push(['manual', v, q]); return { requests: manual }; } }));
mock.module('/home/claude/lams2.0/server/outdoorDuty/store.ts', () => ({ listRequests: async () => ({ requests: od }) }));
mock.module('/home/claude/lams2.0/server/leave/requests.ts', () => ({
  listRequests: async (v: any) => ({ requests: leave.map((l) => ({ ...l, canDecide: l.status === 'pending_l1' ? ['administrator', 'reporting_manager'].includes(v.role) : l.status === 'pending_l2' && l.userId !== '3' ? ['administrator', 'reviewing_manager'].includes(v.role) : false })) }),
  listBalances: async () => ({ year: 2026, types: [{ id: '1', code: 'CL', name: 'Casual Leave', isDebited: true }, { id: '2', code: 'LWP', name: 'Leave Without Pay', isDebited: false }, { id: '3', code: 'SCL', name: 'Special', isDebited: true }],
    rows: [{ userId: '3', balances: { '1': { total: 8, carryForward: 0, used: 2, pending: 1, available: 5, eligible: true }, '2': { total: 0, carryForward: 0, used: 0, pending: 0, available: 0, eligible: true }, '3': null } }] }),
}));
mock.module('/home/claude/lams2.0/server/attendance/store.ts', () => ({
  listAttendance: async () => ({ records: [{ date: new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), clockIn: '09:41', clockOut: null }] }),
}));
const { buildDashboard } = await import('/home/claude/lams2.0/server/dashboard/store.ts');

describe('dashboard by role', () => {
  test('general staff: own pending requests, punch, balances of types they can take', async () => {
    const d = await buildDashboard({ id: 3, role: 'general_staff' });
    expect(d.manual.items.map((i) => i.id)).toEqual(['1']);
    expect(d.od.total).toBe(1);
    expect(d.leave.items.map((i) => i.id)).toEqual(['7', '8']);
    expect(d.leave.items[1].note).toBe('Forwarded by Mgr: "ok"');
    expect(d.me).toEqual({ punchIn: '09:41', punchOut: null, designation: '', balances: [{ code: 'CL', name: 'Casual Leave', total: 8, carryForward: 0, used: 2, pending: 1, available: 5 }] });
  });
  test('another staff member sees none of it', async () => {
    const d = await buildDashboard({ id: 9, role: 'general_staff' });
    expect([d.manual.total, d.od.total, d.leave.total]).toEqual([0, 0, 0]);
  });
  test('reporting manager and administrator: what waits for them to decide', async () => {
    const m = await buildDashboard({ id: 2, role: 'reporting_manager' });
    expect(m.manual.items.map((i) => i.id)).toEqual(['1']);
    expect(m.leave.items.map((i) => i.id)).toEqual(['7']);
    expect(m.me).toBeNull();
    const a = await buildDashboard({ id: 1, role: 'administrator' });
    expect(a.leave.total).toBe(2);
  });
  test('HoD: only leave at stage 2 that waits for them; auditor: every pending request', async () => {
    const dashboards = await buildDashboard({ id: 6, role: 'reviewing_manager' });
    expect(dashboards.leave.items.map((i) => i.id)).toEqual(['9']);
    const au = await buildDashboard({ id: 5, role: 'audit' });
    expect([au.manual.total, au.od.total, au.leave.total]).toEqual([2, 1, 3]);
    expect(au.me).toBeNull();
  });
  test('shows the first three, counts all', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...od[0], id: String(20 + i) }));
    od.splice(0, od.length, ...many);
    const d = await buildDashboard({ id: 3, role: 'general_staff' });
    expect(d.od.total).toBe(5);
    expect(d.od.items.length).toBe(3);
    expect(calls[0][2].from < calls[0][2].to).toBe(true);
  });
});
