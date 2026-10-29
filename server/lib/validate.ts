import { badRequest } from './http';

/**
 * Small dependency-free validation helpers. Every request body is validated on
 * the server; client-side checks are only a convenience for the user.
 *
 * Usage:
 *   const v = new Validator(req.body);
 *   const name = v.string('name', { max: 255 });
 *   const date = v.date('fromDate');
 *   v.assert(); // throws a 400 with field-level details if anything failed
 */

type Body = Record<string, unknown>;

interface StringRules {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
  trim?: boolean;
}

export const PATTERNS = {
  biometricId: /^\d{4}$/,
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  time24: /^([01]\d|2[0-3]):[0-5]\d$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export class Validator {
  private readonly body: Body;
  readonly errors: Record<string, string> = {};

  constructor(body: unknown) {
    this.body = body && typeof body === 'object' && !Array.isArray(body) ? (body as Body) : {};
  }

  private fail(field: string, message: string) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  raw(field: string): unknown {
    return this.body[field];
  }

  string(field: string, rules: StringRules = {}): string {
    const { required = true, min = required ? 1 : 0, max = 1000, pattern, patternMessage, trim = true } = rules;
    const value = this.body[field];
    if (value === undefined || value === null || value === '') {
      if (required) this.fail(field, 'This field is required.');
      return '';
    }
    if (typeof value !== 'string') {
      this.fail(field, 'Must be text.');
      return '';
    }
    const out = trim ? value.trim() : value;
    if (out.length < min) this.fail(field, required && min <= 1 ? 'This field is required.' : `Must be at least ${min} characters.`);
    else if (out.length > max) this.fail(field, `Must be at most ${max} characters.`);
    else if (pattern && !pattern.test(out)) this.fail(field, patternMessage || 'Invalid format.');
    return out;
  }

  optionalString(field: string, rules: Omit<StringRules, 'required'> = {}): string | null {
    const out = this.string(field, { ...rules, required: false });
    return out ? out : null;
  }

  oneOf<T extends string>(field: string, allowed: readonly T[], required = true): T | null {
    const value = this.body[field];
    if (value === undefined || value === null || value === '') {
      if (required) this.fail(field, 'This field is required.');
      return null;
    }
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      this.fail(field, 'Invalid value.');
      return null;
    }
    return value as T;
  }

  int(field: string, { required = true, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}): number | null {
    const value = this.body[field];
    if (value === undefined || value === null || value === '') {
      if (required) this.fail(field, 'This field is required.');
      return null;
    }
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isInteger(n)) {
      this.fail(field, 'Must be a whole number.');
      return null;
    }
    if (n < min || n > max) {
      this.fail(field, `Must be between ${min} and ${max}.`);
      return null;
    }
    return n;
  }

  bool(field: string, fallback = false): boolean {
    const value = this.body[field];
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    this.fail(field, 'Must be true or false.');
    return fallback;
  }

  /** Calendar date as YYYY-MM-DD; rejects impossible dates such as 2026-02-31. */
  date(field: string, required = true): string | null {
    const value = this.string(field, { required, pattern: PATTERNS.isoDate, patternMessage: 'Use the format YYYY-MM-DD.' });
    if (!value) return null;
    if (!isValidIsoDate(value)) {
      this.fail(field, 'Not a valid date.');
      return null;
    }
    return value;
  }

  assert(message = 'Please correct the highlighted fields.') {
    if (Object.keys(this.errors).length > 0) throw badRequest(message, this.errors);
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!PATTERNS.isoDate.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's date in India (YYYY-MM-DD), independent of the server's timezone. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
