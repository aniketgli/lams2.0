import { Router, type Response } from 'express';
import { asyncHandler, badRequest } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth, isAuditor } from '../middleware/auth.middleware';
import { ActivityScope, activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import { createSchedule, deleteSchedule, getSchedule, listRuns, listSchedules, scheduleOptions, sendNow, setScheduleStatus, updateSchedule } from './store';

/**
 * Scheduled report emails (/api/hrms/reports/...). Administrators manage them; the auditor can read the schedules and their
 * send history and has an activity log (changes to schedules, sends and downloads of that log).
 *   GET    /reports/schedules              the schedules, with the options for the form
 *   POST   /reports/schedules              add one
 *   PUT    /reports/schedules/:id          change one
 *   PATCH  /reports/schedules/:id/status   pause / resume
 *   DELETE /reports/schedules/:id          remove (with a reason)
 *   POST   /reports/schedules/:id/send     send it now, once
 *   GET    /reports/schedules/:id/runs     the last 20 sends
 */
const router = Router();
const isAdmin = [requireAuth, requireActiveRole('hrms', 'administrator')];
const canRead = [requireAuth, requireActiveRole('hrms', 'administrator', 'audit')];

export const REPORT_SCOPE: ActivityScope = {
  keys: ['report_schedule', 'report_export'],
  areaLabels: { report_schedule: 'Report schedule', report_export: 'Log download' },
  actionLabels: { CREATE: 'Added', UPDATE: 'Changed / sent now', STATUS: 'Paused / resumed', DELETE: 'Deleted' },
  exportKey: 'report_export',
  title: 'Reports activity log',
  filePrefix: 'WII_Reports_Activity',
};

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

const scheduleId = (raw: string): number => {
  if (!/^\d{1,18}$/.test(raw)) throw badRequest('Invalid report schedule.');
  return Number(raw);
};

// Auditor log routes come before /reports/schedules/:id so "activity" is never read as an ID.
router.get('/reports/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, REPORT_SCOPE), REPORT_SCOPE));
}));

router.get('/reports/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, REPORT_SCOPE), REPORT_SCOPE));
}));

router.get('/reports/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, REPORT_SCOPE), 'pdf', REPORT_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.get('/reports/schedules', ...canRead, asyncHandler(async (_req, res) => {
  const [schedules, options] = await Promise.all([listSchedules(), scheduleOptions()]);
  res.json({ schedules, ...options });
}));

router.post('/reports/schedules', ...isAdmin, asyncHandler(async (req, res) => {
  const schedule = await createSchedule(req, req.body);
  res.status(201).json({ schedule, message: 'Report schedule saved.' });
}));

router.put('/reports/schedules/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const { schedule, changed } = await updateSchedule(req, scheduleId(req.params.id), req.body);
  res.json({ schedule, changed, message: changed.length ? 'Report schedule updated.' : 'No changes to save.' });
}));

router.patch('/reports/schedules/:id/status', ...isAdmin, asyncHandler(async (req, res) => {
  const schedule = await setScheduleStatus(req, scheduleId(req.params.id), (req.body ?? {}).status);
  res.json({ schedule, message: schedule.status === 'paused' ? 'Report schedule paused.' : 'Report schedule resumed.' });
}));

router.delete('/reports/schedules/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  await deleteSchedule(req, scheduleId(req.params.id), reason);
  res.json({ message: 'Report schedule deleted.' });
}));

router.post('/reports/schedules/:id/send', ...isAdmin, asyncHandler(async (req, res) => {
  const { schedule, result } = await sendNow(req, scheduleId(req.params.id));
  res.json({ schedule, result, message: result.status === 'sent' || result.status === 'partial' ? result.message : `Not sent: ${result.message}` });
}));

router.get('/reports/schedules/:id/runs', ...canRead, asyncHandler(async (req, res) => {
  const id = scheduleId(req.params.id);
  res.json({ schedule: await getSchedule(id), runs: await listRuns(id) });
}));

export const reportRoutes = router;
