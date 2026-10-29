import session from 'express-session';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../src/db';

/**
 * express-session store backed by the `web_sessions` table
 * (see migrations/20261029_web_sessions.sql).
 *
 * Sessions survive server restarts, work across multiple processes, and can be
 * revoked per user (e.g. after a password reset or deactivation).
 */
export class MySqlSessionStore extends session.Store {
  private readonly defaultTtlMs: number;

  constructor(options: { ttlMs: number; cleanupIntervalMs?: number }) {
    super();
    this.defaultTtlMs = options.ttlMs;
    const interval = setInterval(() => {
      pool.query('DELETE FROM web_sessions WHERE expires_at < NOW(3)').catch((error) => {
        console.error('[session-store] cleanup failed:', error instanceof Error ? error.message : error);
      });
    }, options.cleanupIntervalMs ?? 15 * 60 * 1000);
    interval.unref();
  }

  /**
   * Seconds until the session expires. Expiry is computed inside MySQL
   * (NOW() + n seconds) so Node and MySQL timezones can never disagree.
   */
  private ttlSeconds(sess: session.SessionData): number {
    const cookieExpiry = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : NaN;
    const ms = Number.isNaN(cookieExpiry) ? this.defaultTtlMs : cookieExpiry - Date.now();
    return Math.max(1, Math.ceil(ms / 1000));
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    pool
      .query<RowDataPacket[]>('SELECT data FROM web_sessions WHERE sid = ? AND expires_at > NOW(3)', [sid])
      .then(([rows]) => {
        if (rows.length === 0) return callback(null, null);
        try {
          callback(null, JSON.parse(rows[0].data));
        } catch {
          callback(null, null); // corrupt row: treat as signed out
        }
      })
      .catch((error) => callback(error));
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    const userId = Number.isSafeInteger(Number(sess.userId)) ? Number(sess.userId) : null;
    pool
      .query(
        `INSERT INTO web_sessions (sid, user_id, expires_at, data) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL ? SECOND), ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), expires_at = VALUES(expires_at), data = VALUES(data)`,
        [sid, userId, this.ttlSeconds(sess), JSON.stringify(sess)],
      )
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    pool
      .query('UPDATE web_sessions SET expires_at = DATE_ADD(NOW(3), INTERVAL ? SECOND) WHERE sid = ?', [this.ttlSeconds(sess), sid])
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    pool
      .query('DELETE FROM web_sessions WHERE sid = ?', [sid])
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

/** Signs a user out everywhere. Call after password reset, deactivation or deletion. */
export async function destroyUserSessions(userId: number, exceptSid?: string): Promise<void> {
  try {
    if (exceptSid) {
      await pool.query('DELETE FROM web_sessions WHERE user_id = ? AND sid <> ?', [userId, exceptSid]);
    } else {
      await pool.query('DELETE FROM web_sessions WHERE user_id = ?', [userId]);
    }
  } catch (error) {
    // In development without the migration, sessions live in memory; every
    // request still re-checks the account, so this is not a security gap.
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return;
    throw error;
  }
}
