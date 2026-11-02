import { describe, expect, test } from 'bun:test';
import { NOT_SYSTEM_SQL, assertNotSystemAccount, isSystemRow } from './systemAccounts';

const db = (is_system: number | null) => ({ query: async (sql: string, v: unknown[]) => [is_system === null ? [] : [{ is_system, sql, v }], []] });

describe('system accounts', () => {
  test('flag is read as a number or boolean-ish value', () => {
    expect(isSystemRow({ is_system: 1 })).toBe(true);
    expect(isSystemRow({ is_system: 0 })).toBe(false);
    expect(isSystemRow({})).toBe(false);
    expect(isSystemRow(undefined)).toBe(false);
  });
  test('a system account is refused by id and by biometric id', async () => {
    for (const who of [{ id: 7 }, { biometricId: '9001' }]) {
      const err = await assertNotSystemAccount(db(1), who).catch((e) => e);
      expect(err.status).toBe(409);
      expect(err.code).toBe('SYSTEM_ACCOUNT');
    }
  });
  test('an ordinary or unknown account passes', async () => {
    await assertNotSystemAccount(db(0), { id: 7 });
    await assertNotSystemAccount(db(null), { biometricId: '1234' });
  });
  test('list filter uses the users alias', () => {
    expect(NOT_SYSTEM_SQL).toBe('u.is_system = 0');
  });
});
