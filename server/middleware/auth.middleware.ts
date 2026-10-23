import { Request, Response, NextFunction } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { users, user_module_roles } from '../../src/db/schema';

function isValidityCurrent(validUpto: string | null | undefined): boolean {
  if (!validUpto) return false;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return validUpto >= today;
}

const roleMap: Record<string, string> = {
  'hrms_admin': 'administrator', 'administrator': 'administrator',
  'hrms_reporting': 'reporting_manager', 'reporting manager': 'reporting_manager',
  'hrms_reviewing': 'reviewing_manager', 'hod': 'reviewing_manager',
  'hrms_staff': 'general_staff', 'user': 'general_staff',
  'hrms_auditor': 'audit', 'auditor': 'audit'
};
const normalize = (role: string) => roleMap[role.toLowerCase()] || role.toLowerCase();

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  const biometricId = req.session?.biometricId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const [user] = await db.select({ id: users.id, status: users.status, validUpto: users.validUpto }).from(users).where(eq(users.id, Number(userId)));
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }
    if (user.status !== 'active' || !isValidityCurrent(user.validUpto)) {
      req.session.destroy(() => undefined);
      res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      return res.status(403).json({ message: user.status === 'inactive' ? 'Account is inactive. Please contact administrator.' : user.status === 'expired' || !isValidityCurrent(user.validUpto) ? 'Account validity has expired or is not configured. Please contact administrator.' : 'Account is not active.' });
    }
    if (req.session.activeRole) {
      const assignments = await db.select({ roleId: user_module_roles.roleId }).from(user_module_roles)
        .where(and(eq(user_module_roles.biometricId, biometricId!), eq(user_module_roles.moduleId, 'hrms')));
      const active = normalize(req.session.activeRole);
      if (!assignments.some((item) => normalize(item.roleId) === active)) {
        req.session.activeRole = null;
        req.session.role = undefined;
        return res.status(403).json({ message: 'Your active role is no longer assigned.' });
      }
      req.session.role = active;
    }
    return next();
  } catch (error) {
    console.error('Authentication validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to validate the signed-in user.' });
  }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const assignments = await db.select({ roleId: user_module_roles.roleId }).from(user_module_roles)
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.moduleId, 'hrms')));
    if (!assignments.some((item) => normalize(item.roleId) === 'administrator')) {
      return res.status(403).json({ message: 'Administrator access required.' });
    }
    req.session.role = 'administrator';
    return next();
  } catch (error) {
    console.error('Administrator validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to validate administrator access.' });
  }
};
