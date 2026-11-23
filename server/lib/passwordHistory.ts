import bcrypt from 'bcrypt';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/** How many earlier passwords (besides the current one) cannot be chosen again. */
export const PASSWORD_HISTORY_SIZE = 5;

type Q = Pick<PoolConnection, 'query'>;

/** Whether `password` is the current password or one of the last PASSWORD_HISTORY_SIZE passwords of the account. */
export async function reusesPassword(q: Q, userId: number, password: string, currentHash: string | null): Promise<boolean> {
  if (currentHash && (await bcrypt.compare(password, currentHash))) return true;
  const [rows] = await q.query<RowDataPacket[]>(
    'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    [userId, PASSWORD_HISTORY_SIZE],
  );
  for (const r of rows) if (await bcrypt.compare(password, String(r.password_hash))) return true;
  return false;
}

/** Keeps the password being replaced, and only the last PASSWORD_HISTORY_SIZE of them. */
export async function rememberPassword(q: Q, userId: number, replacedHash: string): Promise<void> {
  await q.query('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [userId, replacedHash]);
  await q.query(
    `DELETE FROM password_history WHERE user_id = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM password_history WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?) keep)`,
    [userId, userId, PASSWORD_HISTORY_SIZE],
  );
}

export const REUSED_PASSWORD_MESSAGE = `Choose a password you have not used before (the current one and your last ${PASSWORD_HISTORY_SIZE} cannot be used).`;
