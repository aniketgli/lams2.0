import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireAuth, isAuditor } from '../middleware/auth.middleware';
import { scopedViewerOf } from '../lib/peopleScope';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import {
  MANUAL_SCOPE, REASON_CATEGORIES, applicableEmployees, createRequest, decideRequest, deleteRequest, listRequests, missingPunchDates, requestId, undoDecision, updateRequest,
} from './store';
import { sendCsvReport } from '../lib/csvResponse';

/**
 * Manual attendance (/api/hrms/manual-attendance).
 *   list:     every signed-in user, scoped by active role (self / team / all)
 *   apply:    general staff for themselves; administrator for anyone
 *   decide:   the employee's reporting manager, or an administrator
 *   edit/delete: the employee (own) or an administrator, before approval
 *   undo:     reporting manager (own decision, once) or administrator (any time)
 *   logs:     auditor, with CSV / PDF downloads that are logged too
 */
const router = Router();
// HRMS or PMS: the viewer's role in the module and the user ids of its employees (server/lib/peopleScope.ts).
const viewerOf = (req: Request) => scopedViewerOf(req);

router.get('/manual-attendance', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const viewer = (await viewerOf(req));
  const [list, employees] = await Promise.all([listRequests(viewer, { from: q.from, to: q.to }), applicableEmployees(viewer)]);
  res.json({ ...list, employees, categories: REASON_CATEGORIES });
}));

router.get('/manual-attendance/missing-punches', requireAuth, asyncHandler(async (req, res) => {
  res.json({ dates: await missingPunchDates((await viewerOf(req)), req.query.userId) });
}));

// Auditor log routes come before /:id so "activity" is never read as an ID.
router.get('/manual-attendance/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, MANUAL_SCOPE), MANUAL_SCOPE));
}));


router.get('/manual-attendance/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  await sendCsvReport(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, MANUAL_SCOPE), MANUAL_SCOPE));
}));

router.get('/manual-attendance/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, MANUAL_SCOPE), 'pdf', MANUAL_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.post('/manual-attendance', requireAuth, asyncHandler(async (req, res) => {
  const request = await createRequest(req, (await viewerOf(req)), req.body);
  res.status(201).json({ request, message: 'Manual attendance request submitted.' });
}));

router.put('/manual-attendance/:id', requireAuth, asyncHandler(async (req, res) => {
  const { request, changed } = await updateRequest(req, (await viewerOf(req)), requestId(req.params.id), req.body);
  res.json({ request, changed, message: changed.length ? 'Request updated.' : 'No changes to save.' });
}));

router.post('/manual-attendance/:id/decision', requireAuth, asyncHandler(async (req, res) => {
  const request = await decideRequest(req, (await viewerOf(req)), requestId(req.params.id), req.body);
  res.json({ request, message: request.status === 'approved' ? 'Request approved.' : 'Request rejected.' });
}));

router.post('/manual-attendance/:id/undo', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 400 });
  v.assert();
  const request = await undoDecision(req, (await viewerOf(req)), requestId(req.params.id), reason);
  res.json({ request, message: 'Decision undone. The request is pending again.' });
}));

router.delete('/manual-attendance/:id', requireAuth, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteRequest(req, (await viewerOf(req)), requestId(req.params.id), reason);
  res.json({ success: true, message: 'Request deleted.' });
}));

export default router;
