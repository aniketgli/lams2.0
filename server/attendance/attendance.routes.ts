import { Router, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth, isAuditor } from '../middleware/auth.middleware';
import { ActivityScope, activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import { listAttendance } from './store';

/**
 * Biometric attendance (/api/hrms/attendance), read-only.
 *   GET /attendance?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=]
 * Each signed-in user gets the people their active role may see
 * (self; managers also their team; administrators and auditors everyone).
 * Attendance itself is never edited here, so its auditor log is the record of who downloaded it
 * (see server/downloads).
 *   GET /attendance/activity[.csv|/export-pdf]   auditor
 */
const router = Router();

export const ATTENDANCE_SCOPE: ActivityScope = {
  keys: ['attendance_data_export', 'attendance_export'],
  areaLabels: { attendance_data_export: 'Data download', attendance_export: 'Log download' },
  exportKey: 'attendance_export',
  title: 'Attendance activity log',
  filePrefix: 'WII_Attendance_Activity',
};

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

router.get('/attendance', requireAuth, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, unknown>;
  res.json(await listAttendance({ id: req.auth!.account.id, role: req.auth!.activeRole }, { from: q.from, to: q.to, userId: q.userId }));
}));

router.get('/attendance/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, ATTENDANCE_SCOPE), ATTENDANCE_SCOPE));
}));

router.get('/attendance/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, ATTENDANCE_SCOPE), ATTENDANCE_SCOPE));
}));

router.get('/attendance/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, ATTENDANCE_SCOPE), 'pdf', ATTENDANCE_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

export default router;
