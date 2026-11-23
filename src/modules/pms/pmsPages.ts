import type { LucideIcon } from 'lucide-react';
import { Briefcase, User } from 'lucide-react';
import type { UserRole } from '../../types';

/**
 * Every PMS screen, its URL (/pms/<slug>) and the roles allowed to open it. The sidebar and the router both read
 * this list (as hrmsPages.ts does for HRMS). The data behind each page is protected by the server.
 *
 * PMS shares the employee screens with HRMS: the server limits them to the PMS employees (the project / contract
 * employee types, Master Settings → Employee Types → Module). PMS has no User Controls: roles stay in HRMS.
 */

const ALL: UserRole[] = ['general_staff', 'reporting_manager', 'reviewing_manager', 'audit', 'administrator'];

export interface PmsPage { id: string; slug: string; label: string; roles: UserRole[]; icon: LucideIcon }

export const PMS_PAGES: PmsPage[] = [
  { id: 'projects', slug: 'projects', label: 'Projects', roles: ALL, icon: Briefcase },
  // The Employee Manager has only this page: it adds, edits and imports PMS employees.
  { id: 'profile', slug: 'employees', label: 'Employees', roles: [...ALL, 'employee_manager'], icon: User },
];

export const PMS_HOME = 'projects';

export function findPmsPageBySlug(slug: string): PmsPage | undefined {
  return PMS_PAGES.find((page) => page.slug === slug);
}

export function canOpenPmsPage(pageId: string, role: UserRole | null | undefined): boolean {
  const page = PMS_PAGES.find((p) => p.id === pageId);
  return Boolean(page && role && page.roles.includes(role));
}

/** The page a role lands on: Projects, or the first page it may open (Employee Manager: Employees). */
export function pmsHomeFor(role: UserRole | null | undefined): string {
  if (!role || canOpenPmsPage(PMS_HOME, role)) return PMS_HOME;
  return PMS_PAGES.find((page) => page.roles.includes(role))?.id ?? PMS_HOME;
}

export const pmsPath = (pageId: string) => `/pms/${PMS_PAGES.find((p) => p.id === pageId)?.slug ?? PMS_HOME}`;
