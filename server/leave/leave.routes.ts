import { Router, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import {
  LEAVE_TYPE_SCOPE, createLeaveType, deleteLeaveType, leaveTypeId, leaveTypeOptions, listLeaveTypes, updateLeaveType,
} from './types';

/**
 * Leave policy (/api/hrms/leave-types).
 *   read:   every signed-in user (the apply form needs the types)
 *   change: administrator only
 *   logs:   auditor, with CSV / PDF downloads that are logged too
 */
const router = Router();
const isAdmin = [requireAuth, requireActiveRole('hrms', 'administrator')];
const isAuditor = [requireAuth, requireActiveRole('hrms', 'audit')];

router.get('/leave-types', requireAuth, asyncHandler(async (_req, res) => {
  const [types, options] = await Promise.all([listLeaveTypes(), leaveTypeOptions()]);
  res.json({ types, ...options });
}));

router.get('/leave-types/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, LEAVE_TYPE_SCOPE), LEAVE_TYPE_SCOPE));
}));

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}
router.get('/leave-types/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_TYPE_SCOPE), LEAVE_TYPE_SCOPE));
}));
router.get('/leave-types/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_TYPE_SCOPE), 'pdf', LEAVE_TYPE_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.post('/leave-types', ...isAdmin, asyncHandler(async (req, res) => {
  const leaveType = await createLeaveType(req, req.body);
  res.status(201).json({ leaveType, message: `Leave type "${leaveType.name}" created.` });
}));

router.put('/leave-types/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const leaveType = await updateLeaveType(req, leaveTypeId(req.params.id), req.body);
  res.json({ leaveType, message: `Leave type "${leaveType.name}" updated.` });
}));

router.delete('/leave-types/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteLeaveType(req, leaveTypeId(req.params.id), reason);
  res.json({ success: true, message: 'Leave type deleted.' });
}));

export default router;
