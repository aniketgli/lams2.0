import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { inTransaction } from '../lib/tx';
import { EmailService } from '../integrations/email/email.service';
import { resolveEmailTransport } from '../masters/emailSettings';
import { canResend, type OutboxStatus } from './outboxRules';
import { runOutboxRound } from './outboxRound';

/**
 * Email outbox (table email_outbox). Notification mails are written here and sent by a background sender inside the
 * portal's own server, so a mail is not lost when the mail server is briefly unreachable or the portal restarts, and a
 * failed send is tried again (see outboxRules). Only a server whose email settings work picks mails up, so a PC and the
 * server that share one database never mark each other's mails as failed.
 * Without the table (migration not run) callers send straight away, as before.
 */

export interface QueuedMail {
  event: string;
  referenceId?: string | null;
  category?: string;
  to: string;
  toName?: string | null;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  /** The organization logo (Master Settings) goes in as an inline image when the mail is sent. */
  withLogo?: boolean;
}

const noTable = (error: unknown) => (error as { code?: string })?.code === 'ER_NO_SUCH_TABLE';

/** Puts a mail in the outbox. Resolves false when there is no outbox table (the caller then sends straight away). */
export async function enqueue(mail: QueuedMail): Promise<boolean> {
  try {
    const reason = EmailService.notReadyReason(await resolveEmailTransport());
    await pool.query(
      `INSERT INTO email_outbox (event, reference_id, category, to_email, to_name, cc, subject, body_html, body_text, with_logo, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mail.event.slice(0, 60), mail.referenceId?.slice(0, 100) ?? null, mail.category ?? 'NOTIFICATION', mail.to, mail.toName ?? null,
        mail.cc?.length ? mail.cc.join(',') : null, mail.subject.slice(0, 500), mail.html, mail.text, mail.withLogo ? 1 : 0,
        reason ? `Waiting: ${reason}`.slice(0, 1000) : null],
    );
    kick();
    return true;
  } catch (error) {
    if (noTable(error)) return false;
    throw error;
  }
}

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let soon: ReturnType<typeof setTimeout> | null = null;

/** Sends what is due now, soon after a mail was queued (so it does not wait for the next round). */
function kick(): void {
  if (soon || !timer) return;
  soon = setTimeout(() => { soon = null; void processOutbox(); }, 300);
  soon.unref?.();
}

/** One round: tidy up, then send up to `batch` due mails. Resolves with the number sent. Never rejects. */
export async function processOutbox(batch = 20): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    return await runOutboxRound({
      query: (sql, params) => pool.query(sql, params) as Promise<[unknown, unknown]>,
      transaction: (work) => inTransaction((conn) => work({ query: (sql, params) => conn.query(sql, params) as Promise<[unknown, unknown]> })),
      notReady: async () => EmailService.notReadyReason(await resolveEmailTransport()),
      send: (payload, options) => EmailService.sendEmail(payload, options),
      brandLogo: async () => (await (await import('./notify')).loadBrand()).logo,
    }, batch);
  } catch (error) {
    if (!noTable(error)) console.error('[email outbox]', error instanceof Error ? error.message : error);
    return 0;
  } finally {
    running = false;
  }
}

/** Starts the background sender (every 15 seconds, and right after a mail is queued). */
export function startOutboxWorker(): void {
  if (timer) return;
  timer = setInterval(() => void processOutbox(), 15_000);
  timer.unref?.();
  void processOutbox();
}

export function stopOutboxWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export interface OutboxEntry {
  id: string;
  createdAt: string;
  event: string;
  category: string;
  to: string;
  toName: string | null;
  subject: string;
  status: OutboxStatus;
  attempts: number;
  sentAt: string | null;
  error: string | null;
  ccCount: number;
  bccCount: number;
  canResend: boolean;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

/** The latest mails, newest first; null when there is no outbox table. */
export async function listOutbox(options: { status?: string | null; limit?: number } = {}): Promise<OutboxEntry[] | null> {
  const statuses: OutboxStatus[] = ['pending', 'sending', 'sent', 'failed', 'not_sent'];
  const status = statuses.includes(options.status as OutboxStatus) ? options.status : null;
  const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 200)));
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, created_at, event, category, to_email, to_name, subject, status, attempts, sent_at, last_error, cc_count, bcc_count,
              (body_html IS NOT NULL) AS has_body
         FROM email_outbox ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT ${limit}`, status ? [status] : []);
    return rows.map((r) => ({
      id: String(r.id), createdAt: iso(r.created_at)!, event: String(r.event), category: String(r.category), to: String(r.to_email),
      toName: r.to_name ? String(r.to_name) : null, subject: String(r.subject), status: String(r.status) as OutboxStatus,
      attempts: Number(r.attempts), sentAt: iso(r.sent_at), error: r.last_error ? String(r.last_error) : null,
      ccCount: Number(r.cc_count), bccCount: Number(r.bcc_count),
      canResend: canResend({ status: String(r.status), hasBody: Boolean(Number(r.has_body)) }),
    }));
  } catch (error) {
    if (noTable(error)) return null;
    throw error;
  }
}

/** Puts mails that did not go out back in the queue. Resolves with how many were queued again. */
export async function resend(ids: number[]): Promise<number> {
  const valid = ids.filter((id) => Number.isInteger(id) && id > 0).slice(0, 500);
  if (!valid.length) return 0;
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE email_outbox SET status = 'pending', attempts = 0, next_attempt_at = NOW(3), queued_at = NOW(3), last_error = NULL
      WHERE id IN (${valid.map(() => '?').join(',')}) AND status IN ('failed', 'not_sent') AND body_html IS NOT NULL`, valid);
  kick();
  return result.affectedRows;
}

/** Puts every mail of the last day that did not go out back in the queue (after the email settings were fixed). */
export async function resendRecent(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM email_outbox WHERE status IN ('failed', 'not_sent') AND body_html IS NOT NULL AND created_at >= NOW(3) - INTERVAL 1 DAY LIMIT 500");
  return resend(rows.map((r) => Number(r.id)));
}
