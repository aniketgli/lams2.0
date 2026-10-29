import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { requireAuth } from '../../middleware/auth.middleware';
import { SlackController } from './slack.controller';

const router = Router();

router.post('/notify', requireAuth, asyncHandler(SlackController.notify));

export const slackRoutes = router;
