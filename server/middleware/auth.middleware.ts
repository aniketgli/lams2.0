import { Request, Response, NextFunction } from 'express';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Treat MySQL as the authority for the signed-in identity and role.
 * This avoids stale session roles after an administrator changes a user's role.
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }

    req.session.role = user.role;
    return next();
  } catch (error) {
    console.error('Authenticated identity validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to validate the signed-in user.' });
  }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }

    req.session.role = user.role;
    if (['admin', 'administrator'].includes(String(user.role).toLowerCase())) return next();
    return res.status(403).json({ message: 'Administrator access required.' });
  } catch (error) {
    console.error('Administrator identity validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to validate administrator access.' });
  }
};
