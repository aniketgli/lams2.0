import { Router, type Response } from 'express';
import { activityCsv, activityTable, listActivity, parseActivityFilter, type ActivityScope } from '../employees/activity';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../src/db';
import { asyncHandler, badRequest, notFound } from '../lib/http';
import { isValidIsoDate } from '../lib/validate';
import { requireActiveRole, requireAuth, requireModule } from '../middleware/auth.middleware';
import { FORM_LAYOUTS, MASTERS, MasterDef, auditMasterLabels, findMaster, masterActivityScope, tabOrder } from './definitions';
import { activeOptions, createRecord, deleteRecord, listRecords, setStatus, updateRecord } from './store';

/**
 * /api/hrms/masters
 *
 *   GET    /catalog                 master definitions for the UI          admin, auditor
 *   GET    /options                 active values for form dropdowns        any HRMS role
 *   GET    /audit                   unified audit trail                     admin, auditor
 *   GET    /:key                    all records of one master               admin, auditor
 *   POST   /:key                    create                                  admin
 *   PUT    /:key/:id                update                                  admin
 *   PATCH  /:key/:id/status         activate / deactivate                   admin
 *   DELETE /:key/:id                delete (only if not in use)             admin
 */
const router = Router();
router.use(requireAuth, requireModule('hrms'));

const canView = requireActiveRole('hrms', 'administrator', 'audit');
const canEdit = requireActiveRole('hrms', 'administrator');

const MASTER_SCOPE: ActivityScope = {
  ...masterActivityScope(),
  exportKey: 'master_export',
  title: 'Master settings activity log',
  filePrefix: 'WII_Master_Settings_Activity',
};
const isAuditor = requireActiveRole('hrms', 'audit');

function sendCsv(res: Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

// Auditor log routes come before /:key so "activity" is never read as a master key.
router.get('/activity', isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>, MASTER_SCOPE), MASTER_SCOPE));
}));
router.get('/activity.csv', isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>, MASTER_SCOPE), MASTER_SCOPE));
}));
router.get('/activity/export-pdf', isAuditor, asyncHandler(async (req, res) => {
  const table = await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>, MASTER_SCOPE), 'pdf', MASTER_SCOPE);
  res.json({ generatedAt: new Date().toISOString(), ...table });
}));

function masterFrom(key: string): MasterDef {
  const def = findMaster(key);
  if (!def) throw notFound('Unknown master.');
  return def;
}

function idFrom(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Invalid record ID.');
  return id;
}

router.get('/catalog', canView, (_req, res) => {
  res.json({
    masters: MASTERS.map((m) => ({
      key: m.key, label: m.label, noun: m.noun, group: m.group, description: m.description, fields: m.fields, kind: m.kind, tab: tabOrder(m.key), fixedRecords: Boolean(m.fixedRecords), swapStatusWith: m.swapStatusWith ?? null,
      ...(m.kind === 'lookup' ? { lookupType: m.lookupType } : {}),
    })),
    formLayouts: FORM_LAYOUTS,
    auditMasters: auditMasterLabels(),
    activityAreas: MASTER_SCOPE.keys.map((value) => ({ value, label: MASTER_SCOPE.areaLabels[value] ?? value })),
  });
});

router.get('/options', asyncHandler(async (_req, res) => {
  const [options, [shiftRows]] = await Promise.all([
    activeOptions(),
    pool.query<RowDataPacket[]>("SELECT id, code, name, is_default FROM shifts WHERE LOWER(status) = 'active' ORDER BY is_default DESC, name"),
  ]);
  res.json({
    ...options,
    shifts: shiftRows.map((s) => ({ id: String(s.id), code: s.code, name: s.name, isDefault: Boolean(s.is_default) })),
  });
}));

router.get('/audit', canView, asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const params: unknown[] = [];

  if (q.master) { where.push('master_key = ?'); params.push(String(q.master).slice(0, 40)); }
  if (q.action) {
    const action = String(q.action).toUpperCase();
    if (!['CREATE', 'UPDATE', 'STATUS', 'DELETE'].includes(action)) throw badRequest('Unknown action.');
    where.push('action = ?'); params.push(action);
  }
  if (q.from) {
    if (!isValidIsoDate(q.from)) throw badRequest('Invalid from date.');
    where.push('created_at >= ?'); params.push(`${q.from} 00:00:00`);
  }
  if (q.to) {
    if (!isValidIsoDate(q.to)) throw badRequest('Invalid to date.');
    where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(q.to);
  }
  if (q.actor) { where.push('actor_biometric_id = ?'); params.push(String(q.actor).slice(0, 4)); }
  if (q.search) {
    const term = `%${String(q.search).slice(0, 100).replace(/[%_\\]/g, '\\$&')}%`;
    where.push('(record_label LIKE ? OR actor_name LIKE ? OR reason LIKE ?)'); params.push(term, term, term);
  }

  const page = Math.max(1, Math.min(10_000, Number(q.page) || 1));
  const pageSize = Math.max(10, Math.min(100, Number(q.pageSize) || 25));
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[countRow]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM master_audit_logs ${whereSql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, master_key, record_id, record_label, action, changed_fields, before_data, after_data, reason,
            actor_biometric_id, actor_name, actor_role, created_at
     FROM master_audit_logs ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  const parse = (v: unknown) => {
    if (typeof v !== 'string' || !v) return null;
    try { return JSON.parse(v); } catch { return null; }
  };
  res.json({
    total: Number(countRow?.n ?? 0),
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: String(r.id),
      master: r.master_key,
      recordId: r.record_id,
      recordLabel: r.record_label,
      action: r.action,
      changedFields: r.changed_fields ? String(r.changed_fields).split(',') : [],
      before: parse(r.before_data),
      after: parse(r.after_data),
      reason: r.reason,
      actor: { biometricId: r.actor_biometric_id, name: r.actor_name, role: r.actor_role },
      at: r.created_at ? new Date(r.created_at).toISOString() : null,
    })),
  });
}));

router.get('/:key', canView, asyncHandler(async (req, res) => {
  res.json({ records: await listRecords(masterFrom(req.params.key)) });
}));

router.post('/:key', canEdit, asyncHandler(async (req, res) => {
  res.status(201).json({ record: await createRecord(masterFrom(req.params.key), req.body, req) });
}));

router.put('/:key/:id', canEdit, asyncHandler(async (req, res) => {
  res.json({ record: await updateRecord(masterFrom(req.params.key), idFrom(req.params.id), req.body, req) });
}));

router.patch('/:key/:id/status', canEdit, asyncHandler(async (req, res) => {
  res.json({ record: await setStatus(masterFrom(req.params.key), idFrom(req.params.id), req.body?.status, req, req.body?.reason) });
}));

router.delete('/:key/:id', canEdit, asyncHandler(async (req, res) => {
  await deleteRecord(masterFrom(req.params.key), idFrom(req.params.id), req, req.body?.reason);
  res.json({ success: true });
}));

export default router;
