import { todayInIndia } from '../lib/validate';

/** The part of an account row that decides whether it may sign in. */
export interface AccountState {
  status: string;
  validUpto: string | null;
  /** Fixed system account (Administrator / Auditor): has no validity date and never expires. */
  isSystem?: boolean;
}

/**
 * Why an account may not use the portal, or null if it may.
 * An account must be `active` AND have a validity date that is today or later.
 * System accounts (the fixed Administrator and Auditor) have no validity date: they only need to be active.
 */
export function accountBlockReason(account: AccountState): string | null {
  const status = String(account.status || '').toLowerCase();
  if (status === 'expired') return 'Account validity has expired. Please contact the administrator.';
  if (status !== 'active') return 'Account is inactive. Please contact the administrator.';
  if (account.isSystem) return null;
  if (!account.validUpto) return 'Account validity is not configured. Please contact the administrator.';
  if (account.validUpto < todayInIndia()) return 'Account validity has expired. Please contact the administrator.';
  return null;
}


/**
 * The status an account should have in the database: an active account whose validity date has passed becomes
 * `expired`, and an expired one whose validity was extended is `active` again. Inactive accounts and system
 * accounts are left as they are. (The sign-in check above and the stored status then always agree.)
 */
export function statusForValidity(account: AccountState, today = todayInIndia()): string {
  const status = String(account.status || '').toLowerCase();
  if (account.isSystem || !account.validUpto) return status;
  if (status === 'active' && account.validUpto < today) return 'expired';
  if (status === 'expired' && account.validUpto >= today) return 'active';
  return status;
}
