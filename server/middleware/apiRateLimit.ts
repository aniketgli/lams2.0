import type { Request, RequestHandler } from 'express';
import { AttemptLimiter } from '../lib/rateLimit';
import { tooManyRequests } from '../lib/http';

/**
 * Request rate limits for the API, on top of the sign-in, CAPTCHA and change-password limits.
 *
 *   per network address   every /api request          API_RATE_PER_MINUTE        (default 1200 / minute)
 *   per signed-in account  every change (POST/PUT/...) API_WRITES_PER_MINUTE      (default 60 / minute)
 *   heavy actions          see `limitHeavy` below       (imports, test emails, sending reports, uploads)
 *
 * The numbers are far above what a person clicking through the portal produces, so only scripts and
 * runaway loops are stopped. Counters are kept in this server process.
 */
function perMinute(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 10 ? Math.floor(raw) : fallback;
}

const MINUTE = 60 * 1000;

export function rateLimiter(max: number, windowMs: number, keyOf: (req: Request) => string | null, message: string): RequestHandler {
  const limiter = new AttemptLimiter(max, windowMs);
  return (req, res, next) => {
    const key = keyOf(req);
    if (!key) return next();
    const wait = limiter.retryAfter(key);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      return next(tooManyRequests(message));
    }
    limiter.fail(key); // counts this request
    next();
  };
}

const ipOf = (req: Request): string => req.ip || req.socket?.remoteAddress || 'unknown';
const accountOf = (req: Request): string | null => {
  const id = Number(req.session?.userId);
  return Number.isSafeInteger(id) && id > 0 ? `user:${id}` : null;
};
const isWrite = (req: Request): boolean => !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

/** Every API request, per network address. */
export const apiRateLimit: RequestHandler = rateLimiter(
  perMinute('API_RATE_PER_MINUTE', 1200), MINUTE, (req) => `ip:${ipOf(req)}`,
  'Too many requests from this computer. Please wait a minute and try again.',
);

/** Changes (create, update, delete, approve, ...), per signed-in account. */
export const writeRateLimit: RequestHandler = rateLimiter(
  perMinute('API_WRITES_PER_MINUTE', 60), MINUTE, (req) => (isWrite(req) ? accountOf(req) : null),
  'Too many changes in a short time. Please wait a minute and try again.',
);

/**
 * Expensive actions (bulk imports, SMTP tests, sending a report now, email resends, photo uploads):
 * `max` per account every 10 minutes, counted separately for each action.
 */
export function limitHeavy(action: string, max = 20): RequestHandler {
  return rateLimiter(max, 10 * MINUTE, (req) => {
    const account = accountOf(req);
    return account ? `${action}:${account}` : `${action}:ip:${ipOf(req)}`;
  }, 'This action was repeated too often. Please wait a few minutes and try again.');
}
