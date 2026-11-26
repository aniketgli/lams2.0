import { Router, type Request } from 'express';
import { asyncHandler, attachmentDisposition, badRequest } from '../lib/http';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { limitHeavy } from '../middleware/apiRateLimit';
import { CATEGORY_LABELS, NEXT, STAGE_LABELS, importTemplate } from './projectRules';
import { applyProjectImport, reviewProjectImport } from './import';
import {
  PROJECT_FILE_KINDS, type ProjectFileKind, changeStage, createProject, listAgencies, listProjects, loadProjectFile,
  saveAgency, saveProjectFile, updateProject, listPiOptions, projectActorOf, projectFor,
} from './store';
import {
  ACTIVITY_STATUS_LABELS, FUND_KINDS, addDocument, addProjectEmployees, changeProjectManager, deleteActivity, deleteFund, idParam,
  loadDocument, reasonOf, projectActivities, projectDocuments, projectEmployees, projectFunds, removeDocument, saveActivity, saveFund,
} from './workspace';
import { pool } from '../../src/db';

/**
 * PMS projects (/api/pms). The RC office (the PMS Administrator) works on every project: creates, edits, imports,
 * moves the stage, uploads the documents and keeps the funding agencies. A PI (active role PI) sees and manages only
 * the projects where they are the PI (details except code / title / PI, documents, employees, funds, activities);
 * the PMS Auditor reads. Other roles do not open Projects (store.ts projectFor).
 * Workspace of a project (RC office, or its PI; Auditor reads):
 *   GET  /projects/:id/employees · POST /projects/:id/employees { userIds, reportingManagerId? } · POST /projects/:id/employees/manager
 *   GET  /projects/:id/funds · POST|PUT|DELETE /projects/:id/funds/:kind(/:entryId)   kind heads | receipts | expenditures
 *   GET  /projects/:id/activities · POST|PUT|DELETE /projects/:id/activities(/:entryId)
 *   GET  /projects/:id/documents · POST /projects/:id/documents { title, name, data } · GET|DELETE /projects/:id/documents/:docId
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

const canRead = [requireAuth, requireActiveRole('pms', 'administrator', 'audit', 'project_pi')];
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

router.get('/projects', ...canRead, asyncHandler(async (req, res) => {
  const actor = projectActorOf(req);
  const [projects, agencies, piOptions] = await Promise.all([
    listProjects(actor?.kind === 'pi' ? { piUserId: actor.userId } : {}), listAgencies(), actor?.kind === 'admin' ? listPiOptions() : Promise.resolve([]),
  ]);
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
  res.json(await projectFor(pool, req, idOf(req), false));
}));
router.post('/projects', ...rcOffice, asyncHandler(async (req, res) => {
  const project = await createProject(req, req.body);
  res.status(201).json({ project, message: `Project ${project.code} created.` });
}));
router.put('/projects/:id', ...canRead, asyncHandler(async (req, res) => {
  const project = await updateProject(req, idOf(req), req.body);
  res.json({ project, message: `Project ${project.code} saved.` });
}));
router.patch('/projects/:id/stage', ...rcOffice, asyncHandler(async (req, res) => {
  const project = await changeStage(req, idOf(req), req.body);
  res.json({ project, message: `Project ${project.code} is now ${project.stageLabel}.` });
}));
router.put('/projects/:id/files/:kind', ...canRead, limitHeavy('project-file', 30), asyncHandler(async (req, res) => {
  const project = await saveProjectFile(req, idOf(req), kindOf(req), req.body);
  res.json({ project, message: 'Document uploaded.' });
}));
router.get('/projects/:id/files/:kind', ...canRead, asyncHandler(async (req, res) => {
  await projectFor(pool, req, idOf(req), false);
  const file = await loadProjectFile(idOf(req), kindOf(req));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', attachmentDisposition(file.name, 'project-document').replace(/^attachment/, 'inline'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.data);
}));

// ---- Workspace of a project -------------------------------------------------------------------------------------
const fundKind = (req: Request) => {
  const kind = req.params.kind as (typeof FUND_KINDS)[number];
  if (!FUND_KINDS.includes(kind)) throw badRequest('Invalid entry type.');
  return kind;
};
router.get('/projects/:id/employees', ...canRead, asyncHandler(async (req, res) => {
  res.json(await projectEmployees(req, idOf(req)));
}));
router.post('/projects/:id/employees', ...canRead, asyncHandler(async (req, res) => {
  res.json(await addProjectEmployees(req, idOf(req), req.body));
}));
router.post('/projects/:id/employees/manager', ...canRead, asyncHandler(async (req, res) => {
  res.json(await changeProjectManager(req, idOf(req), req.body));
}));
router.get('/projects/:id/funds', ...canRead, asyncHandler(async (req, res) => {
  res.json(await projectFunds(req, idOf(req)));
}));
router.post('/projects/:id/funds/:kind', ...canRead, asyncHandler(async (req, res) => {
  res.status(201).json(await saveFund(req, idOf(req), fundKind(req), null, req.body));
}));
router.put('/projects/:id/funds/:kind/:entryId', ...canRead, asyncHandler(async (req, res) => {
  res.json(await saveFund(req, idOf(req), fundKind(req), idParam(req.params.entryId), req.body));
}));
router.delete('/projects/:id/funds/:kind/:entryId', ...canRead, asyncHandler(async (req, res) => {
  res.json(await deleteFund(req, idOf(req), fundKind(req), idParam(req.params.entryId), reasonOf(req.body)));
}));
router.get('/projects/:id/activities', ...canRead, asyncHandler(async (req, res) => {
  res.json({ activities: await projectActivities(req, idOf(req)), statuses: ACTIVITY_STATUS_LABELS });
}));
router.post('/projects/:id/activities', ...canRead, asyncHandler(async (req, res) => {
  res.status(201).json({ activities: await saveActivity(req, idOf(req), null, req.body), statuses: ACTIVITY_STATUS_LABELS });
}));
router.put('/projects/:id/activities/:entryId', ...canRead, asyncHandler(async (req, res) => {
  res.json({ activities: await saveActivity(req, idOf(req), idParam(req.params.entryId), req.body), statuses: ACTIVITY_STATUS_LABELS });
}));
router.delete('/projects/:id/activities/:entryId', ...canRead, asyncHandler(async (req, res) => {
  res.json({ activities: await deleteActivity(req, idOf(req), idParam(req.params.entryId), reasonOf(req.body)), statuses: ACTIVITY_STATUS_LABELS });
}));
router.get('/projects/:id/documents', ...canRead, asyncHandler(async (req, res) => {
  res.json({ documents: await projectDocuments(req, idOf(req)) });
}));
router.post('/projects/:id/documents', ...canRead, limitHeavy('project-file', 30), asyncHandler(async (req, res) => {
  res.status(201).json({ documents: await addDocument(req, idOf(req), req.body), message: 'Document uploaded.' });
}));
router.get('/projects/:id/documents/:docId', ...canRead, asyncHandler(async (req, res) => {
  const file = await loadDocument(req, idOf(req), idParam(req.params.docId, 'document'));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', attachmentDisposition(file.name, 'project-document').replace(/^attachment/, 'inline'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.data);
}));
router.delete('/projects/:id/documents/:docId', ...canRead, asyncHandler(async (req, res) => {
  res.json({ documents: await removeDocument(req, idOf(req), idParam(req.params.docId, 'document'), reasonOf(req.body)) });
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
