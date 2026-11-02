import type { RowDataPacket } from 'mysql2/promise';
import type { pool } from '../../src/db';

/** Small helpers shared by every module that reads MySQL rows (they used to be copied into each store). */

/** Anything that can run a query: the pool or a transaction's connection. */
export type Querier = { query: typeof pool.query };

/** Runs a SELECT and returns its rows. */
export async function rows(q: Querier, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

/** The profile JSON saved on an employee (text or an already parsed object); `{}` when missing or invalid. */
export function profileData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** A MySQL DATE as `YYYY-MM-DD` (read in the server's calendar, not shifted by time zone). */
export function isoDate(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return String(value).slice(0, 10);
}

/** A MySQL DATETIME as an ISO timestamp, or null when empty. */
export const isoTime = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);
