import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { HttpError } from '../lib/http';
import type { Validator } from '../lib/validate';
import type { FormLayout } from './fields';

/**
 * Aadhaar, PAN and bank details of an employee (kept in employee_profiles.profile_data; no schema change).
 *
 * - Aadhaar and the bank account number are stored encrypted (AES-256-GCM) with a keyed hash (HMAC-SHA256) for the
 *   uniqueness check and the last 4 digits for masked display. The key is SETTINGS_ENCRYPTION_KEY in .env, the same
 *   on every machine that uses the database; without it these numbers cannot be saved (nothing falls back to another
 *   secret, so rotating SESSION_SECRET never makes them unreadable).
 * - PAN, bank name and IFSC are stored as text.
 * - Full numbers are shown to administrators only (the employee form); everyone else sees XXXX XXXX 1234.
 * - Aadhaar is asked of every employee type; PAN and bank details of every type except M.Sc students.
 *   Aadhaar is required for a new employee; an employee added before this field existed can be saved without it
 *   until it is entered, and once entered it cannot be removed.
 */

/** Stored keys (never sent to the browser as they are). */
export const IDENTITY_STORED_KEYS = [
  'aadhaarEnc', 'aadhaarHash', 'aadhaarLast4', 'panNumber', 'bankName', 'bankIfsc', 'bankAccountEnc', 'bankAccountHash', 'bankAccountLast4',
] as const;
/** Keys the browser sends and receives. */
export const IDENTITY_FORM_KEYS = ['aadhaarNumber', 'panNumber', 'bankName', 'bankIfsc', 'bankAccountNumber'] as const;

export interface IdentityInput {
  aadhaar: string | null;
  pan: string | null;
  bankName: string | null;
  ifsc: string | null;
  account: string | null;
}

/** PAN and bank details are not asked of M.Sc students. */
export const asksBankDetails = (layout: FormLayout | null) => layout !== 'bsc_msc_student';

// ---- Formats -----------------------------------------------------------------

const D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
const P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];

/** Verhoeff check digit test (the last digit of an Aadhaar number). */
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

const compact = (value: string) => value.replace(/[\s-]/g, '');

/** Spreadsheets turn long numbers into 2.34568E+11; that number is lost and must be typed again. */
const looksScientific = (value: string) => /^\d(\.\d+)?e\+?\d+$/i.test(value.trim());

export function aadhaarProblem(raw: string): string | null {
  if (looksScientific(raw)) return 'The spreadsheet changed this number (format the column as Text and type it again).';
  const v = compact(raw);
  if (!/^\d{12}$/.test(v)) return 'Enter the 12-digit Aadhaar number.';
  if (/^[01]/.test(v)) return 'An Aadhaar number does not start with 0 or 1.';
  if (!verhoeffValid(v)) return 'This is not a valid Aadhaar number (check digit does not match). Check for a typing mistake.';
  return null;
}

export function panProblem(v: string): string | null {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) ? null : 'Enter a valid PAN (e.g. ABCDE1234F).';
}

export function ifscProblem(v: string): string | null {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? null : 'Enter a valid 11-character IFSC (e.g. SBIN0001234).';
}

export function accountProblem(raw: string): string | null {
  if (looksScientific(raw)) return 'The spreadsheet changed this number (format the column as Text and type it again).';
  return /^\d{9,18}$/.test(compact(raw)) ? null : 'Enter the bank account number (9 to 18 digits).';
}

/** Reads and checks the five fields. Errors go into the validator under the form keys. */
export function parseIdentity(v: Validator, layout: FormLayout | null): IdentityInput {
  const text = (key: string, max: number) => {
    const raw = v.raw(key);
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    if (s.length > max) { v.errors[key] ||= `Use at most ${max} characters.`; return null; }
    return s || null;
  };
  const aadhaarRaw = text('aadhaarNumber', 20);
  let aadhaar: string | null = null;
  if (aadhaarRaw) {
    const problem = aadhaarProblem(aadhaarRaw);
    if (problem) v.errors.aadhaarNumber ||= problem; else aadhaar = compact(aadhaarRaw);
  }
  if (!asksBankDetails(layout)) return { aadhaar, pan: null, bankName: null, ifsc: null, account: null };

  const panRaw = text('panNumber', 10)?.toUpperCase() ?? null;
  const pan = panRaw && !panProblem(panRaw) ? panRaw : null;
  if (panRaw && !pan) v.errors.panNumber ||= panProblem(panRaw)!;

  const bankName = text('bankName', 100)?.replace(/\s+/g, ' ') ?? null;
  if (bankName && bankName.length < 2) v.errors.bankName ||= 'Enter the bank name.';
  const ifscRaw = text('bankIfsc', 11)?.toUpperCase() ?? null;
  const ifsc = ifscRaw && !ifscProblem(ifscRaw) ? ifscRaw : null;
  if (ifscRaw && !ifsc) v.errors.bankIfsc ||= ifscProblem(ifscRaw)!;
  const accountRaw = text('bankAccountNumber', 25);
  const account = accountRaw && !accountProblem(accountRaw) ? compact(accountRaw) : null;
  if (accountRaw && !account) v.errors.bankAccountNumber ||= accountProblem(accountRaw)!;

  // Bank details go together: all three or none.
  if (bankName || ifscRaw || accountRaw) {
    if (!bankName) v.errors.bankName ||= 'Enter the bank name (bank details need the bank, IFSC and account number).';
    if (!ifscRaw) v.errors.bankIfsc ||= 'Enter the IFSC (bank details need the bank, IFSC and account number).';
    if (!accountRaw) v.errors.bankAccountNumber ||= 'Enter the account number (bank details need the bank, IFSC and account number).';
  }
  return { aadhaar, pan, bankName, ifsc, account };
}

// ---- Encryption ----------------------------------------------------------------

function rawKey(): string {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new HttpError(503,
      'Aadhaar and bank account numbers cannot be saved yet: set SETTINGS_ENCRYPTION_KEY (at least 16 characters) in .env on the server, the same value on every machine that uses this database, and restart.',
      'ENCRYPTION_KEY_MISSING');
  }
  return raw;
}
const aesKey = () => createHash('sha256').update(`wii-identity:${rawKey()}`).digest();
const hmacKey = () => createHash('sha256').update(`wii-identity-hash:${rawKey()}`).digest();

export function encryptValue(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptValue(stored: unknown): string | null {
  if (typeof stored !== 'string' || !stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(':');
    if (version !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Keyed hash for the uniqueness check (the same number always gives the same hash). */
export const identityHash = (kind: 'aadhaar' | 'account', value: string) => createHmac('sha256', hmacKey()).update(`${kind}:${value}`).digest('hex');

/** An account number is unique within a bank: the bank is the first 4 letters of the IFSC. */
export const accountKey = (ifsc: string, account: string) => `${ifsc.slice(0, 4)}:${account.replace(/^0+/, '')}`;

// ---- Storing and showing -------------------------------------------------------------

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export const maskAadhaar = (last4: string | null) => (last4 ? `XXXX XXXX ${last4}` : null);
export const maskAccount = (last4: string | null) => (last4 ? `XXXXXX${last4}` : null);

/**
 * Writes the identity into a new profile_data object (`data`), from the form input and the stored values (`previous`).
 * Returns the hashes to check for uniqueness.
 */
export function storeIdentity(data: Record<string, unknown>, input: IdentityInput, previous: Record<string, unknown>, layout: FormLayout | null) {
  for (const k of IDENTITY_STORED_KEYS) delete data[k];
  const out: { aadhaarHash: string | null; accountHash: string | null; pan: string | null } = { aadhaarHash: null, accountHash: null, pan: null };
  if (input.aadhaar) {
    out.aadhaarHash = identityHash('aadhaar', input.aadhaar);
    // Unchanged number: keep the stored cipher text (no needless rewrite).
    const same = previous.aadhaarHash === out.aadhaarHash && str(previous.aadhaarEnc);
    data.aadhaarEnc = same ? previous.aadhaarEnc : encryptValue(input.aadhaar);
    data.aadhaarHash = out.aadhaarHash;
    data.aadhaarLast4 = input.aadhaar.slice(-4);
  }
  if (!asksBankDetails(layout)) return out;
  if (input.pan) { data.panNumber = input.pan; out.pan = input.pan; }
  if (input.bankName && input.ifsc && input.account) {
    out.accountHash = identityHash('account', accountKey(input.ifsc, input.account));
    const same = previous.bankAccountHash === out.accountHash && str(previous.bankAccountEnc);
    data.bankName = input.bankName;
    data.bankIfsc = input.ifsc;
    data.bankAccountEnc = same ? previous.bankAccountEnc : encryptValue(input.account);
    data.bankAccountHash = out.accountHash;
    data.bankAccountLast4 = input.account.slice(-4);
  }
  return out;
}

/** What the browser gets: full numbers for administrators, masked ones for everyone else. Stored keys are removed. */
export function identityView(data: Record<string, unknown>, full: boolean): Record<string, string | null> {
  let aadhaar = maskAadhaar(str(data.aadhaarLast4));
  let account = maskAccount(str(data.bankAccountLast4));
  if (full) {
    // Without the key (or with a different one) the masked form is shown instead of failing the whole list.
    try { aadhaar = decryptValue(data.aadhaarEnc) ?? aadhaar; } catch { /* key missing */ }
    try { account = decryptValue(data.bankAccountEnc) ?? account; } catch { /* key missing */ }
  }
  return { aadhaarNumber: aadhaar, panNumber: str(data.panNumber), bankName: str(data.bankName), bankIfsc: str(data.bankIfsc), bankAccountNumber: account };
}

/** For the audit log: masked values plus a short hash so a changed number with the same last digits still shows. */
export function identityAudit(data: Record<string, unknown>): Record<string, unknown> {
  return {
    aadhaar: data.aadhaarLast4 ? `${maskAadhaar(str(data.aadhaarLast4))} #${String(data.aadhaarHash ?? '').slice(0, 6)}` : null,
    pan: str(data.panNumber),
    bankName: str(data.bankName),
    bankIfsc: str(data.bankIfsc),
    bankAccount: data.bankAccountLast4 ? `${maskAccount(str(data.bankAccountLast4))} #${String(data.bankAccountHash ?? '').slice(0, 6)}` : null,
  };
}
