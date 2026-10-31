import type { UserRole } from '../../types';

/**
 * Every HRMS screen, its URL and the roles allowed to open it.
 * This is the only place page access is defined: the sidebar uses it to decide
 * what to show, and the router uses it to redirect URLs a role may not open.
 *
 * Page access only controls navigation. The data behind each page is protected
 * separately by the server's role checks on each API endpoint.
 */

const ALL: UserRole[] = ['general_staff', 'reporting_manager', 'reviewing_manager', 'audit', 'administrator'];

export interface HrmsPage {
  /** Page ID used by existing components (onNavigate('leave') etc.). */
  id: string;
  /** URL segment after /hrms/. */
  slug: string;
  roles: UserRole[];
}

export const HRMS_PAGES: HrmsPage[] = [
  { id: 'dashboard', slug: 'dashboard', roles: ALL },
  { id: 'attendance', slug: 'attendance', roles: ALL },
  { id: 'manual_attendance', slug: 'manual-attendance', roles: ALL },
  { id: 'od', slug: 'outdoor-duty', roles: ALL },
  { id: 'leave', slug: 'leave', roles: ALL },
  { id: 'leave_balance', slug: 'leave-balance', roles: ['administrator', 'audit'] },
  { id: 'holiday_calendar', slug: 'holidays', roles: ALL },
  { id: 'profile', slug: 'profiles', roles: ALL },
  { id: 'user_controls', slug: 'user-controls', roles: ['administrator', 'audit'] },
  { id: 'transfers', slug: 'employee-mapping', roles: ['administrator', 'audit'] },
  { id: 'master', slug: 'master-settings', roles: ['administrator', 'audit'] },
];

/** Older page IDs that point at the same screen. */
const ALIASES: Record<string, string> = {
  attendance_management: 'attendance',
  leave_matrix: 'leave_balance',
  roles: 'user_controls',
};

export const HRMS_HOME = 'dashboard';

export function findPageById(id: string): HrmsPage | undefined {
  const canonical = ALIASES[id] ?? id;
  return HRMS_PAGES.find((page) => page.id === canonical);
}

export function findPageBySlug(slug: string): HrmsPage | undefined {
  return HRMS_PAGES.find((page) => page.slug === slug);
}

export function canOpenPage(pageId: string, role: UserRole | null | undefined): boolean {
  const page = findPageById(pageId);
  return Boolean(page && role && page.roles.includes(role));
}

export const hrmsPath = (pageId: string) => `/hrms/${findPageById(pageId)?.slug ?? HRMS_HOME}`;
