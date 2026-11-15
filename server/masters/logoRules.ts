import { detectImageType } from '../lib/fileTypes';

/**
 * The organization logo (Master Settings → Organization). It is sent to every visitor of the sign-in page,
 * so it is kept small, and only a real PNG / JPEG / WebP is stored: the type is read from the file's own
 * bytes, not from the label in the data URL.
 */
export const LOGO_MAX_BYTES = 1024 * 1024;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
export const LOGO_ERROR = 'Logo must be a PNG, JPG or WEBP image under 1 MB.';

/** Null when the logo is acceptable (or empty), otherwise the message for the field. */
export function logoProblem(value: string | null): string | null {
  if (!value) return null;
  if (value.length > Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64) return LOGO_ERROR;
  const match = DATA_URL.exec(value);
  if (!match) return LOGO_ERROR;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return LOGO_ERROR;
  const actual = detectImageType(bytes);
  const declared = match[1] === 'png' ? 'image/png' : match[1] === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return actual === declared ? null : LOGO_ERROR;
}
