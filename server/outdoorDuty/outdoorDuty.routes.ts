import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import {
  OD_SCOPE, OD_TYPES, applicableEmployees, createRequest, decideRequest, deleteRequest, listRequests, requestId, undoDecision, updateRequest,
} from './store';

/**
 * Outdoor duty (/api/hrms/outdoor-duty).
 *   list:     every signed-in user, scoped by active role (self / team / all)
 *   apply:    general staff for themselves; administrator for anyone
 *   decide:   the employee's reporting manager (up to the start date), or an administrator
 *   edit/delete: the employee (own) or an administrator, before a decision
 *   undo:     reporting manager (own decision, once) or administrator (any time)
 *   logs:     auditor, with CSV / PDF downloads that are logged too
 */
const router = Router();
const isAuditor = [requireAuth, requireActiveRole('hrms', 'audit')];
const viewerOf = (req: Request) => ({ id: req.auth!.account.id, role: req.auth!.activeRole });

router.get('/outdoor-duty', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const viewer = viewerOf(req);
  const [list, employees] = await Promise.all([listRequests(viewer, { from: q.from, to: q.to }), applicableEmployees(viewer)]);
  res.json({ ...list, employees, types: OD_TYPES });
}));

// Auditor log routes come before /:id so "activity" is never read as an ID.
router.get('/outdoor-duty/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, OD_SCOPE), OD_SCOPE));
}));

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

router.get('/outdoor-duty/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, OD_SCOPE), OD_SCOPE));
}));

router.get('/outdoor-duty/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, OD_SCOPE), 'pdf', OD_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.post('/outdoor-duty', requireAuth, asyncHandler(async (req, res) => {
  const request = await createRequest(req, viewerOf(req), req.body);
  res.status(201).json({ request, message: 'Outdoor duty request submitted.' });
}));

router.put('/outdoor-duty/:id', requireAuth, asyncHandler(async (req, res) => {
  const { request, changed } = await updateRequest(req, viewerOf(req), requestId(req.params.id), req.body);
  res.json({ request, changed, message: changed.length ? 'Request updated.' : 'No changes to save.' });
}));

router.post('/outdoor-duty/:id/decision', requireAuth, asyncHandler(async (req, res) => {
  const request = await decideRequest(req, viewerOf(req), requestId(req.params.id), req.body);
  res.json({ request, message: request.status === 'approved' ? 'Request approved.' : 'Request rejected.' });
}));

router.post('/outdoor-duty/:id/undo', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 400 });
  v.assert();
  const request = await undoDecision(req, viewerOf(req), requestId(req.params.id), reason);
  res.json({ request, message: 'Decision undone. The request is pending again.' });
}));

router.delete('/outdoor-duty/:id', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteRequest(req, viewerOf(req), requestId(req.params.id), reason);
  res.json({ success: true, message: 'Request deleted.' });
}));

export default router;
