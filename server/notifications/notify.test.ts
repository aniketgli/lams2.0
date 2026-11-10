import { beforeEach, describe, expect, mock, test } from 'bun:test';

const sent: Array<Record<string, unknown>> = [];
const users = [
  { id: 1, name: 'Asha Employee', email: 'asha@wii.gov.in', status: 'active' },
  { id: 2, name: 'Ravi Manager', email: 'ravi@wii.gov.in', status: 'active' },
  { id: 3, name: 'Hema HoD', email: 'hema@wii.gov.in', status: 'active' },
  { id: 4, name: 'Gone User', email: 'gone@wii.gov.in', status: 'inactive' },
  { id: 5, name: 'No Mail', email: '', status: 'active' },
];
mock.module('../../src/db', () => ({
  pool: { query: async (_sql: string, ids: number[]) => [users.filter((u) => ids.includes(u.id) && u.status === 'active')] },
}));
mock.module('../integrations/email/email.service', () => ({
  EmailService: { sendEmail: async (p: Record<string, unknown>) => { sent.push(p); return { success: true, status: 'delivered' }; } },
}));

const { flowNotice } = await import('./events');
const { sendNotice, renderNotice } = await import('./notify');

const flow = { noun: 'Leave request', code: 'LEAVE', id: '9', employeeId: 1, employeeName: 'Asha Employee', biometricId: '0317', managerId: 2, reviewerId: 3, viaHod: true, summary: 'CL 2026-11-03', details: [['Days', 1]] as Array<[string, number]> };

beforeEach(() => { sent.length = 0; });

describe('who is told', () => {
  test('applied goes to the reporting manager, employee copied, and the HoD when it will go to the HoD', () => {
    const n = flowNotice('applied', flow);
    expect(n.to).toEqual([2]);
    expect(n.cc).toEqual([1, 3]);
    expect(flowNotice('applied', { ...flow, viaHod: false }).cc).toEqual([1, null]);
  });
  test('no reporting manager: the employee alone', () => {
    const n = flowNotice('applied', { ...flow, managerId: null });
    expect(n.to).toEqual([1]);
  });
  test('edited and deleted go to the reporting manager, employee and HoD copied', () => {
    for (const stage of ['edited', 'deleted'] as const) {
      const n = flowNotice(stage, flow);
      expect(n.to).toEqual([2]);
      expect(n.cc).toEqual([1, 3]);
    }
  });
  test('forwarded goes to the HoD with employee and manager copied', () => {
    const n = flowNotice('forwarded', flow);
    expect(n.to).toEqual([3]);
    expect(n.cc).toEqual([1, 2]);
  });
  test('decision goes to the employee; HoD copied only when the request went through the HoD', () => {
    expect(flowNotice('approved', flow).cc).toEqual([2, 3]);
    expect(flowNotice('rejected', { ...flow, viaHod: false }).cc).toEqual([2, null]);
    expect(flowNotice('approved', flow).to).toEqual([1]);
  });
  test('subject and remark', () => {
    const n = flowNotice('rejected', flow, 'Not enough staff');
    expect(n.subject).toContain('rejected');
    expect(n.remark).toBe('Not enough staff');
  });
});

describe('sending', () => {
  test('one mail to the addressee, copies listed, inactive and mail-less people skipped', async () => {
    const count = await sendNotice({ ...flowNotice('approved', flow), cc: [2, 3, 4, 5] });
    expect(count).toBe(1);
    expect(sent[0].to).toBe('asha@wii.gov.in');
    expect(sent[0].cc).toEqual(['ravi@wii.gov.in', 'hema@wii.gov.in']);
    expect(sent[0].category).toBe('NOTIFICATION');
  });
  test('nobody reachable: nothing is sent', async () => {
    expect(await sendNotice({ ...flowNotice('applied', flow), to: [4, 5], cc: [] })).toBe(0);
    expect(sent.length).toBe(0);
  });
  test('the same person is never addressed and copied', async () => {
    await sendNotice({ ...flowNotice('applied', flow), to: [2], cc: [2, 1] });
    expect(sent[0].cc).toEqual(['asha@wii.gov.in']);
  });
  test('a failing mail service never throws', async () => {
    mock.module('../integrations/email/email.service', () => ({ EmailService: { sendEmail: async () => { throw new Error('smtp down'); } } }));
    const again = await import('./notify?again');
    expect(await again.sendNotice(flowNotice('approved', flow))).toBe(0);
  });
});

test('html is escaped', () => {
  const { html } = renderNotice({ heading: 'H', intro: 'i', details: [['Reason', '<script>x</script>']], remark: null }, { id: 1, name: 'A<b>', email: 'a@x' });
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});
