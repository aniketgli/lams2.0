/** Pure rules for which CC / BCC copies a notification mail gets (no database access). */

export type RecipientType = 'CC' | 'BCC';

/** What a copy address applies to: every notification mail, or one kind of transaction. */
export const RECIPIENT_SCOPES = ['ALL', 'LEAVE', 'OD', 'MANUAL', 'JOINING', 'EMPLOYEE', 'REPORT'] as const;
export type RecipientScope = (typeof RECIPIENT_SCOPES)[number];

/** The transaction a mail belongs to, from its event code (LEAVE_APPLIED → LEAVE). Unknown events only get the ALL copies. */
export function scopeOfEvent(eventType?: string): RecipientScope | null {
  const code = String(eventType ?? '').toUpperCase();
  if (code === 'SCHEDULED_REPORT') return 'REPORT';
  const head = code.split('_')[0];
  return (RECIPIENT_SCOPES as readonly string[]).includes(head) && head !== 'ALL' ? (head as RecipientScope) : null;
}


export type CopyRow = { type: string; scope: string; email: string };

export function pickCopies(rows: CopyRow[], scope?: RecipientScope | null): { cc: string[]; bcc: string[] } {
  const use = rows.filter((r) => r.scope === 'ALL' || (scope && r.scope === scope));
  return { cc: use.filter((r) => r.type === 'CC').map((r) => r.email), bcc: use.filter((r) => r.type === 'BCC').map((r) => r.email) };
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
