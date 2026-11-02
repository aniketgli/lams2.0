import type { RowDataPacket } from 'mysql2/promise';
import { HttpError } from './http';

/**
 * System accounts (users.is_system = 1: the fixed Administrator and Auditor) cannot be changed by anyone and stay out of every
 * employee list except the Profiles table. SQL for lists: add `AND u.is_system = 0` (alias u = users).
 */
export const NOT_SYSTEM_SQL = 'u.is_system = 0';

export const SYSTEM_ACCOUNT_MESSAGE = 'This is a system account. It cannot be edited, deactivated or deleted.';

export const systemAccountError = () => new HttpError(409, SYSTEM_ACCOUNT_MESSAGE, 'SYSTEM_ACCOUNT');

export const isSystemRow = (row: Pick<RowDataPacket, 'is_system'> | undefined | null): boolean => Number(row?.is_system ?? 0) === 1;

type Querier = { query: (sql: string, values?: unknown[]) => Promise<unknown> };

/** Throws when the account (by user id or biometric id) is a system account. Unknown accounts pass; callers report those themselves. */
export async function assertNotSystemAccount(q: Querier, who: { id?: number; biometricId?: string }): Promise<void> {
  const [found] = (await q.query(
    who.id !== undefined ? 'SELECT is_system FROM users WHERE id = ? LIMIT 1' : 'SELECT is_system FROM users WHERE biometric_id = ? LIMIT 1',
    [who.id ?? who.biometricId])) as [RowDataPacket[], unknown];
  if (isSystemRow(found[0])) throw systemAccountError();
}
