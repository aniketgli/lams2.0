import type { UserRole } from '../../types';

/**
 * Every PMS screen, its URL (/pms/<slug>) and the roles allowed to open it. The sidebar and the router both read
 * this list (as hrmsPages.ts does for HRMS). The data behind each page is protected by the server.
 *
 * PMS shares the HRMS screens (dashboard, attendance, leave, holidays, employees): the server limits each to the PMS
 * employees (the project / contract employee types, Master Settings → Employee Types → Module), with the same rules as HRMS.
 * PMS has no User Controls or Employee Mapping: roles stay in HRMS.
 */

const ALL: UserRole[] = ['general_staff', 'reporting_manager', 'reviewing_manager', 'audit', 'administrator'];

export interface PmsPage { id: string; slug: string; roles: UserRole[] }

export const PMS_PAGES: PmsPage[] = [
  { id: 'dashboard', slug: 'dashboard', roles: ALL },
  { id: 'attendance', slug: 'attendance', roles: ALL },
  { id: 'manual_attendance', slug: 'manual-attendance', roles: ALL },
  { id: 'od', slug: 'outdoor-duty', roles: ALL },
  { id: 'leave', slug: 'leave', roles: ALL },
  // The PMS Leave Balance Manager has only this page.
  { id: 'leave_balance', slug: 'leave-balance', roles: ['administrator', 'audit', 'leave_balance_manager'] },
  { id: 'holiday_calendar', slug: 'holidays', roles: ALL },
  // The PMS Employee Manager has only this page: it adds, edits and imports PMS employees.
  { id: 'profile', slug: 'employees', roles: [...ALL, 'employee_manager'] },
  // Projects: the RC office (Administrator) every project, a PI the projects where they are the PI, the Auditor reads.
  { id: 'projects', slug: 'projects', roles: ['administrator', 'audit', 'project_pi'] },
  // Only the masters PMS uses (PmsMasterSettingsPage); shared ones stay in HRMS.
  { id: 'master', slug: 'master-settings', roles: ['administrator', 'audit'] },
];

export const PMS_HOME = 'dashboard';

export function findPmsPageBySlug(slug: string): PmsPage | undefined {
  return PMS_PAGES.find((page) => page.slug === slug);
}

export function canOpenPmsPage(pageId: string, role: UserRole | null | undefined): boolean {
  const page = PMS_PAGES.find((p) => p.id === pageId);
  return Boolean(page && role && page.roles.includes(role));
}

/** The page a role lands on: the dashboard, or the first page it may open (Leave Balance / Employee Manager / PI: Projects). */
export function pmsHomeFor(role: UserRole | null | undefined): string {
  if (!role || canOpenPmsPage(PMS_HOME, role)) return PMS_HOME;
  return PMS_PAGES.find((page) => page.roles.includes(role))?.id ?? PMS_HOME;
}

export const pmsPath = (pageId: string) => `/pms/${PMS_PAGES.find((p) => p.id === pageId)?.slug ?? PMS_HOME}`;
