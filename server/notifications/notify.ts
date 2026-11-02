import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { EmailService } from '../integrations/email/email.service';
import { envConfig } from '../config/env.config';
import { getOrganization, organizationTag } from '../masters/organizationStore';
import { logoAttachment, renderEmail, type EmailBrand } from './emailLayout';

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
  /** Text of the button that opens the portal (default "Open WII Portal"). */
  buttonLabel?: string;
  /** Shown as a quoted remark (approver's comment). */
  remark?: string | null;
  /** User ids; the first of `to` that has a registered e-mail is the addressee, everyone else is copied. */
  to: Array<number | string | null | undefined>;
  cc?: Array<number | string | null | undefined>;
  /** Addressees that are not (or no longer) active accounts, e.g. an employee whose account was just deleted. */
  direct?: Party[];
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

export interface Brand extends EmailBrand { logo: { content: Buffer; contentType: string; filename: string } | null }

/** Organization name and logo from Master Settings > Organization; a plain fallback when unavailable. */
let lastBrand: { tag: string; brand: Brand } | null = null;
export async function loadBrand(): Promise<Brand> {
  try {
    const org = await getOrganization(); // cached; the 2 MB logo is not read from MySQL for every mail
    if (org) {
      const tag = organizationTag(org);
      if (lastBrand?.tag === tag) return lastBrand.brand; // the logo is decoded once per change
      const logo = logoAttachment(org.logoData);
      const brand: Brand = { orgName: org.orgName || 'Wildlife Institute of India', hasLogo: Boolean(logo), logo };
      lastBrand = { tag, brand };
      return brand;
    }
  } catch { /* fall through */ }
  return { orgName: 'Wildlife Institute of India', hasLogo: false, logo: null };
}

export function renderNotice(n: Pick<Notice, 'heading' | 'intro' | 'details' | 'remark' | 'buttonLabel'>, to: Party, brand: EmailBrand = { orgName: 'Wildlife Institute of India', hasLogo: false }): { text: string; html: string } {
  const rows = n.details.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '') as Array<[string, string | number]>;
  return renderEmail({
    title: n.heading, greetingName: to.name, intro: n.intro, rows, remark: n.remark,
    button: envConfig.appUrl ? { label: n.buttonLabel || 'Open WII Portal', url: envConfig.appUrl } : null,
    brand, year: new Date().getFullYear(),
  });
}

/** Sends one notice. Resolves with the number of mails handed to the mail service; never rejects. */
export async function sendNotice(n: Notice): Promise<number> {
  try {
    const people = await loadParties([...n.to, ...(n.cc ?? [])]);
    const toParties = [...(n.direct ?? []), ...n.to.map(validId).filter((x): x is number => x !== null).map((id) => people.get(id)).filter((p): p is Party => Boolean(p))];
    if (!toParties.length) return 0;
    const seen = new Set<string>();
    const unique = (list: Party[]) => list.filter((p) => !seen.has(p.email.toLowerCase()) && seen.add(p.email.toLowerCase()));
    const mainTo = unique(toParties);
    const copied = unique((n.cc ?? []).map(validId).filter((x): x is number => x !== null).map((id) => people.get(id)).filter((p): p is Party => Boolean(p)));
    // One mail per addressee: every addressee is a direct "to"; the copied people go on each.
    let sent = 0;
    const brand = await loadBrand();
    for (const addressee of mainTo) {
      const { text, html } = renderNotice(n, addressee, brand);
      await EmailService.sendEmail({
        to: addressee.email, toName: addressee.name, cc: copied.map((p) => p.email), subject: n.subject, text, html,
        category: 'NOTIFICATION', eventType: n.event, referenceId: n.referenceId,
        attachments: brand.logo ? [{ ...brand.logo, cid: 'org-logo' }] : undefined,
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

/** The standard layout for mails that are sent outside `notify` (password reset, scheduled reports). */
export async function brandedMail(parts: { title: string; name: string; intro: string; details?: Detail[]; remark?: string | null; withButton?: boolean }): Promise<{
  html: string; text: string; logo: Array<{ content: Buffer; contentType: string; filename: string; cid: string }>;
}> {
  const brand = await loadBrand();
  const { html, text } = renderNotice(
    { heading: parts.title, intro: parts.intro, details: parts.details ?? [], remark: parts.remark ?? null },
    { id: 0, name: parts.name, email: '' }, brand);
  return { html, text, logo: brand.logo ? [{ ...brand.logo, cid: 'org-logo' }] : [] };
}
