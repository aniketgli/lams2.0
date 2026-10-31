import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import {
  LEAVE_TYPE_SCOPE, createLeaveType, deleteLeaveType, leaveTypeId, leaveTypeOptions, listLeaveTypes, updateLeaveType,
} from './types';
import {
  LEAVE_SCOPE, applicableEmployees, createRequest, decideRequest, deleteRequest, listBalances, listRequests, previewLeave, requestId, setBalance,
  undoDecision, updateRequest,
} from './requests';

/**
 * Leave policy (/api/hrms/leave-types) and leave (/api/hrms/leave/...).
 *   types:    everyone signed in reads; administrator changes
 *   requests: list scoped by active role; apply (staff for self, administrator for anyone); edit / delete before it is looked at;
 *             decide (reporting manager stage 1, HoD stage 2, administrator any); undo
 *   balances: list scoped by role; administrator sets
 *   logs:     auditor, with CSV / PDF downloads that are logged too
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

// ---- Leave requests and balances -------------------------------------------------------------
const viewerOf = (req: Request) => ({ id: req.auth!.account.id, role: req.auth!.activeRole });

router.get('/leave/requests', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const viewer = viewerOf(req);
  const [list, employees, types] = await Promise.all([listRequests(viewer, { from: q.from, to: q.to }), applicableEmployees(viewer), listLeaveTypes()]);
  res.json({ ...list, employees, types: types.filter((t) => t.status === 'active') });
}));

router.get('/leave/preview', requireAuth, asyncHandler(async (req, res) => {
  res.json(await previewLeave(viewerOf(req), req.query as Record<string, unknown>));
}));

router.get('/leave/balances', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listBalances(viewerOf(req), (req.query as Record<string, unknown>).year));
}));

router.put('/leave/balances', requireAuth, asyncHandler(async (req, res) => {
  const balance = await setBalance(req, viewerOf(req), req.body);
  res.json({ balance, message: 'Leave balance saved.' });
}));

// Auditor log routes come before /:id so "activity" is never read as an ID.
router.get('/leave/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, LEAVE_SCOPE), LEAVE_SCOPE));
}));
router.get('/leave/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_SCOPE), LEAVE_SCOPE));
}));
router.get('/leave/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_SCOPE), 'pdf', LEAVE_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.post('/leave/requests', requireAuth, asyncHandler(async (req, res) => {
  const request = await createRequest(req, viewerOf(req), req.body);
  res.status(201).json({ request, message: 'Leave request submitted.' });
}));

router.put('/leave/requests/:id', requireAuth, asyncHandler(async (req, res) => {
  const { request, changed } = await updateRequest(req, viewerOf(req), requestId(req.params.id), req.body);
  res.json({ request, changed, message: changed.length ? 'Request updated.' : 'No changes to save.' });
}));

router.post('/leave/requests/:id/decision', requireAuth, asyncHandler(async (req, res) => {
  const { request, outcome } = await decideRequest(req, viewerOf(req), requestId(req.params.id), req.body);
  res.json({ request, outcome, message: outcome === 'approved' ? 'Leave approved.' : outcome === 'forwarded' ? 'Leave forwarded to the HoD.' : 'Leave rejected.' });
}));

router.post('/leave/requests/:id/undo', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 400 });
  v.assert();
  const request = await undoDecision(req, viewerOf(req), requestId(req.params.id), reason);
  res.json({ request, message: 'Step undone.' });
}));

router.delete('/leave/requests/:id', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteRequest(req, viewerOf(req), requestId(req.params.id), reason);
  res.json({ success: true, message: 'Request deleted.' });
}));

export default router;
