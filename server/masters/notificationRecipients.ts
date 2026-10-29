import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { notification_recipients } from '../../src/db/schema';

/**
 * Organization-wide CC / BCC addresses added to notification emails.
 * Read through a short cache so sending an email does not query MySQL every time.
 */

export type RecipientType = 'CC' | 'BCC';

export interface NotificationRecipient {
  id: string;
  type: RecipientType;
  email: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string | null;
}

export function toRecipient(row: typeof notification_recipients.$inferSelect): NotificationRecipient {
  return {
    id: String(row.id),
    type: row.recipientType === 'BCC' ? 'BCC' : 'CC',
    email: row.email,
    name: row.name ?? '',
    status: String(row.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function listRecipients(): Promise<NotificationRecipient[]> {
  const rows = await db.select().from(notification_recipients).orderBy(notification_recipients.recipientType, notification_recipients.email);
  return rows.map(toRecipient);
}

const CACHE_MS = 60_000;
let cache: { at: number; cc: string[]; bcc: string[] } | null = null;

/** Clears the cache after a change so the next email uses the new list. */
export function invalidateRecipientCache() {
  cache = null;
}

/** Active CC / BCC addresses. Errors (e.g. table not yet migrated) mean "no copies". */
export async function activeCopyAddresses(): Promise<{ cc: string[]; bcc: string[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const rows = await db.select({ type: notification_recipients.recipientType, email: notification_recipients.email })
      .from(notification_recipients)
      .where(eq(sql`UPPER(${notification_recipients.status})`, 'ACTIVE'));
    cache = {
      at: Date.now(),
      cc: rows.filter((r) => r.type === 'CC').map((r) => r.email),
      bcc: rows.filter((r) => r.type === 'BCC').map((r) => r.email),
    };
    return cache;
  } catch (error) {
    console.warn('[email] could not load CC/BCC recipients:', error instanceof Error ? error.message : error);
    return { cc: [], bcc: [] };
  }
}

/**
 * Merges organization copies into an email's own CC list.
 * Security emails (password reset etc.) never get organization copies,
 * because they contain credentials meant only for the recipient.
 */
export function mergeCopies(
  to: string,
  ownCc: string[] | undefined,
  copies: { cc: string[]; bcc: string[] },
  category?: string,
): { cc: string[]; bcc: string[] } {
  const own = (ownCc ?? []).map((e) => e.trim()).filter(Boolean);
  if (String(category || '').toUpperCase() === 'SECURITY') return { cc: own, bcc: [] };
  const seen = new Set([to.trim().toLowerCase()]);
  const pick = (list: string[]) => list.filter((e) => {
    const key = e.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const cc = pick([...own, ...copies.cc]);
  const bcc = pick(copies.bcc);
  return { cc, bcc };
}
