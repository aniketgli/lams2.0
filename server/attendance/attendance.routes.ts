import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth.middleware';
import { listAttendance } from './store';

/**
 * Biometric attendance (/api/hrms/attendance), read-only.
 *   GET /attendance?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=]
 * Each signed-in user gets the people their active role may see
 * (self; managers also their team; administrators and auditors everyone).
 */
const router = Router();

router.get('/attendance', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  res.json(await listAttendance({ id: req.auth!.account.id, role: req.auth!.activeRole }, { from: q.from, to: q.to, userId: q.userId }));
}));

export default router;
