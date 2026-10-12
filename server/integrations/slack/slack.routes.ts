import { Router } from 'express';
import { SlackController } from './slack.controller';

const router = Router();

router.post('/notify', SlackController.notify);

export const slackRoutes = router;
