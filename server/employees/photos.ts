import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { writeMasterAuditSql } from '../masters/audit';

/**
 * Profile photos (employee_photos). Each employee adds, replaces or removes
 * their own photo. The file type is decided from the image's own bytes, never
 * from the name or the declared type, and only JPEG, PNG and WebP are kept.
 */

export const PHOTO_MAX_BYTES = 512 * 1024;
const AUDIT_PHOTO = 'employee_photo';

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** The real image type from the first bytes, or null if it is not an accepted image. */
export function detectImageType(bytes: Buffer): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Reads `data:image/...;base64,...` sent by the browser and checks it.
 * Throws a 400 with a field error when the image is missing, too large or not an accepted type.
 */
export function parsePhotoUpload(body: unknown): { bytes: Buffer; mime: PhotoMime } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).image : undefined;
  if (typeof raw !== 'string' || !raw) throw badRequest('Choose a photo to upload.', { image: 'Choose a photo to upload.' });
  const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw);
  if (!match) throw badRequest('The photo could not be read.', { image: 'Upload a JPEG, PNG or WebP image.' });
  const bytes = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (bytes.length === 0) throw badRequest('The photo could not be read.', { image: 'The file is empty.' });
  if (bytes.length > PHOTO_MAX_BYTES) {
    throw badRequest('The photo is too large.', { image: `Use a photo smaller than ${Math.round(PHOTO_MAX_BYTES / 1024)} KB.` });
  }
  const mime = detectImageType(bytes);
  if (!mime) throw badRequest('This file is not a supported image.', { image: 'Upload a JPEG, PNG or WebP image.' });
  return { bytes, mime };
}

function stamp(value: unknown): number {
  const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Address of a photo. The version changes on every save, so browsers may cache it safely. */
export function photoUrl(biometricId: string, updatedAt: unknown): string {
  return `/api/hrms/photos/${encodeURIComponent(biometricId)}?v=${stamp(updatedAt)}`;
}

/** Photo addresses for many employees at once (missing table = no photos yet). */
export async function photoUrls(biometricIds: string[] | null = null): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (biometricIds && biometricIds.length === 0) return out;
  try {
    const where = biometricIds ? ` WHERE biometric_id IN (${biometricIds.map(() => '?').join(',')})` : '';
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT biometric_id, updated_at FROM employee_photos${where}`, biometricIds ?? []);
    for (const row of rows) out.set(String(row.biometric_id), photoUrl(String(row.biometric_id), row.updated_at));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

export async function loadPhoto(biometricId: string): Promise<{ mime: PhotoMime; data: Buffer; updatedAt: number } | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT mime_type, data, updated_at FROM employee_photos WHERE biometric_id = ? LIMIT 1', [biometricId]);
    const row = rows[0];
    if (!row) return null;
    const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    // Serve only what the bytes really are, whatever the stored label says.
    const mime = detectImageType(data);
    return mime ? { mime, data, updatedAt: stamp(row.updated_at) } : null;
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

/** Saves the signed-in user's own photo (new or replacement) and audits it. Returns the new address. */
export async function saveOwnPhoto(req: Request, body: unknown): Promise<string> {
  const { bytes, mime } = parsePhotoUpload(body);
  const account = req.auth!.account;
  try {
    return await inTransaction(async (conn) => {
      const [existing] = await conn.query<RowDataPacket[]>('SELECT byte_size, mime_type FROM employee_photos WHERE biometric_id = ? FOR UPDATE', [account.biometricId]);
      const before = existing[0];
      await conn.query(
        `INSERT INTO employee_photos (biometric_id, mime_type, byte_size, data, updated_by) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), byte_size = VALUES(byte_size), data = VALUES(data), updated_by = VALUES(updated_by)`,
        [account.biometricId, mime, bytes.length, bytes, account.biometricId],
      );
      // Only a description of the photo is audited, never the image itself.
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_PHOTO, recordId: account.biometricId, recordLabel: account.name,
        action: before ? 'UPDATE' : 'CREATE',
        before: before ? { photo: `${before.mime_type}, ${Math.ceil(Number(before.byte_size) / 1024)} KB` } : null,
        after: { photo: `${mime}, ${Math.ceil(bytes.length / 1024)} KB` },
      });
      const [saved] = await conn.query<RowDataPacket[]>('SELECT updated_at FROM employee_photos WHERE biometric_id = ?', [account.biometricId]);
      return photoUrl(account.biometricId, saved[0]?.updated_at ?? new Date());
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
      throw new HttpError(503, 'Profile photos are not set up yet. Ask the administrator to run the photo migration.', 'NOT_CONFIGURED');
    }
    throw error;
  }
}

/** Removes the signed-in user's own photo. Returns false if there was none. */
export async function deleteOwnPhoto(req: Request): Promise<boolean> {
  const account = req.auth!.account;
  try {
    return await inTransaction(async (conn) => {
      const [existing] = await conn.query<RowDataPacket[]>('SELECT byte_size, mime_type FROM employee_photos WHERE biometric_id = ? FOR UPDATE', [account.biometricId]);
      const before = existing[0];
      if (!before) return false;
      await conn.query('DELETE FROM employee_photos WHERE biometric_id = ?', [account.biometricId]);
      await writeMasterAuditSql(conn, req, {
        masterKey: AUDIT_PHOTO, recordId: account.biometricId, recordLabel: account.name, action: 'DELETE',
        before: { photo: `${before.mime_type}, ${Math.ceil(Number(before.byte_size) / 1024)} KB` },
      });
      return true;
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return false;
    throw error;
  }
}
