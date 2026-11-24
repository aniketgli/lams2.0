import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth, requirePeopleModule } from '../middleware/auth.middleware';
import { scopedViewerOf } from '../lib/peopleScope';
import { buildDashboard } from './store';

/** GET /api/hrms/dashboard: the dashboard of the signed-in user's active role, in HRMS or PMS (its own employees). */
const router = Router();

router.get('/dashboard', requireAuth, requirePeopleModule, asyncHandler(async (req, res) => {
  res.json(await buildDashboard(await scopedViewerOf(req)));
}));

export default router;
