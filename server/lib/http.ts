import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * An error that is safe to show to the client. Anything else that reaches the
 * error handler is treated as an internal error and its message is hidden.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: Record<string, string>) => new HttpError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message, 'UNAUTHENTICATED');
export const forbidden = (message = 'You do not have permission to do this.', code = 'FORBIDDEN') => new HttpError(403, message, code);
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'NOT_FOUND');
export const tooManyRequests = (message: string) => new HttpError(429, message, 'RATE_LIMITED');

/**
 * Express 4 does not forward rejected promises to the error handler; without
 * this wrapper a thrown error in an async route leaves the request hanging.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}

/** Promise wrappers around the callback-style express-session API. */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => req.session.destroy(() => resolve()));
}

export const SESSION_COOKIE = 'wii.sid';

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    // Must match how the cookie was set (see `secure: 'auto'` in app.ts).
    secure: res.req.secure,
    path: '/',
  });
}

/**
 * Content-Disposition for a download whose name came from a user (an uploaded certificate).
 * Node refuses header values with characters outside Latin-1, so a Hindi or emoji file name used to turn
 * the download into a 500 error. The plain `filename` gets an ASCII copy of the name; `filename*` (RFC 6266)
 * carries the real name for browsers.
 */
export function attachmentDisposition(name: string, fallback = 'download'): string {
  const cleaned = String(name ?? '').replace(/[\r\n"\\/]/g, '_').trim();
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 ? cleaned.slice(dot).replace(/[^A-Za-z0-9.]/g, '') : '';
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const asciiStem = stem.replace(/[^\x20-\x7e]/g, '_').replace(/_+/g, '_').trim();
  // Nothing readable left (a name written entirely in another script): use the fallback name.
  const ascii = /[A-Za-z0-9]/.test(asciiStem) ? `${asciiStem}${ext}` : `${fallback}${ext}`;
  const encoded = encodeURIComponent(cleaned || ascii).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
