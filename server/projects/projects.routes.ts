import { Router, type Request } from 'express';
import { asyncHandler, attachmentDisposition, badRequest } from '../lib/http';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { limitHeavy } from '../middleware/apiRateLimit';
import { CATEGORY_LABELS, NEXT, STAGE_LABELS, importTemplate } from './projectRules';
import { applyProjectImport, reviewProjectImport } from './import';
import {
  PROJECT_FILE_KINDS, type ProjectFileKind, changeStage, createProject, getProject, listAgencies, listProjects, loadProjectFile,
  saveAgency, saveProjectFile, updateProject, listPiOptions,
} from './store';
import { pool } from '../../src/db';

/**
 * PMS projects (/api/pms). Everyone working in PMS reads them; the RC office (the PMS Administrator) creates,
 * edits, imports, moves the stage, uploads the documents and keeps the funding agencies.
 *   GET    /projects                      list (with the stage rules and labels, and the PIs to choose from)
 *   GET    /projects/:id
 *   POST   /projects                      create                          (administrator)
 *   PUT    /projects/:id                  edit                            (administrator)
 *   PATCH  /projects/:id/stage            { stage, reason?, endDate? }    (administrator)
 *   PUT    /projects/:id/files/:kind      { name, data } PDF ≤ 8 MB       (administrator; kind proposal | sanction)
 *   GET    /projects/:id/files/:kind      the PDF
 *   GET    /projects/import/template      { fileName, csv }               (administrator)
 *   POST   /projects/import/review        { csv } → rows, nothing written (administrator)
 *   POST   /projects/import               { csv } → all rows or none      (administrator)
 *   GET    /funding-agencies              list
 *   POST   /funding-agencies, PUT /funding-agencies/:id                    (administrator)
 */
const router = Router();

const canRead = [requireAuth, requireActiveRole('pms', 'administrator', 'reviewing_manager', 'reporting_manager', 'general_staff', 'audit', 'leave_balance_manager', 'employee_manager')];
const rcOffice = [requireAuth, requireActiveRole('pms', 'administrator')];

const idOf = (req: Request): number => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid project.');
  return id;
};
const kindOf = (req: Request): ProjectFileKind => {
  const kind = req.params.kind as ProjectFileKind;
  if (!PROJECT_FILE_KINDS.includes(kind)) throw badRequest('Invalid document.');
  return kind;
};

router.get('/projects', ...canRead, asyncHandler(async (_req, res) => {
  const [projects, agencies, piOptions] = await Promise.all([listProjects(), listAgencies(), listPiOptions()]);
  res.json({ projects, agencies, piOptions, stages: STAGE_LABELS, categories: CATEGORY_LABELS, next: NEXT });
}));

// Import routes come before /projects/:id so "import" is never read as an ID.
router.get('/projects/import/template', ...rcOffice, (_req, res) => {
  res.json({ fileName: 'WII_Projects_Import_Template', csv: importTemplate() });
});
router.post('/projects/import/review', ...rcOffice, limitHeavy('project-import-review', 30), asyncHandler(async (req, res) => {
  res.json(await reviewProjectImport(req.body));
}));
router.post('/projects/import', ...rcOffice, limitHeavy('project-import', 10), asyncHandler(async (req, res) => {
  const result = await applyProjectImport(req, req.body);
  res.status(201).json({ ...result, message: `${result.summary.ok} project(s) imported.` });
}));

router.get('/projects/:id', ...canRead, asyncHandler(async (req, res) => {
  res.json(await getProject(pool, idOf(req)));
}));
router.post('/projects', ...rcOffice, asyncHandler(async (req, res) => {
  const project = await createProject(req, req.body);
  res.status(201).json({ project, message: `Project ${project.code} created.` });
}));
router.put('/projects/:id', ...rcOffice, asyncHandler(async (req, res) => {
  const project = await updateProject(req, idOf(req), req.body);
  res.json({ project, message: `Project ${project.code} saved.` });
}));
router.patch('/projects/:id/stage', ...rcOffice, asyncHandler(async (req, res) => {
  const project = await changeStage(req, idOf(req), req.body);
  res.json({ project, message: `Project ${project.code} is now ${project.stageLabel}.` });
}));
router.put('/projects/:id/files/:kind', ...rcOffice, limitHeavy('project-file', 30), asyncHandler(async (req, res) => {
  const project = await saveProjectFile(req, idOf(req), kindOf(req), req.body);
  res.json({ project, message: 'Document uploaded.' });
}));
router.get('/projects/:id/files/:kind', ...canRead, asyncHandler(async (req, res) => {
  const file = await loadProjectFile(idOf(req), kindOf(req));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', attachmentDisposition(file.name, 'project-document').replace(/^attachment/, 'inline'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.data);
}));

router.get('/funding-agencies', ...canRead, asyncHandler(async (_req, res) => {
  res.json({ agencies: await listAgencies() });
}));
router.post('/funding-agencies', ...rcOffice, asyncHandler(async (req, res) => {
  const agency = await saveAgency(req, null, req.body);
  res.status(201).json({ agency, message: `${agency.name} added.` });
}));
router.put('/funding-agencies/:id', ...rcOffice, asyncHandler(async (req, res) => {
  const agency = await saveAgency(req, idOf(req), req.body);
  res.json({ agency, message: `${agency.name} saved.` });
}));

export default router;
