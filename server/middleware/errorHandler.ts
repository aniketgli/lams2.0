import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error'
  });
}
