import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { EmailService } from '../integrations/email/email.service';
import { escapeHtml } from '../lib/validate';

/**
 * Transaction e-mails. A flow calls `notify(...)` AFTER its database transaction has committed.
 * Sending never throws and never delays the response: a mail problem must not undo or fail the
 * transaction it describes. The organization CC / BCC (Master Settings) are added by EmailService.
 */

export interface Party { id: number; name: string; email: string }

export type Detail = [label: string, value: string | number | null | undefined];

export interface Notice {
  /** Short code, e.g. LEAVE_APPLIED. Stored with the mail log. */
  event: string;
  referenceId: string;
  subject: string;
  heading: string;
  /** One or two sentences, plain text. */
  intro: string;
  details: Detail[];
  /** Shown as a quoted remark (approver's comment). */
  remark?: string | null;
  /** User ids; the first of `to` that has a registered e-mail is the addressee, everyone else is copied. */
  to: Array<number | string | null | undefined>;
  cc?: Array<number | string | null | undefined>;
}

const validId = (v: unknown): number | null => (/^\d{1,18}$/.test(String(v ?? '').trim()) ? Number(v) : null);

/** Active accounts that have an e-mail address, by user id. */
export async function loadParties(ids: Array<number | string | null | undefined>): Promise<Map<number, Party>> {
  const wanted = [...new Set(ids.map(validId).filter((x): x is number => x !== null))];
  const found = new Map<number, Party>();
  if (!wanted.length) return found;
  const [list] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email FROM users WHERE id IN (${wanted.map(() => '?').join(',')}) AND LOWER(status) = 'active'`, wanted);
  for (const r of list) {
    const email = String(r.email ?? '').trim();
    if (email.includes('@')) found.set(Number(r.id), { id: Number(r.id), name: String(r.name ?? ''), email });
  }
  return found;
}

export function renderNotice(n: Pick<Notice, 'heading' | 'intro' | 'details' | 'remark'>, to: Party): { text: string; html: string } {
  const rows = n.details.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '') as Array<[string, string | number]>;
  const text = [
    `Dear ${to.name},`, '', n.intro, '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(n.remark ? ['', `Remark: ${n.remark}`] : []),
    '', 'Open the WII Portal to take action or see the details.', '', 'This is an automated message from the WII Portal.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b">
<p>Dear ${escapeHtml(to.name)},</p>
<h3 style="margin:16px 0 4px">${escapeHtml(n.heading)}</h3>
<p>${escapeHtml(n.intro)}</p>
<table style="border-collapse:collapse;margin:8px 0">${rows.map(([k, v]) =>
    `<tr><td style="padding:3px 16px 3px 0;color:#64748b">${escapeHtml(k)}</td><td style="padding:3px 0;font-weight:600">${escapeHtml(v)}</td></tr>`).join('')}</table>
${n.remark ? `<p style="border-left:3px solid #cbd5e1;padding-left:10px;color:#475569">${escapeHtml(n.remark)}</p>` : ''}
<p>Open the WII Portal to take action or see the details.</p>
<p style="color:#94a3b8;font-size:12px">This is an automated message from the WII Portal.</p></div>`;
  return { text, html };
}

/** Sends one notice. Resolves with the number of mails handed to the mail service; never rejects. */
export async function sendNotice(n: Notice): Promise<number> {
  try {
    const people = await loadParties([...n.to, ...(n.cc ?? [])]);
    const toParties = n.to.map(validId).filter((x): x is number => x !== null).map((id) => people.get(id)).filter((p): p is Party => Boolean(p));
    if (!toParties.length) return 0;
    const seen = new Set<string>();
    const unique = (list: Party[]) => list.filter((p) => !seen.has(p.email.toLowerCase()) && seen.add(p.email.toLowerCase()));
    const mainTo = unique(toParties);
    const copied = unique((n.cc ?? []).map(validId).filter((x): x is number => x !== null).map((id) => people.get(id)).filter((p): p is Party => Boolean(p)));
    // One mail per addressee: every addressee is a direct "to"; the copied people go on each.
    let sent = 0;
    for (const addressee of mainTo) {
      const { text, html } = renderNotice(n, addressee);
      await EmailService.sendEmail({
        to: addressee.email, toName: addressee.name, cc: copied.map((p) => p.email), subject: n.subject, text, html,
        category: 'NOTIFICATION', eventType: n.event, referenceId: n.referenceId,
      });
      sent += 1;
    }
    return sent;
  } catch (error) {
    console.error(`[notify] ${n.event} ${n.referenceId} failed:`, error instanceof Error ? error.message : error);
    return 0;
  }
}

/** Fire and forget: call after the transaction has committed. */
export function notify(build: () => Promise<Notice | null> | Notice | null): void {
  void (async () => {
    try {
      const notice = await build();
      if (notice) await sendNotice(notice);
    } catch (error) {
      console.error('[notify] could not build the notice:', error instanceof Error ? error.message : error);
    }
  })();
}
