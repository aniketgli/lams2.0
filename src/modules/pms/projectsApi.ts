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
  piUserId: string; piName: string; coPiUserIds: string[]; department: string; sites: string; objectives: string; remarks: string; stage: Stage;
}

export interface ProjectImportReview {
  summary: { rows: number; ok: number; errors: number };
  rows: Array<{ line: number; code: string; title: string; status: 'ok' | 'error'; error: string | null }>;
}

/** A PI to choose: an employee with the PMS PI role. */
export interface PiOption { id: string; name: string; biometricId: string; designation: string | null }

export interface ProjectList {
  projects: Project[]; agencies: Agency[]; piOptions?: PiOption[];
  stages: Record<Stage, string>; categories: Record<Category, string>; next: Record<Stage, Stage[]>;
}

// ---- Workspace of a project ----------------------------------------------------------------------------------
export interface ProjectEmployee {
  id: string; biometricId: string; name: string; status: string; designation: string | null; employmentType: string | null;
  reportingManager: { id: string; name: string; biometricId: string } | null;
}
export interface PickPerson { id: string; name: string; biometricId: string; designation: string | null; department: string | null }
export interface ProjectEmployees { employees: ProjectEmployee[]; candidates: PickPerson[]; managers: PickPerson[] }
export interface OrderResult { changed: number; unchanged: number; message: string }

export type FundKind = 'heads' | 'receipts' | 'expenditures';
export interface BudgetHead { id: string; name: string; sanctioned: number; spent: number; remarks: string | null }
export interface Receipt { id: string; receivedOn: string; amount: number; reference: string | null; remarks: string | null }
export interface Expenditure { id: string; spentOn: string; amount: number; headId: string | null; head: string | null; description: string; voucherNo: string | null }
export interface Funds {
  heads: BudgetHead[]; receipts: Receipt[]; expenditures: Expenditure[];
  totals: { sanctioned: number; budgeted: number; received: number; spent: number; balance: number };
}

export type ActivityStatus = 'planned' | 'in_progress' | 'on_hold' | 'done';
export interface Activity {
  id: string; title: string; description: string | null; startDate: string | null; dueDate: string | null;
  status: ActivityStatus; statusLabel: string; progress: number; updatedAt: string | null;
}
export interface ActivityList { activities: Activity[]; statuses: Record<ActivityStatus, string> }
export interface ProjectDocument { id: string; title: string; fileName: string; size: number; uploadedAt: string; uploadedBy: string | null }

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
  employees: (id: string) => api<ProjectEmployees>(`${base}/projects/${id}/employees`),
  addEmployees: (id: string, input: { userIds: string[]; reportingManagerId?: string; effectiveDate?: string }) =>
    api<OrderResult>(`${base}/projects/${id}/employees`, { method: 'POST', body: input }),
  changeManager: (id: string, input: { userIds: string[]; reportingManagerId: string; effectiveDate?: string }) =>
    api<OrderResult>(`${base}/projects/${id}/employees/manager`, { method: 'POST', body: input }),
  funds: (id: string) => api<Funds>(`${base}/projects/${id}/funds`),
  saveFund: (id: string, kind: FundKind, entryId: string | null, input: Record<string, string>) =>
    api<Funds>(`${base}/projects/${id}/funds/${kind}${entryId ? `/${entryId}` : ''}`, { method: entryId ? 'PUT' : 'POST', body: input }),
  deleteFund: (id: string, kind: FundKind, entryId: string, reason: string) =>
    api<Funds>(`${base}/projects/${id}/funds/${kind}/${entryId}`, { method: 'DELETE', body: { reason } }),
  activities: (id: string) => api<ActivityList>(`${base}/projects/${id}/activities`),
  saveActivity: (id: string, entryId: string | null, input: Record<string, string | number>) =>
    api<ActivityList>(`${base}/projects/${id}/activities${entryId ? `/${entryId}` : ''}`, { method: entryId ? 'PUT' : 'POST', body: input }),
  deleteActivity: (id: string, entryId: string, reason: string) =>
    api<ActivityList>(`${base}/projects/${id}/activities/${entryId}`, { method: 'DELETE', body: { reason } }),
  documents: (id: string) => api<{ documents: ProjectDocument[] }>(`${base}/projects/${id}/documents`),
  addDocument: (id: string, input: { title: string; name: string; data: string }) =>
    api<{ documents: ProjectDocument[]; message: string }>(`${base}/projects/${id}/documents`, { method: 'POST', body: input }),
  removeDocument: (id: string, docId: string, reason: string) =>
    api<{ documents: ProjectDocument[] }>(`${base}/projects/${id}/documents/${docId}`, { method: 'DELETE', body: { reason } }),
  documentUrl: (id: string, docId: string) => `/api${base}/projects/${id}/documents/${docId}`,
  saveAgency: (id: string | null, input: { name: string; code: string; status: 'ACTIVE' | 'INACTIVE' }) =>
    api<{ agency: Agency; message: string }>(id ? `${base}/funding-agencies/${id}` : `${base}/funding-agencies`, { method: id ? 'PUT' : 'POST', body: input }),
};

export const formatRupees = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const formatDay = (iso: string | null | undefined): string => (iso ? iso.split('-').reverse().join('-') : '—');

/** A file as a data: URL (for the PDF uploads). */
export const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});
export const PROJECT_FILE_MAX_BYTES = 8 * 1024 * 1024;
