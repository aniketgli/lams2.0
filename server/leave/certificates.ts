import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { badRequest } from '../lib/http';

/**
 * Medical certificate of a leave request. The browser sends `{ name, data }` where data is a
 * `data:...;base64,...` URL. The file type is decided from the file's own bytes, never from its name or
 * the declared type; only PDF, JPEG and PNG are kept, up to 1 MB.
 */

export const CERTIFICATE_MAX_BYTES = 1024 * 1024;
export type CertificateMime = 'application/pdf' | 'image/jpeg' | 'image/png';
export interface CertificateFile { name: string; mime: CertificateMime; bytes: Buffer }

export function detectCertificateType(bytes: Buffer): CertificateMime | null {
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

const EXTENSION: Record<CertificateMime, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Null when nothing was sent; throws a field error when the file is not acceptable. */
export function parseCertificate(raw: unknown): CertificateFile | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const fail = (message: string) => badRequest('Please correct the highlighted fields.', { certificate: message });
  if (typeof raw !== 'object') throw fail('The medical certificate could not be read.');
  const { name, data } = raw as Record<string, unknown>;
  if (typeof data !== 'string') throw fail('The medical certificate could not be read.');
  const match = /^data:[a-z0-9+./-]*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(data);
  if (!match) throw fail('The medical certificate could not be read.');
  const bytes = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (bytes.length === 0) throw fail('The medical certificate file is empty.');
  if (bytes.length > CERTIFICATE_MAX_BYTES) throw fail('Use a medical certificate smaller than 1 MB.');
  const mime = detectCertificateType(bytes);
  if (!mime) throw fail('The medical certificate must be a PDF, JPEG or PNG file.');
  const cleaned = (typeof name === 'string' ? name : '').replace(/[\\/\r\n"]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  const base = cleaned.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'medical-certificate';
  return { name: `${base}.${EXTENSION[mime]}`, mime, bytes };
}

export async function saveCertificate(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, requestId: number, file: CertificateFile, userId: number,
): Promise<void> {
  await conn.query(
    `INSERT INTO leave_certificates (request_id, file_name, mime_type, size_bytes, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), data = VALUES(data),
       uploaded_by = VALUES(uploaded_by), uploaded_at = CURRENT_TIMESTAMP(3)`,
    [requestId, file.name, file.mime, file.bytes.length, file.bytes, userId],
  );
}

export async function loadCertificate(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, requestId: number,
): Promise<{ name: string; mime: CertificateMime; data: Buffer } | null> {
  const [rows] = (await conn.query('SELECT file_name, data FROM leave_certificates WHERE request_id = ? LIMIT 1', [requestId])) as [RowDataPacket[], unknown];
  const row = rows[0];
  if (!row) return null;
  const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  // Serve only what the bytes really are, whatever the stored label says.
  const mime = detectCertificateType(data);
  return mime ? { name: String(row.file_name), mime, data } : null;
}

