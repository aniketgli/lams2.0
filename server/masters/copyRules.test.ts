import { describe, expect, test } from 'bun:test';
import { pickCopies, scopeOfEvent, mergeCopies } from './copyRules';
const rows = [
  { type: 'BCC', scope: 'ALL', email: 'erp@wii.gov.in' },
  { type: 'BCC', scope: 'LEAVE', email: 'leave-desk@wii.gov.in' },
  { type: 'CC', scope: 'OD', email: 'od-desk@wii.gov.in' },
  { type: 'BCC', scope: 'EMPLOYEE', email: 'hr@wii.gov.in' },
];
describe('scopeOfEvent', () => {
  test('maps event codes to a transaction', () => {
    expect(scopeOfEvent('LEAVE_APPLIED')).toBe('LEAVE');
    expect(scopeOfEvent('OD_APPROVED')).toBe('OD');
    expect(scopeOfEvent('MANUAL_REJECTED')).toBe('MANUAL');
    expect(scopeOfEvent('JOINING_FORWARDED')).toBe('JOINING');
    expect(scopeOfEvent('EMPLOYEE_CREATED_MANAGER')).toBe('EMPLOYEE');
    expect(scopeOfEvent('SCHEDULED_REPORT')).toBe('REPORT');
  });
  test('unknown or empty events get no scope', () => {
    expect(scopeOfEvent('PASSWORD_RESET')).toBeNull();
    expect(scopeOfEvent(undefined)).toBeNull();
    expect(scopeOfEvent('ALL_X')).toBeNull();
  });
});
describe('pickCopies', () => {
  test('ALL plus the transaction own addresses', () => {
    expect(pickCopies(rows, 'LEAVE')).toEqual({ cc: [], bcc: ['erp@wii.gov.in', 'leave-desk@wii.gov.in'] });
    expect(pickCopies(rows, 'OD')).toEqual({ cc: ['od-desk@wii.gov.in'], bcc: ['erp@wii.gov.in'] });
  });
  test('no scope: only ALL', () => {
    expect(pickCopies(rows, null)).toEqual({ cc: [], bcc: ['erp@wii.gov.in'] });
  });
  test('an address in both ALL and a scope is copied once; security mail gets none', () => {
    const both = [...rows, { type: 'BCC', scope: 'LEAVE', email: 'erp@wii.gov.in' }];
    expect(mergeCopies('a@x', [], pickCopies(both, 'LEAVE')).bcc).toEqual(['erp@wii.gov.in', 'leave-desk@wii.gov.in']);
    expect(mergeCopies('a@x', [], pickCopies(both, 'LEAVE'), 'SECURITY').bcc).toEqual([]);
  });
});
