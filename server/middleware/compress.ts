import type { RequestHandler } from 'express';
import { gzip } from 'zlib';

/** Smaller bodies are not worth compressing. */
export const GZIP_MIN_BYTES = 1024;

/** True when the client accepts gzip and the body is big enough to benefit. */
export function shouldGzip(acceptEncoding: string | undefined, bytes: number): boolean {
  return bytes >= GZIP_MIN_BYTES && /\bgzip\b/i.test(acceptEncoding ?? '');
}

/**
 * Compresses JSON API responses. Attendance, leave and report lists are large repetitive
 * JSON that shrinks 5-10 times, which matters when thousands of people load them together.
 * (Only `res.json` is handled; files and images are sent as they are.)
 */
export const compressJson: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    const text = JSON.stringify(body ?? null);
    const bytes = Buffer.byteLength(text);
    res.vary('Accept-Encoding');
    if (!shouldGzip(req.get('accept-encoding'), bytes) || res.headersSent) return json(body);
    gzip(text, { level: 5 }, (error, packed) => {
      if (error) { json(body); return; }
      if (!res.getHeader('Content-Type')) res.type('application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', packed.length);
      res.end(packed);
    });
    return res;
  };
  next();
};
