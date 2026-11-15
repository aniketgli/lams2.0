/**
 * Fixed system accounts (Administrator / Auditor) are created with a published default password
 * (migrations/20261120_bootstrap_users.sql). Until it is replaced, their session may only read itself,
 * change the password or sign out. Employees on a default or temporary password may still skip the offer.
 */
export const passwordChangeRequired = (account: { isSystem?: boolean; mustChangePassword: boolean }): boolean =>
  Boolean(account.isSystem && account.mustChangePassword);

/** The only API paths such a session may use. */
export const PASSWORD_CHANGE_PATHS: ReadonlySet<string> = new Set(['/api/auth/me', '/api/auth/change-password', '/api/auth/logout']);
