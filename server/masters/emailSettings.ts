import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { email_settings } from '../../src/db/schema';
import { envConfig } from '../config/env.config';

/**
 * Email sender + SMTP server settings.
 *
 * Saved in the database from Master Settings > Organization. When nothing is
 * saved yet, the SMTP_* / EMAIL_FROM* values from .env are used, so existing
 * installations keep working.
 *
 * The SMTP password is encrypted with AES-256-GCM. The key comes from
 * SETTINGS_ENCRYPTION_KEY (recommended) or, if unset, is derived from
 * SESSION_SECRET. Changing that key means the password must be entered again.
 */

export type SmtpSecurity = 'none' | 'starttls' | 'ssl';

export interface EmailTransportConfig {
  source: 'database' | 'env' | 'none';
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string | null;
  password: string | null;
}

/** What the browser sees: never the password itself. */
export interface EmailSettingsView {
  source: 'database' | 'env' | 'none';
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

// ---- Encryption ----------------------------------------------------------------

function key(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'local-development-only-settings-key';
  return createHash('sha256').update(`wii-settings:${raw}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(':');
    if (version !== 'v1') return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    console.warn('[email] stored SMTP password could not be decrypted (encryption key changed?); re-enter it in Master Settings.');
    return null;
  }
}

// ---- Loading ----------------------------------------------------------------------

export function normalizeSecurity(value: unknown, port?: number): SmtpSecurity {
  if (value === 'none' || value === 'starttls' || value === 'ssl') return value;
  return port === 465 ? 'ssl' : 'starttls';
}

function fromEnv(): EmailTransportConfig {
  const host = envConfig.smtpHost || '';
  return {
    source: host ? 'env' : 'none',
    enabled: true,
    fromName: envConfig.emailFromName,
    fromEmail: envConfig.emailFrom,
    replyTo: null,
    host,
    port: envConfig.smtpPort,
    security: envConfig.smtpSecure ? 'ssl' : 'starttls',
    user: envConfig.smtpUser || null,
    password: envConfig.smtpPass || null,
  };
}

export async function loadEmailSettingsRow() {
  try {
    const [row] = await db.select().from(email_settings).where(eq(email_settings.id, 'default'));
    return row ?? null;
  } catch (error) {
    if ((error as { code?: string; cause?: { code?: string } })?.code === 'ER_NO_SUCH_TABLE'
      || (error as { cause?: { code?: string } })?.cause?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

const CACHE_MS = 60_000;
let cache: { at: number; config: EmailTransportConfig } | null = null;

export function invalidateEmailSettingsCache() {
  cache = null;
}

/** Settings used to send email: database first, then .env. */
export async function resolveEmailTransport(): Promise<EmailTransportConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.config;
  const row = await loadEmailSettingsRow().catch((error) => {
    console.warn('[email] could not load email settings, using .env:', error instanceof Error ? error.message : error);
    return null;
  });
  const config: EmailTransportConfig = row
    ? {
        source: 'database',
        enabled: Boolean(row.enabled),
        fromName: row.fromName,
        fromEmail: row.fromEmail,
        replyTo: row.replyTo || null,
        host: row.smtpHost,
        port: Number(row.smtpPort),
        security: normalizeSecurity(row.smtpSecurity, Number(row.smtpPort)),
        user: row.smtpUser || null,
        password: decryptSecret(row.smtpPasswordEnc),
      }
    : fromEnv();
  cache = { at: Date.now(), config };
  return config;
}

export async function emailSettingsView(): Promise<EmailSettingsView> {
  const row = await loadEmailSettingsRow();
  if (row) {
    return {
      source: 'database',
      enabled: Boolean(row.enabled),
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyTo: row.replyTo ?? '',
      host: row.smtpHost,
      port: Number(row.smtpPort),
      security: normalizeSecurity(row.smtpSecurity, Number(row.smtpPort)),
      user: row.smtpUser ?? '',
      hasPassword: Boolean(row.smtpPasswordEnc),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }
  const env = fromEnv();
  return {
    source: env.source, enabled: env.enabled, fromName: env.fromName, fromEmail: env.fromEmail, replyTo: '',
    host: env.host, port: env.port, security: env.security, user: env.user ?? '', hasPassword: Boolean(env.password), updatedAt: null,
  };
}

/** nodemailer transport options for a config. Certificates are verified unless SMTP_ALLOW_SELF_SIGNED=true. */
export function transportOptions(config: EmailTransportConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: config.security === 'ssl',
    requireTLS: config.security === 'starttls',
    ignoreTLS: config.security === 'none',
    auth: config.user ? { user: config.user, pass: config.password ?? '' } : undefined,
    tls: { rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== 'true' },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  };
}
