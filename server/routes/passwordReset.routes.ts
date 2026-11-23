import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, asyncHandler, tooManyRequests } from '../lib/http';
import { AttemptLimiter } from '../lib/rateLimit';
import { captchaEnabled, verifyCaptcha } from '../lib/captcha';
import { Validator } from '../lib/validate';
import { normalizeLoginEmail } from '../config/auth.config';
import { accountBlockReason, clearAccessCache } from '../services/access.service';
import { destroyUserSessions } from '../lib/sessionStore';
import { passwordProblem } from '../lib/passwordPolicy';
import { isDefaultPassword } from '../masters/accountSettings';
import { REUSED_PASSWORD_MESSAGE, rememberPassword, reusesPassword } from '../lib/passwordHistory';
import { writeMasterAuditSql } from '../masters/audit';
import { inTransaction } from '../lib/tx';
import { EmailService } from '../integrations/email/email.service';
import { getOrganization } from '../masters/organizationStore';

/**
 * Forgot password: a 6-digit code is emailed to the account's institute email; with it the user sets a new password.
 *
 *   POST /api/auth/forgot-password  { email, captchaToken?, captchaAnswer? }  → always the same answer (no hint whether
 *                                    the account exists); a code is sent only to an active, valid account.
 *   POST /api/auth/reset-password   { email, otp, newPassword, confirmPassword }
 *
 * Rules: the code is valid for 10 minutes and for 5 tries, a new request replaces the old code, only a keyed hash of
 * the code is stored; at most 3 requests per email and 10 per IP address every 15 minutes, and 20 reset attempts per
 * IP. The new password follows the password rules and may not be the current one or one of the last five. After a
 * reset every session of the account ends and a confirmation email is sent.
 */
const router = Router();

const OTP_MINUTES = 10;
const OTP_TRIES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const requestsPerEmail = new AttemptLimiter(3, WINDOW_MS);
const requestsPerIp = new AttemptLimiter(10, WINDOW_MS);
const resetsPerIp = new AttemptLimiter(20, WINDOW_MS);

const SENT = `If this email belongs to an active account, a 6-digit code has been sent to it. The code is valid for ${OTP_MINUTES} minutes.`;
const BAD_CODE = 'The code is wrong or has expired. Request a new code.';

const secret = () => process.env.SESSION_SECRET || 'local-development-only-session-secret-change-me';
const otpHash = (userId: number, otp: string) => createHmac('sha256', secret()).update(`password-reset:${userId}:${otp}`).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function limited(res: import('express').Response, ...waits: number[]): void {
  const wait = Math.max(...waits);
  if (wait > 0) {
    res.setHeader('Retry-After', String(wait));
    throw tooManyRequests(`Too many requests. Try again in ${Math.ceil(wait / 60)} minute(s).`);
  }
}

interface ResetAccount { id: number; biometricId: string; name: string; email: string; passwordHash: string; status: string; validUpto: string | null; isSystem: boolean }

async function accountByEmail(email: string): Promise<ResetAccount | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, biometric_id, name, email, password_hash, status, DATE_FORMAT(valid_upto, '%Y-%m-%d') AS valid_upto, is_system
       FROM users WHERE LOWER(email) = ? LIMIT 1`, [email]);
  const r = rows[0];
  return r ? {
    id: Number(r.id), biometricId: String(r.biometric_id ?? ''), name: String(r.name ?? ''), email: String(r.email),
    passwordHash: String(r.password_hash), status: String(r.status), validUpto: r.valid_upto ? String(r.valid_upto) : null,
    isSystem: Number(r.is_system) === 1,
  } : null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function mail(to: ResetAccount, subject: string, lines: string[]): Promise<void> {
  const org = (await getOrganization())?.orgName || 'Wildlife Institute of India';
  const text = [`Dear ${to.name},`, '', ...lines, '', org].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b">
    <p>Dear ${escapeHtml(to.name)},</p>${lines.map((l) => `<p>${escapeHtml(l).replace(/\b(\d{6})\b/, '<b style="font-size:20px;letter-spacing:3px">$1</b>')}</p>`).join('')}
    <p style="color:#64748b">${escapeHtml(org)}</p></div>`;
  const result = await EmailService.sendEmail({ to: to.email, toName: to.name, subject, text, html, category: 'security', eventType: 'PASSWORD_RESET' });
  if (result.status !== 'delivered') console.warn(`[password-reset] mail to ${to.biometricId} not delivered: ${result.status}${result.error ? ` (${result.error})` : ''}`);
}

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const email = normalizeLoginEmail(v.raw('email'));
  if (!email) throw new HttpError(400, 'Enter your institute email.', 'VALIDATION_ERROR', { email: 'Enter your institute email.' });
  if (captchaEnabled() && !verifyCaptcha(v.raw('captchaToken'), v.raw('captchaAnswer'))) {
    throw new HttpError(400, 'The characters did not match. Try the new picture.', 'CAPTCHA_INVALID', { captcha: 'The characters did not match. Try the new picture.' });
  }
  const ip = req.ip || 'unknown';
  limited(res, requestsPerEmail.retryAfter(email), requestsPerIp.retryAfter(ip));
  requestsPerEmail.fail(email);
  requestsPerIp.fail(ip);

  const account = await accountByEmail(email);
  if (account && !accountBlockReason({ status: account.status, validUpto: account.validUpto, isSystem: account.isSystem })) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.query('DELETE FROM password_reset_otps WHERE user_id = ? OR expires_at < NOW(3)', [account.id]);
    await pool.query(
      'INSERT INTO password_reset_otps (user_id, otp_hash, expires_at, requested_ip) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL ? MINUTE), ?)',
      [account.id, otpHash(account.id, otp), OTP_MINUTES, ip.slice(0, 45)]);
    await mail(account, 'Password reset code', [
      `Your code to reset the portal password is ${otp}`,
      `It is valid for ${OTP_MINUTES} minutes. Do not share it with anyone; the institute never asks for it.`,
      'If you did not ask for this, ignore this email: your password stays the same.',
    ]).catch((e) => console.warn(`[password-reset] mail failed: ${(e as Error).message}`));
    console.info(`[password-reset] code sent to ${account.biometricId}`);
  }
  // Same answer whether or not the account exists, so the form cannot be used to find accounts.
  res.json({ success: true, message: SENT });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const email = normalizeLoginEmail(v.raw('email'));
  const otp = String(v.raw('otp') ?? '').trim();
  const newPassword = typeof v.raw('newPassword') === 'string' ? String(v.raw('newPassword')) : '';
  const confirm = v.raw('confirmPassword');
  const ip = req.ip || 'unknown';
  limited(res, resetsPerIp.retryAfter(ip));

  if (!email) throw new HttpError(400, 'Enter your institute email.', 'VALIDATION_ERROR', { email: 'Enter your institute email.' });
  if (!/^\d{6}$/.test(otp)) throw new HttpError(400, 'Enter the 6-digit code from the email.', 'VALIDATION_ERROR', { otp: 'Enter the 6-digit code from the email.' });

  const account = await accountByEmail(email);
  const [codes] = account
    ? await pool.query<RowDataPacket[]>('SELECT id, otp_hash, attempts FROM password_reset_otps WHERE user_id = ? AND expires_at > NOW(3) ORDER BY id DESC LIMIT 1', [account.id])
    : [[] as RowDataPacket[]];
  const code = codes[0];
  const blocked = account ? accountBlockReason({ status: account.status, validUpto: account.validUpto, isSystem: account.isSystem }) : 'no account';
  if (!account || !code || blocked || Number(code.attempts) >= OTP_TRIES || !sameHash(String(code.otp_hash), otpHash(account.id, otp))) {
    resetsPerIp.fail(ip);
    if (code) {
      // A code tried too often is used up.
      if (Number(code.attempts) + 1 >= OTP_TRIES) await pool.query('DELETE FROM password_reset_otps WHERE id = ?', [code.id]);
      else await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [code.id]);
    }
    throw new HttpError(400, BAD_CODE, 'OTP_INVALID', { otp: BAD_CODE });
  }

  // The code is right: now the new password (a wrong password does not use the code up).
  const problem = passwordProblem(newPassword, { email: account.email, biometricId: account.biometricId });
  if (problem) throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { newPassword: problem });
  if (confirm !== undefined && confirm !== newPassword) throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { confirmPassword: 'The two passwords do not match.' });
  if (await isDefaultPassword(newPassword)) throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { newPassword: 'The default password cannot be used as your own password.' });
  if (await reusesPassword(pool, account.id, newPassword, account.passwordHash)) {
    throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { newPassword: REUSED_PASSWORD_MESSAGE });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await inTransaction(async (conn) => {
    // The code is used once: deleting it under the transaction makes a second use with the same code fail.
    const [del] = await conn.query('DELETE FROM password_reset_otps WHERE id = ?', [code.id]);
    if (!(del as { affectedRows?: number }).affectedRows) throw new HttpError(400, BAD_CODE, 'OTP_INVALID', { otp: BAD_CODE });
    await rememberPassword(conn, account.id, account.passwordHash);
    await conn.query(
      `UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(),
              last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ? WHERE id = ?`,
      [passwordHash, account.biometricId, 'Password reset with an emailed code', account.id]);
    await conn.query('DELETE FROM password_reset_otps WHERE user_id = ?', [account.id]);
    await writeMasterAuditSql(conn, req, {
      masterKey: 'employee_password', recordId: account.biometricId, recordLabel: account.name, action: 'UPDATE',
      before: { changedBy: null }, after: { changedBy: 'self', via: 'emailed code' },
    });
  });
  requestsPerEmail.reset(email);
  clearAccessCache();
  await destroyUserSessions(account.id);
  console.info(`[password-reset] password reset for ${account.biometricId}`);
  await mail(account, 'Your password was changed', [
    'The password of your portal account was just reset with a code sent to this email.',
    'If this was not you, contact the administrator at once.',
  ]).catch(() => undefined);
  res.json({ success: true, message: 'Your password has been reset. Sign in with the new password.' });
}));

export default router;
