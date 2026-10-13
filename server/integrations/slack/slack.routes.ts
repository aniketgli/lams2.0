import { Router } from 'express';
import { isAuthenticated } from '../../middleware/auth.middleware';
import { SlackController } from './slack.controller';

const router = Router();

router.post('/notify', isAuthenticated, SlackController.notify);

export const slackRoutes = router;
