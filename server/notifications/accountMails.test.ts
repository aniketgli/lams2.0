import { describe, expect, mock, test } from 'bun:test';
import { scopeOfEvent } from '../masters/copyRules';

// No database or mail server in tests (the same stand-ins as notify.test.ts).
mock.module('../../src/db', () => ({ pool: { query: async () => [[]] } }));
mock.module('./outbox', () => ({ enqueue: async () => false }));
mock.module('../integrations/email/email.service', () => ({ EmailService: { sendEmail: async () => ({ success: true, status: 'delivered' }) } }));
const { signInNotice, teamNotices } = await import('./events');

const e = { id: 41, name: 'Asha Rawat', biometricId: '0412', email: 'asha@wii.gov.in', designation: 'Project Associate', department: 'GIS Cell',
  profileData: JSON.stringify({ reportingManagerId: '7', reviewingManagerId: '9' }) };

describe('account mails', () => {
  test('the welcome mail carries login ID, temporary password and portal address, and is never copied to CC / BCC', () => {
    const n = signInNotice(e, { temporaryPassword: 'Xy7kQ2mPa9Rt', portalUrl: 'http://172.16.30.250:3000' }, 'EMPLOYEE_CREATED', 's', 'h', 'i');
    const details = Object.fromEntries(n.details);
    expect(details['Login ID (email)']).toBe('asha@wii.gov.in');
    expect(details['Temporary password']).toBe('Xy7kQ2mPa9Rt');
    expect(details['Portal address']).toBe('http://172.16.30.250:3000');
    expect(n.category).toBe('SECURITY');
    expect(n.to).toEqual([41]);
  });

  test('reporting manager and HoD each get their own team mail, which takes the organization BCC', () => {
    const list = teamNotices('added', e, { rm: '7', hod: '9' }, 'http://x');
    expect(list.map((n) => n.to)).toEqual([['7'], ['9']]);
    expect(list[0].intro).toContain('reporting manager');
    expect(list[1].intro).toContain('HoD');
    expect(list[0].category).toBeUndefined();
    expect(scopeOfEvent(list[0].event)).toBe('EMPLOYEE');
  });

  test('one person who is both gets one mail', () => {
    const list = teamNotices('deactivated', e, { rm: '7', hod: '7' });
    expect(list).toHaveLength(1);
    expect(list[0].intro).toContain('reporting manager and HoD');
  });

  test('nobody to tell: no mail', () => {
    expect(teamNotices('reactivated', e, { rm: null, hod: null })).toEqual([]);
  });
});
