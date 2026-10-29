import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';

/**
 * Default password for new employees. Only its bcrypt hash is stored
 * (account_settings.default_password_hash); nobody, administrators included,
 * can read it back. New accounts get a copy of the hash and must choose their
 * own password at first sign-in.
 *
 * DEFAULT_EMPLOYEE_PASSWORD in .env is a fallback for a fresh install, used
 * only until an administrator sets the password in Master Settings.
 */

type Querier = { query: typeof pool.query };

export const ACCOUNT_SETTINGS_ID = 'default';

let envHash: { source: string; hash: string } | null = null;

async function hashOfEnvPassword(): Promise<string | null> {
  const value = process.env.DEFAULT_EMPLOYEE_PASSWORD;
  if (!value) return null;
  if (envHash?.source !== value) envHash = { source: value, hash: await bcrypt.hash(value, 12) };
  return envHash.hash;
}

export interface DefaultPasswordView {
  isSet: boolean;
  source: 'settings' | 'env' | null;
  updatedAt: string | null;
  updatedBy: { biometricId: string; name: string | null } | null;
}

async function loadRow(q: Querier): Promise<RowDataPacket | null> {
  try {
    const [rows] = await q.query<RowDataPacket[]>(
      `SELECT s.default_password_hash, s.updated_at, s.updated_by, u.name AS updated_by_name
         FROM account_settings s LEFT JOIN users u ON u.biometric_id = s.updated_by
        WHERE s.id = ? LIMIT 1`,
      [ACCOUNT_SETTINGS_ID],
    );
    return rows[0] ?? null;
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return null; // migration not run yet
    throw error;
  }
}

/** Hash to give a new account, or null when no default password is configured. */
export async function defaultPasswordHash(q: Querier = pool): Promise<string | null> {
  const row = await loadRow(q);
  if (row?.default_password_hash) return String(row.default_password_hash);
  return hashOfEnvPassword();
}

/** Whether `password` is the current default password (so a user cannot "change" to it). */
export async function isDefaultPassword(password: string, q: Querier = pool): Promise<boolean> {
  const hash = await defaultPasswordHash(q);
  return hash ? bcrypt.compare(password, hash) : false;
}

export async function defaultPasswordView(q: Querier = pool): Promise<DefaultPasswordView> {
  const row = await loadRow(q);
  if (row?.default_password_hash) {
    const at = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ? String(row.updated_at) : null;
    return {
      isSet: true,
      source: 'settings',
      updatedAt: at,
      updatedBy: row.updated_by ? { biometricId: String(row.updated_by), name: row.updated_by_name ? String(row.updated_by_name) : null } : null,
    };
  }
  if (process.env.DEFAULT_EMPLOYEE_PASSWORD) return { isSet: true, source: 'env', updatedAt: null, updatedBy: null };
  return { isSet: false, source: null, updatedAt: null, updatedBy: null };
}
