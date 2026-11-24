import { api } from '../../shared/services/api';

/** PMS projects and funding agencies (server/projects). */

export type Stage = 'proposed' | 'under_review' | 'approved' | 'rejected' | 'ongoing' | 'extended' | 'completed' | 'closed';
export type Category = 'external' | 'grant_in_aid' | 'consultancy' | 'in_house';

export interface Person { id: string; name: string; biometricId: string; designation: string }
export interface ProjectFileInfo { name: string; size: number; uploadedAt: string }
export interface Project {
  id: string; code: string; title: string; shortName: string | null;
  category: Category | null; categoryLabel: string | null;
  fundingAgencyId: string | null; fundingAgency: string | null;
  scheme: string | null; sanctionOrderNo: string | null; sanctionDate: string | null; sanctionedAmount: number | null;
  startDate: string | null; endDate: string | null; durationMonths: number | null;
  pi: Person | null; piName: string | null; coPis: Person[];
  department: string | null; sites: string | null; objectives: string | null; remarks: string | null;
  stage: Stage; stageLabel: string; status: string; staff: number;
  files: { proposal: ProjectFileInfo | null; sanction: ProjectFileInfo | null };
  updatedAt: string | null;
}
export interface Agency { id: string; name: string; code: string; status: 'ACTIVE' | 'INACTIVE'; projects: number }

export interface ProjectForm {
  code: string; title: string; shortName: string; category: Category | ''; fundingAgencyId: string; scheme: string;
  sanctionOrderNo: string; sanctionDate: string; sanctionedAmount: string; startDate: string; endDate: string;
  piUserId: string; coPiUserIds: string[]; department: string; sites: string; objectives: string; remarks: string; stage: Stage;
}

export interface ProjectImportReview {
  summary: { rows: number; ok: number; errors: number };
  rows: Array<{ line: number; code: string; title: string; status: 'ok' | 'error'; error: string | null }>;
}

export interface ProjectList {
  projects: Project[]; agencies: Agency[];
  stages: Record<Stage, string>; categories: Record<Category, string>; next: Record<Stage, Stage[]>;
}

const base = '/pms';
export const projectsApi = {
  list: () => api<ProjectList>(`${base}/projects`),
  get: (id: string) => api<Project>(`${base}/projects/${id}`),
  create: (form: ProjectForm) => api<{ project: Project; message: string }>(`${base}/projects`, { method: 'POST', body: form }),
  update: (id: string, form: ProjectForm) => api<{ project: Project; message: string }>(`${base}/projects/${id}`, { method: 'PUT', body: form }),
  stage: (id: string, input: { stage: Stage; reason?: string; endDate?: string }) =>
    api<{ project: Project; message: string }>(`${base}/projects/${id}/stage`, { method: 'PATCH', body: input }),
  upload: (id: string, kind: 'proposal' | 'sanction', file: { name: string; data: string }) =>
    api<{ project: Project; message: string }>(`${base}/projects/${id}/files/${kind}`, { method: 'PUT', body: file }),
  fileUrl: (id: string, kind: 'proposal' | 'sanction') => `/api${base}/projects/${id}/files/${kind}`,
  template: () => api<{ fileName: string; csv: string }>(`${base}/projects/import/template`),
  reviewImport: (csv: string) => api<ProjectImportReview>(`${base}/projects/import/review`, { method: 'POST', body: { csv } }),
  applyImport: (csv: string) => api<ProjectImportReview & { message: string }>(`${base}/projects/import`, { method: 'POST', body: { csv } }),
  agencies: () => api<{ agencies: Agency[] }>(`${base}/funding-agencies`),
  saveAgency: (id: string | null, input: { name: string; code: string; status: 'ACTIVE' | 'INACTIVE' }) =>
    api<{ agency: Agency; message: string }>(id ? `${base}/funding-agencies/${id}` : `${base}/funding-agencies`, { method: id ? 'PUT' : 'POST', body: input }),
};

export const formatRupees = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const formatDay = (iso: string | null | undefined): string => (iso ? iso.split('-').reverse().join('-') : '—');
