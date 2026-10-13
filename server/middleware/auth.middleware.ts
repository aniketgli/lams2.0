import { Request, Response, NextFunction } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId && typeof req.session.role === 'string' && req.session.role.toLowerCase() === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};
