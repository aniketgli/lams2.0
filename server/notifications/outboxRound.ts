import type { RowDataPacket } from 'mysql2/promise';
import type { SendEmailPayload } from '../integrations/email/email.types';
import { GIVE_UP_HOURS, KEEP_TEXT_DAYS, STUCK_MINUTES, afterFailure, isPermanent } from './outboxRules';

/**
 * One round of the email outbox's background sender, with everything it touches passed in (database, mail service),
 * so it is tested without a database (outboxRound.test.ts). outbox.ts runs it every 15 seconds.
 */

type Query = (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
export interface RoundDeps {
  query: Query;
  transaction: <T>(work: (conn: { query: Query }) => Promise<T>) => Promise<T>;
  /** Why this server cannot send now (its email settings), or null. */
  notReady: () => Promise<string | null>;
  send: (payload: SendEmailPayload, options: { outboxId: number }) => Promise<{ status: 'delivered' | 'simulated' | 'failed'; message: string; ccCount: number; bccCount: number }>;
  brandLogo: () => Promise<{ content: Buffer; contentType: string; filename: string } | null>;
}

const list = async (q: Query, sql: string, params: unknown[] = []) => (await q(sql, params))[0] as RowDataPacket[];

/** Tidies the queue, then sends up to `batch` due mails. Resolves with the number sent. */
export async function runOutboxRound(deps: RoundDeps, batch = 20): Promise<number> {
  const { query } = deps;
  // A mail left "sending" by a server that stopped mid-send goes back in the queue; one no server could send for a day is given up.
  await query(`UPDATE email_outbox SET status = 'pending', locked_at = NULL WHERE status = 'sending' AND locked_at < NOW(3) - INTERVAL ${STUCK_MINUTES} MINUTE`);
  await query(
    `UPDATE email_outbox SET status = 'not_sent', last_error = LEFT(CONCAT('Not sent within ${GIVE_UP_HOURS} hours. ', COALESCE(last_error, '')), 1000)
      WHERE status = 'pending' AND queued_at < NOW(3) - INTERVAL ${GIVE_UP_HOURS} HOUR`);
  await query(
    `UPDATE email_outbox SET body_html = NULL, body_text = NULL
      WHERE status = 'sent' AND body_html IS NOT NULL AND sent_at < NOW(3) - INTERVAL ${KEEP_TEXT_DAYS} DAY LIMIT 500`);

  // Only a server that can send takes mails; another one (e.g. a PC with other settings) leaves them for it.
  if (await deps.notReady()) return 0;

  const claimed = await deps.transaction(async (conn) => {
    const due = await list(conn.query,
      `SELECT id FROM email_outbox WHERE status = 'pending' AND next_attempt_at <= NOW(3) ORDER BY id LIMIT ${Math.max(1, Math.min(100, batch))} FOR UPDATE SKIP LOCKED`);
    const ids = due.map((r) => Number(r.id));
    if (ids.length) await conn.query(`UPDATE email_outbox SET status = 'sending', locked_at = NOW(3), attempts = attempts + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return ids;
  });
  if (!claimed.length) return 0;

  const rows = await list(query, `SELECT * FROM email_outbox WHERE id IN (${claimed.map(() => '?').join(',')}) ORDER BY id`, claimed);
  const logo = await deps.brandLogo();
  let sent = 0;
  for (const row of rows) {
    const result = await deps.send({
      to: String(row.to_email), toName: row.to_name ? String(row.to_name) : undefined,
      cc: row.cc ? String(row.cc).split(',').filter(Boolean) : undefined,
      subject: String(row.subject), html: row.body_html ?? undefined, text: row.body_text ?? undefined,
      category: String(row.category), eventType: String(row.event), referenceId: row.reference_id ?? undefined,
      attachments: Number(row.with_logo) && logo ? [{ ...logo, cid: 'org-logo' }] : undefined,
    }, { outboxId: Number(row.id) });
    if (result.status === 'delivered') {
      sent += 1;
      await query("UPDATE email_outbox SET status = 'sent', sent_at = NOW(3), locked_at = NULL, last_error = NULL, cc_count = ?, bcc_count = ? WHERE id = ?",
        [result.ccCount, result.bccCount, row.id]);
    } else if (result.status === 'simulated') {
      // The settings stopped working since the round began: back in the queue, this attempt not counted.
      await query("UPDATE email_outbox SET status = 'pending', locked_at = NULL, attempts = GREATEST(attempts - 1, 0), last_error = ? WHERE id = ?",
        [`Waiting: ${result.message}`.slice(0, 1000), row.id]);
    } else {
      const error = result.message.slice(0, 1000);
      const next = isPermanent(error) ? { status: 'failed' as const, retryInMinutes: null } : afterFailure(Number(row.attempts));
      await query(
        `UPDATE email_outbox SET status = ?, locked_at = NULL, last_error = ?, next_attempt_at = ${next.retryInMinutes ? `NOW(3) + INTERVAL ${next.retryInMinutes} MINUTE` : 'next_attempt_at'} WHERE id = ?`,
        [next.status, error, row.id]);
    }
  }
  return sent;
}
