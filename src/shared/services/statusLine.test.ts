import { describe, expect, test } from 'bun:test';
import { decidedBy, pendingAt, pendingAtManager, roleAndName, statusPerson } from './statusLine';

describe('status line', () => {
  test('pending: "at <role> <name>"', () => {
    expect(pendingAt('R.M.', 'Harendra Kumar')).toBe('at R.M. Harendra Kumar');
    expect(pendingAt('HoD', 'Ravi Sharma')).toBe('at HoD Ravi Sharma');
    expect(pendingAtManager(null)).toBe('at Administrator');
    expect(pendingAtManager('Harendra Kumar')).toBe('at R.M. Harendra Kumar');
  });
  test('decided: "by <role> <name>"', () => {
    expect(decidedBy('Admin', 'Aniket Gupta')).toBe('by Admin Aniket Gupta');
    expect(decidedBy(null, 'Aniket Gupta')).toBe('by Aniket Gupta');
    expect(decidedBy(null, null)).toBe('');
  });
  test('names without a role or a name', () => {
    expect(roleAndName('HoD', '')).toBe('HoD');
    expect(roleAndName(null, null)).toBe('Administrator');
  });
  test('exports keep only the person', () => {
    expect(statusPerson('at R.M. Harendra Kumar')).toBe('R.M. Harendra Kumar');
    expect(statusPerson('by HoD Ravi Sharma')).toBe('HoD Ravi Sharma');
  });
});
