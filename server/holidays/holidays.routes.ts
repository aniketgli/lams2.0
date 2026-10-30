import { Router, type Response } from 'express';
import { asyncHandler, badRequest } from '../lib/http';
import { Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { activityCsv, activityTable, listActivity, parseActivityFilter } from '../employees/activity';
import { HOLIDAY_CATEGORIES, HOLIDAY_SCOPE, HOLIDAY_TYPES, createHoliday, deleteHoliday, holidayId, holidayYears, listHolidays, updateHoliday } from './store';

/**
 * Holiday calendar (/api/hrms/holidays).
 *   read:      every signed-in user (any role)
 *   change:    administrator (active role), audited
 *   logs:      auditor (active role), with CSV / PDF downloads that are logged too
 */
const router = Router();
const isAdmin = [requireAuth, requireActiveRole('hrms', 'administrator')];
const isAuditor = [requireAuth, requireActiveRole('hrms', 'audit')];


router.get('/holidays', requireAuth, asyncHandler(async (req, res) => {
  const raw = typeof req.query.year === 'string' ? req.query.year.trim() : '';
  if (raw && !/^\d{4}$/.test(raw)) throw badRequest('Invalid year.');
  const [holidays, years] = await Promise.all([listHolidays(raw ? Number(raw) : null), holidayYears()]);
  res.json({ holidays, years, types: HOLIDAY_TYPES, categories: HOLIDAY_CATEGORIES });
}));

// Auditor log routes come before /holidays/:id so "activity" is never read as an ID.
router.get('/holidays/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, HOLIDAY_SCOPE), HOLIDAY_SCOPE));
}));

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

router.get('/holidays/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, HOLIDAY_SCOPE), HOLIDAY_SCOPE));
}));

router.get('/holidays/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, HOLIDAY_SCOPE), 'pdf', HOLIDAY_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

router.post('/holidays', ...isAdmin, asyncHandler(async (req, res) => {
  const holiday = await createHoliday(req, req.body);
  res.status(201).json({ holiday, message: `${holiday.name} added.` });
}));

router.put('/holidays/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const { holiday, changed } = await updateHoliday(req, holidayId(req.params.id), req.body);
  res.json({ holiday, changed, message: changed.length ? `${holiday.name} updated.` : 'No changes to save.' });
}));

router.delete('/holidays/:id', ...isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body ?? {});
  const reason = v.optionalString('reason', { max: 500 });
  v.assert();
  const holiday = await deleteHoliday(req, holidayId(req.params.id), reason);
  res.json({ success: true, message: `${holiday.name} removed.` });
}));

export default router;
