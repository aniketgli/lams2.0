import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../../src/db';

/**
 * Runs `work` inside one MySQL transaction on a dedicated connection.
 * Everything written through `conn` is committed together, or rolled back
 * together if anything throws (including the audit record).
 */
export async function inTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}
