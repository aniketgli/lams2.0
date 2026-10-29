/**
 * Sign-in rules.
 *
 *   LOGIN_EMAIL_DOMAINS  comma-separated email domains allowed to sign in
 *                        (default: wii.gov.in,edu.wii.gov.in)
 *
 * Only the exact domains listed are accepted: "x@wii.gov.in" is allowed,
 * "x@mail.wii.gov.in" or "x@wii.gov.in.example.com" are not.
 */
const DEFAULT_DOMAINS = ['wii.gov.in', 'edu.wii.gov.in'];

function readDomains(): string[] {
  const raw = process.env.LOGIN_EMAIL_DOMAINS;
  const list = (raw ? raw.split(',') : DEFAULT_DOMAINS)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
  return list.length > 0 ? [...new Set(list)] : DEFAULT_DOMAINS;
}

export const authConfig = {
  loginEmailDomains: readDomains(),
};

// Local part: letters, digits and . _ % + - ; no leading/trailing/double dots.
const LOCAL_PART = /^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*$/;

/** Lower-cased email if it is a well-formed address on an allowed domain, otherwise null. */
export function normalizeLoginEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at !== email.indexOf('@')) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local)) return null;
  return authConfig.loginEmailDomains.includes(domain) ? email : null;
}
