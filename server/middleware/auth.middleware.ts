import { Request, Response, NextFunction } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Forbidden' });
};
