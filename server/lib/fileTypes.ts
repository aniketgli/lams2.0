/** File types decided from a file's own first bytes (never from its name or declared type). */

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** The real image type from the first bytes, or null if it is not an accepted image. */
export function detectImageType(bytes: Buffer): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
