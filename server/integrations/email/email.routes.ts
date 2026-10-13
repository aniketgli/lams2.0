import { Router } from 'express';
import { isAuthenticated, isAdmin } from '../../middleware/auth.middleware';
import { EmailController } from './email.controller';

const router = Router();

router.use(isAuthenticated, isAdmin);
router.get('/logs', EmailController.getLogs);
router.post('/test-smtp', EmailController.testSmtp);
router.post('/send', EmailController.send);

export const emailRoutes = router;
