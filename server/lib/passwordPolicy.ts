/**
 * Password rules, applied by the server to every password a person sets:
 * the default password for new employees, an administrator's custom reset,
 * and a user's own new password. The client shows the same rules as hints only.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const PASSWORD_RULES_TEXT = `At least ${PASSWORD_MIN} characters, with at least one letter and one number.`;

/** Why `password` is not acceptable, or null if it is. `identity` values must not be the password. */
export function passwordProblem(password: unknown, identity: { email?: string | null; biometricId?: string | null } = {}): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Enter a password.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^\s|\s$/.test(password)) return 'The password cannot start or end with a space.';
  if (!/\p{L}/u.test(password)) return 'Include at least one letter.';
  if (!/\d/.test(password)) return 'Include at least one number.';
  const lower = password.toLowerCase();
  const email = identity.email?.toLowerCase().trim();
  const localPart = email?.split('@')[0];
  if (email && (lower === email || (localPart && localPart.length >= 4 && lower.includes(localPart)))) {
    return 'The password cannot contain your email name.';
  }
  if (identity.biometricId && lower === identity.biometricId.toLowerCase()) return 'The password cannot be your biometric ID.';
  return null;
}
