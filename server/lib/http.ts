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
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
