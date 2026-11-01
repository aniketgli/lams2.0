import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { createSchedule, deleteSchedule, getSchedule, listRuns, listSchedules, scheduleOptions, sendNow, setScheduleStatus, updateSchedule } from './store';

/**
 * Scheduled report emails (/api/hrms/reports/...). Administrators only.
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

const scheduleId = (raw: string): number => {
  if (!/^\d{1,18}$/.test(raw)) throw badRequest('Invalid report schedule.');
  return Number(raw);
};

router.get('/reports/schedules', ...isAdmin, asyncHandler(async (_req, res) => {
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

router.get('/reports/schedules/:id/runs', ...isAdmin, asyncHandler(async (req, res) => {
  const id = scheduleId(req.params.id);
  res.json({ schedule: await getSchedule(id), runs: await listRuns(id) });
}));

export const reportRoutes = router;
