import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { notification_recipients } from '../../src/db/schema';
import { RECIPIENT_SCOPES, type CopyRow, type RecipientScope, type RecipientType, pickCopies } from './copyRules';

export { RECIPIENT_SCOPES, mergeCopies, pickCopies, scopeOfEvent } from './copyRules';
export type { RecipientScope, RecipientType } from './copyRules';

/**
 * Organization-wide CC / BCC addresses added to notification emails.
 * Read through a short cache so sending an email does not query MySQL every time.
 */

// A type alias (not an interface) so it can be passed to the audit log as a plain record.
export type NotificationRecipient = {
  id: string;
  type: RecipientType;
  scope: RecipientScope;
  email: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string | null;
};

export function toRecipient(row: typeof notification_recipients.$inferSelect): NotificationRecipient {
  return {
    id: String(row.id),
    type: row.recipientType === 'BCC' ? 'BCC' : 'CC',
    scope: (RECIPIENT_SCOPES as readonly string[]).includes(row.scope) ? (row.scope as RecipientScope) : 'ALL',
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
let cache: { at: number; rows: CopyRow[] } | null = null;

/** Clears the cache after a change so the next email uses the new list. */
export function invalidateRecipientCache() {
  cache = null;
}

/** Copies for a mail: the ALL addresses plus those set for its transaction. Errors (e.g. table not yet migrated) mean "no copies". */
export async function activeCopyAddresses(scope?: RecipientScope | null): Promise<{ cc: string[]; bcc: string[] }> {
  if (!cache || Date.now() - cache.at >= CACHE_MS) {
    try {
      const rows = await db.select({ type: notification_recipients.recipientType, scope: notification_recipients.scope, email: notification_recipients.email })
        .from(notification_recipients)
        .where(eq(sql`UPPER(${notification_recipients.status})`, 'ACTIVE'));
      cache = { at: Date.now(), rows };
    } catch (error) {
      console.warn('[email] could not load CC/BCC recipients:', error instanceof Error ? error.message : error);
      return { cc: [], bcc: [] };
    }
  }
  return pickCopies(cache.rows, scope);
}

