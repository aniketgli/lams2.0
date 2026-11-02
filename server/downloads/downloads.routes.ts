import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth, requireModule } from '../middleware/auth.middleware';
import { logDownload, parseDownload } from './downloadAudit';

/** POST /api/hrms/downloads/log: records that the signed-in user is downloading a screen's data (see downloadAudit.ts). */
const router = Router();

router.post('/downloads/log', requireAuth, requireModule('hrms'), asyncHandler(async (req, res) => {
  await logDownload(req, parseDownload(req.body));
  res.json({ logged: true });
}));

export default router;
