import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth, requireModule } from '../middleware/auth.middleware';
import { buildDashboard } from './store';

/** GET /api/hrms/dashboard: the dashboard of the signed-in user's active role. */
const router = Router();

router.get('/dashboard', requireAuth, requireModule('hrms'), asyncHandler(async (req, res) => {
  res.json(await buildDashboard({ id: req.auth!.account.id, role: req.auth!.activeRole }));
}));

export default router;
