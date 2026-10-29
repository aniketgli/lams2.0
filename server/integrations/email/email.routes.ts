import { Router } from 'express';
import { isAuthenticated, isAdmin } from '../../middleware/auth.middleware';
import { EmailController } from './email.controller';
import { asyncHandler } from '../../lib/http';

const router = Router();

router.use(isAuthenticated, isAdmin);
router.get('/logs', EmailController.getLogs);
router.post('/test-smtp', asyncHandler(EmailController.testSmtp));
router.post('/send', asyncHandler(EmailController.send));

export const emailRoutes = router;
