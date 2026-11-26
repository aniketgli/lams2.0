import { Validator } from '../lib/validate';

/**
 * PMS projects, kept by the RC office (the PMS Administrator): the form's fields, the stages a project moves through
 * and the bulk-import columns. Pure rules (no database), tested in projectRules.test.ts.
 */

export const STAGES = ['proposed', 'under_review', 'approved', 'rejected', 'ongoing', 'extended', 'completed', 'closed'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  proposed: 'Proposed', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected',
  ongoing: 'Ongoing', extended: 'Extended', completed: 'Completed', closed: 'Closed',
};

/**
 * Where a project may go next. The RC office may also step back one stage (a mistake), with a reason.
 *   proposed → under_review → approved / rejected;  approved → ongoing → extended → completed → closed
 *   rejected → proposed (resubmitted);  ongoing → completed;  extended → extended (extended again)
 */
export const NEXT: Record<Stage, readonly Stage[]> = {
  proposed: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected', 'proposed'],
  approved: ['ongoing', 'under_review'],
  rejected: ['proposed'],
  ongoing: ['extended', 'completed', 'approved'],
  extended: ['extended', 'completed', 'ongoing'],
  completed: ['closed', 'ongoing', 'extended'],
  closed: ['completed'],
};

/** Moves that need a written reason: rejecting, closing, extending and every step back. */
const FORWARD: readonly Stage[] = STAGES;
export function needsReason(from: Stage, to: Stage): boolean {
  if (to === 'rejected' || to === 'closed' || to === 'extended') return true;
  return FORWARD.indexOf(to) < FORWARD.indexOf(from) && !(from === 'rejected' && to === 'proposed');
}

export function stageProblem(from: Stage, to: Stage, opts: { reason: string | null; endDate: string | null; newEndDate: string | null }): string | null {
  if (!NEXT[from].includes(to)) return `A project that is ${STAGE_LABELS[from]} cannot be made ${STAGE_LABELS[to]}.`;
  if (needsReason(from, to) && !opts.reason) return 'Give the reason.';
  if (to === 'extended') {
    if (!opts.newEndDate) return 'Give the new end date.';
    if (opts.endDate && opts.newEndDate <= opts.endDate) return 'The new end date must be after the present end date.';
  }
  return null;
}

export const CATEGORIES = ['external', 'grant_in_aid', 'consultancy', 'in_house'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  external: 'Externally funded', grant_in_aid: 'Grant-in-aid', consultancy: 'Consultancy', in_house: 'In-house',
};

export interface ProjectInput {
  /** Null: given automatically on create (WII-PRJ-0001 …); kept as it is on edit. */
  code: string | null; title: string; shortName: string | null; category: Category | null; fundingAgencyId: number | null;
  scheme: string | null; sanctionOrderNo: string | null; sanctionDate: string | null; sanctionedAmount: number | null;
  startDate: string | null; endDate: string | null; piUserId: number | null;
  /** The PI's name when the PI is not chosen from the employees (not an employee, or not known yet). */
  piName: string | null; coPiUserIds: number[];
  department: string | null; sites: string | null; objectives: string | null; remarks: string | null; stage: Stage;
}

/** Project code: letters, digits and - _ / . (e.g. WII-DST-2024-09). */
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{0,99}$/;

const id = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** The form (create / edit). A new project starts as Proposed unless the RC office chooses another stage. */
export function parseProjectInput(body: unknown): ProjectInput {
  const v = new Validator(body);
  // Optional: a project may start with only its title and PI; the code is then given automatically.
  const code = v.optionalString('code', { max: 100, pattern: CODE_PATTERN, patternMessage: 'Use letters, digits and - _ / . (e.g. WII-DST-2024-09).' });
  const title = v.string('title', { max: 255 });
  const shortName = v.optionalString('shortName', { max: 100 });
  const category = v.oneOf('category', CATEGORIES, false);
  const raw = (body ?? {}) as Record<string, unknown>;
  const fundingAgencyId = id(raw.fundingAgencyId);
  if (raw.fundingAgencyId && !fundingAgencyId) v.errors.fundingAgencyId ||= 'Choose a funding agency from the list.';
  const scheme = v.optionalString('scheme', { max: 255 });
  const sanctionOrderNo = v.optionalString('sanctionOrderNo', { max: 120 });
  const sanctionDate = v.date('sanctionDate', false);
  let sanctionedAmount: number | null = null;
  if (raw.sanctionedAmount !== undefined && raw.sanctionedAmount !== null && raw.sanctionedAmount !== '') {
    const n = Number(String(raw.sanctionedAmount).replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 9_999_999_999_999) v.errors.sanctionedAmount ||= 'Enter the amount in rupees.';
    else sanctionedAmount = Math.round(n * 100) / 100;
  }
  const startDate = v.date('startDate', false);
  const endDate = v.date('endDate', false);
  if (startDate && endDate && endDate < startDate) v.errors.endDate ||= 'The end date must be on or after the start date.';
  const piUserId = id(raw.piUserId);
  if (raw.piUserId && !piUserId) v.errors.piUserId ||= 'Choose the PI from the list.';
  const piName = piUserId ? null : v.optionalString('piName', { max: 255 });
  const coPiUserIds = Array.isArray(raw.coPiUserIds) ? [...new Set(raw.coPiUserIds.map(id).filter((x): x is number => x !== null))] : [];
  if (coPiUserIds.length > 20) v.errors.coPiUserIds ||= 'At most 20 Co-PIs.';
  if (piUserId && coPiUserIds.includes(piUserId)) v.errors.coPiUserIds ||= 'The PI cannot also be a Co-PI.';
  const department = v.optionalString('department', { max: 255 });
  const sites = v.optionalString('sites', { max: 500 });
  const objectives = v.optionalString('objectives', { max: 5000 });
  const remarks = v.optionalString('remarks', { max: 2000 });
  const stage = (v.oneOf('stage', STAGES, false) ?? 'proposed') as Stage;
  v.assert();
  return { code, title, shortName, category, fundingAgencyId, scheme, sanctionOrderNo, sanctionDate, sanctionedAmount, startDate, endDate, piUserId, piName, coPiUserIds, department, sites, objectives, remarks, stage };
}

// ---------------------------------------------------------------------------
// Bulk import (CSV): one row per project
// ---------------------------------------------------------------------------

export const MAX_PROJECT_IMPORT_ROWS = 1000;

export interface ImportColumn { header: string; key: keyof ProjectInput | 'fundingAgency' | 'piBiometricId' | 'coPiBiometricIds'; required: boolean; example: string; help: string }

export const IMPORT_COLUMNS: ImportColumn[] = [
  { header: 'Project_Code', key: 'code', required: false, example: 'WII-DST-2024-09', help: 'Unique; blank: given automatically (WII-PRJ-0001 …)' },
  { header: 'Title', key: 'title', required: true, example: 'National Tiger Population Genetics', help: 'Unique' },
  { header: 'Short_Name', key: 'shortName', required: false, example: 'Tiger Genetics', help: '' },
  { header: 'Category', key: 'category', required: false, example: 'Externally funded', help: 'Externally funded / Grant-in-aid / Consultancy / In-house' },
  { header: 'Funding_Agency', key: 'fundingAgency', required: false, example: 'DST', help: 'Name or code from Funding Agencies' },
  { header: 'Scheme', key: 'scheme', required: false, example: 'SERB Core Research Grant', help: '' },
  { header: 'Sanction_Order_No', key: 'sanctionOrderNo', required: false, example: 'DST/SERB/2024/091', help: '' },
  { header: 'Sanction_Date', key: 'sanctionDate', required: false, example: '15-03-2024', help: 'DD-MM-YYYY' },
  { header: 'Sanctioned_Amount', key: 'sanctionedAmount', required: false, example: '38500000', help: 'Rupees' },
  { header: 'Start_Date', key: 'startDate', required: false, example: '01-04-2024', help: 'DD-MM-YYYY' },
  { header: 'End_Date', key: 'endDate', required: false, example: '31-03-2027', help: 'DD-MM-YYYY' },
  { header: 'PI_Name', key: 'piName', required: false, example: 'Dr. Y.V. Jhala', help: 'The PI by name: a PMS Reporting Manager (when PI_Biometric_ID is blank)' },
  { header: 'PI_Biometric_ID', key: 'piBiometricId', required: false, example: '0130', help: 'Biometric ID of the PI: a PMS Reporting Manager' },
  { header: 'CoPI_Biometric_IDs', key: 'coPiBiometricIds', required: false, example: '0339;SAC1013', help: 'Separated by ;' },
  { header: 'Department', key: 'department', required: false, example: 'Animal Ecology', help: '' },
  { header: 'Sites', key: 'sites', required: false, example: 'Madhya Pradesh; Maharashtra', help: '' },
  { header: 'Objectives', key: 'objectives', required: false, example: '', help: '' },
  { header: 'Remarks', key: 'remarks', required: false, example: '', help: '' },
  { header: 'Stage', key: 'stage', required: false, example: 'Ongoing', help: 'Proposed / Under review / Approved / Rejected / Ongoing / Extended / Completed / Closed (blank: Proposed)' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** "Externally funded", "external", "GIA" … → the category key; null when blank; undefined when not recognised. */
export function categoryFromText(text: string): Category | null | undefined {
  const t = norm(text);
  if (!t) return null;
  const hit = CATEGORIES.find((c) => norm(c) === t || norm(CATEGORY_LABELS[c]) === t);
  if (hit) return hit;
  if (t === 'gia') return 'grant_in_aid';
  if (t === 'external' || t === 'externallyfunded' || t === 'extramural') return 'external';
  return undefined;
}

export function stageFromText(text: string): Stage | null | undefined {
  const t = norm(text);
  if (!t) return null;
  return STAGES.find((s) => norm(s) === t || norm(STAGE_LABELS[s]) === t);
}

/**
 * The CSV template: the header row and two rows of hints and examples (starting with #, so they are never
 * imported); the projects go below them.
 */
export function importTemplate(): string {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    IMPORT_COLUMNS.map((c) => cell(c.header)).join(','),
    IMPORT_COLUMNS.map((c, i) => cell(`${i === 0 ? '# ' : ''}${c.required ? 'Required' : 'Optional'}${c.help ? `: ${c.help}` : ''}`)).join(','),
    IMPORT_COLUMNS.map((c, i) => cell(`${i === 0 ? '# e.g. ' : ''}${c.example}`)).join(','),
  ].join('\r\n');
}
