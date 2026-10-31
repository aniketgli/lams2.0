import { applyImport, importTemplate, reviewImport } from './balanceImport';
import { Router, type Request, type Response } from 'express';
import { pool } from '../../src/db';
import { asyncHandler } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import {
  LEAVE_TYPE_SCOPE, createLeaveType, deleteLeaveType, leaveTypeId, leaveTypeOptions, listLeaveTypes, updateLeaveType,
} from './types';
import {
  LEAVE_GROUP_SCOPE, createLeaveGroup, deleteLeaveGroup, groupLeaveTypeIdsOfUser, listLeaveGroups, updateLeaveGroup,
} from './groups';
import {
  LEAVE_SCOPE, applicableEmployees, certificateOf, createRequest, decideRequest, deleteRequest, leaveHistory, listBalancesPage, listRequests, previewLeave, requestId, setBalance,
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

// ---- Leave groups: everyone signed in reads, administrator changes, auditor reads the log ----------
router.get('/leave-groups', requireAuth, asyncHandler(async (_req, res) => {
  res.json(await listLeaveGroups());
}));
router.get('/leave-groups/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, LEAVE_GROUP_SCOPE), LEAVE_GROUP_SCOPE));
}));
router.get('/leave-groups/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_GROUP_SCOPE), LEAVE_GROUP_SCOPE));
}));
router.get('/leave-groups/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, LEAVE_GROUP_SCOPE), 'pdf', LEAVE_GROUP_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));
router.post('/leave-groups', ...isAdmin, asyncHandler(async (req, res) => {
  const group = await createLeaveGroup(req, req.body);
  res.status(201).json({ group, message: `Leave group "${group.name}" created.` });
}));
router.put('/leave-groups/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const group = await updateLeaveGroup(req, leaveTypeId(req.params.id), req.body);
  res.json({ group, message: `Leave group "${group.name}" updated.` });
}));
router.delete('/leave-groups/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteLeaveGroup(req, leaveTypeId(req.params.id), reason);
  res.json({ success: true, message: 'Leave group deleted.' });
}));

// ---- Leave requests and balances -------------------------------------------------------------
const viewerOf = (req: Request) => ({ id: req.auth!.account.id, role: req.auth!.activeRole });

router.get('/leave/requests', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const viewer = viewerOf(req);
  const [list, employees, types] = await Promise.all([listRequests(viewer, { from: q.from, to: q.to }), applicableEmployees(viewer), listLeaveTypes()]);
  // A staff member applies only for the leave types of their own leave group.
  const own = viewer.role === 'general_staff' ? await groupLeaveTypeIdsOfUser(pool, viewer.id) : null;
  res.json({ ...list, employees, types: types.filter((t) => t.status === 'active' && (!own || own.has(Number(t.id)))) });
}));

router.get('/leave/preview', requireAuth, asyncHandler(async (req, res) => {
  res.json(await previewLeave(viewerOf(req), req.query as Record<string, unknown>));
}));

router.get('/leave/balances', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listBalancesPage(viewerOf(req), (req.query as Record<string, unknown>).year));
}));

router.put('/leave/balances', requireAuth, asyncHandler(async (req, res) => {
  const balance = await setBalance(req, viewerOf(req), req.body);
  res.json({ balance, message: 'Leave balance saved.' });
}));

router.get('/leave/balances/import/template', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  res.json(await importTemplate(viewerOf(req), q.year, q.cycle));
}));

router.get('/leave/balances/history', requireAuth, asyncHandler(async (req, res) => {
  res.json(await leaveHistory(viewerOf(req), (req.query as Record<string, unknown>).userId));
}));

router.post('/leave/balances/import/review', requireAuth, asyncHandler(async (req, res) => {
  res.json(await reviewImport(viewerOf(req), req.body));
}));

router.post('/leave/balances/import', requireAuth, asyncHandler(async (req, res) => {
  const result = await applyImport(req, viewerOf(req), req.body);
  res.json({ ...result, message: `${result.summary.ok} balance(s) updated${result.summary.unchanged ? `, ${result.summary.unchanged} unchanged` : ''}.` });
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

router.get('/leave/requests/:id/certificate', requireAuth, asyncHandler(async (req, res) => {
  const file = await certificateOf(viewerOf(req), requestId(req.params.id));
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.data);
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
