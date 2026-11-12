import { Router } from 'express';
import { isAuthenticated, isAdmin, requireActiveRole } from '../../middleware/auth.middleware';
import { EmailController } from './email.controller';
import { asyncHandler } from '../../lib/http';

const router = Router();

// The email log is read by the administrator and the auditor; sending is the administrator's.
router.get('/logs', isAuthenticated, requireActiveRole('hrms', 'administrator', 'audit'), asyncHandler(EmailController.getLogs));
router.post('/logs/resend', isAuthenticated, ...isAdmin, asyncHandler(EmailController.resend));
router.post('/test-smtp', isAuthenticated, ...isAdmin, asyncHandler(EmailController.testSmtp));

export const emailRoutes = router;
