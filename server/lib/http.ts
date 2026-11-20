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

/**
 * Name of the session cookie. Browsers share cookies between every port of the same address, so another web app on
 * this server (another port) that also used "wii.sid" overwrote this app's cookie and signed users out — until they
 * cleared their browser data. The name is unique to this app and can be set with SESSION_COOKIE_NAME.
 */
const cookieName = String(process.env.SESSION_COOKIE_NAME ?? '').trim();
export const SESSION_COOKIE = /^[A-Za-z0-9._-]{3,40}$/.test(cookieName) ? cookieName : 'lams2.sid';
/** Name used before; removed from the browser at sign-in and sign-out. */
export const OLD_SESSION_COOKIES = ['wii.sid'].filter((name) => name !== SESSION_COOKIE);

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    // Must match how the cookie was set (see `secure: 'auto'` in app.ts).
    secure: res.req.secure,
    path: '/',
  });
  clearOldSessionCookies(res);
}

/** Drops cookies of the old name (they would only confuse a later sign-in). */
export function clearOldSessionCookies(res: Response) {
  const sent = String(res.req.headers.cookie ?? '');
  for (const name of OLD_SESSION_COOKIES) {
    if (sent.split(';').some((part) => part.trim().startsWith(`${name}=`))) res.clearCookie(name, { path: '/' });
  }
}

let lastDuplicateWarning = 0;
/**
 * When a browser sends the session cookie more than once (left over with another path or from another app), keep
 * only the last one, which is the newest sign-in for the same path. Logged (without values) so it can be traced.
 */
export function keepOneSessionCookie(req: Request, _res: Response, next: () => void) {
  const header = req.headers.cookie;
  if (header && header.split(`${SESSION_COOKIE}=`).length > 2) {
    const parts = header.split(';').map((p) => p.trim()).filter(Boolean);
    const ours = parts.filter((p) => p.startsWith(`${SESSION_COOKIE}=`));
    const others = parts.filter((p) => !p.startsWith(`${SESSION_COOKIE}=`));
    req.headers.cookie = [...others, ours[ours.length - 1]].join('; ');
    if (Date.now() - lastDuplicateWarning > 10 * 60 * 1000) {
      lastDuplicateWarning = Date.now();
      console.warn(`[session] a browser sent ${ours.length} "${SESSION_COOKIE}" cookies; the last one was used (${req.method} ${req.path}).`);
    }
  }
  next();
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
