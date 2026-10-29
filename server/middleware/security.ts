import type { RequestHandler } from 'express';

/** Basic hardening headers for every response. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
};

/**
 * CSRF protection for the JSON API.
 *
 * The session cookie is SameSite=Lax, and in addition every state-changing
 * request must (a) come from this site's own origin when the browser says
 * where it came from, and (b) be sent as JSON. Cross-site HTML forms can do
 * neither, and cross-site fetch() with JSON triggers a CORS preflight that
 * this server never approves.
 */
export const csrfGuard: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const origin = req.get('origin');
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = '';
    }
    const host = req.get('x-forwarded-host') && req.app.get('trust proxy') ? req.get('x-forwarded-host') : req.get('host');
    if (!originHost || originHost !== host) {
      return res.status(403).json({ message: 'Cross-site request blocked.', code: 'CSRF' });
    }
  }

  const hasBody = Number(req.get('content-length') || 0) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ message: 'Requests must be sent as JSON.', code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  next();
};

/** API responses carry personal data; never let browsers or proxies cache them. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};
