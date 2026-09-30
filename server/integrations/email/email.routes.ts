import { Router } from 'express';
import { EmailController } from './email.controller';

const router = Router();

router.get('/logs', EmailController.getLogs);
router.post('/test-smtp', EmailController.testSmtp);
router.post('/send', EmailController.send);

export const emailRoutes = router;
