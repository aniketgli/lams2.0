/** Pure rules of the email outbox (no database): when to try again, and when to give up. */

/** Minutes to wait before attempt n+1 after n failed attempts. After the last one the mail is marked failed. */
export const RETRY_MINUTES = [1, 5, 15, 60] as const;
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
/** A mail no server could send within this many hours of being queued is given up (not sent later as a surprise). */
export const GIVE_UP_HOURS = 24;
/** A mail stuck in "sending" this long (the server stopped mid-send) is tried again. */
export const STUCK_MINUTES = 10;
/** Stored mail text is removed this many days after it was sent. */
export const KEEP_TEXT_DAYS = 30;

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'not_sent';

/** What happens after a failed attempt (attempts = attempts made so far, including this one). */
export function afterFailure(attempts: number): { status: 'pending' | 'failed'; retryInMinutes: number | null } {
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed', retryInMinutes: null };
  return { status: 'pending', retryInMinutes: RETRY_MINUTES[Math.max(0, attempts - 1)] };
}

/** Errors that will not go away by trying again (wrong address, refused sign-in, rejected message): fail at once. */
export function isPermanent(error: string): boolean {
  return /\b(550|551|553|554|535)\b|5\.1\.\d|5\.7\.8|invalid (recipient|address)|no recipients/i.test(error);
}

/** A mail can be sent again when its text was kept and it did not go out. */
export const canResend = (row: { status: string; hasBody: boolean }) => row.hasBody && (row.status === 'failed' || row.status === 'not_sent');
