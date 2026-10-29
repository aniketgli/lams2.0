import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http';

/**
 * Last stop for every error. Known HttpErrors are returned as-is; anything
 * else is logged in full on the server and reported to the client as a
 * generic 500, so stack traces and SQL details never leak.
 *
 * Response shape (all API errors):  { message, code?, details? }
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
  }

  // Malformed JSON body from express.json()
  const anyErr = err as { type?: string; status?: number };
  if (anyErr?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON.', code: 'BAD_JSON' });
  }
  if (anyErr?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request is too large.', code: 'TOO_LARGE' });
  }

  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ message: 'Something went wrong on the server. Please try again.', code: 'INTERNAL' });
}

/** Unknown /api routes return JSON 404 instead of falling through to the SPA. */
export function apiNotFound(req: Request, res: Response) {
  res.status(404).json({ message: `No API route for ${req.method} ${req.baseUrl}${req.path}`, code: 'NOT_FOUND' });
}
