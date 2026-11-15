import { describe, expect, test } from 'bun:test';
import { PASSWORD_CHANGE_PATHS, passwordChangeRequired } from './passwordGate';

describe('system accounts must replace the default password', () => {
  test('a fixed account still on its default password is gated; employees and changed accounts are not', () => {
    expect(passwordChangeRequired({ isSystem: true, mustChangePassword: true })).toBe(true);
    expect(passwordChangeRequired({ isSystem: true, mustChangePassword: false })).toBe(false);
    expect(passwordChangeRequired({ isSystem: false, mustChangePassword: true })).toBe(false);
    expect(passwordChangeRequired({ mustChangePassword: true })).toBe(false);
  });
  test('only reading the session, changing the password and signing out stay open', () => {
    expect([...PASSWORD_CHANGE_PATHS].sort()).toEqual(['/api/auth/change-password', '/api/auth/logout', '/api/auth/me']);
  });
});
