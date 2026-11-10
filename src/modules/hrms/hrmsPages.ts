import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight, Calendar, CheckCircle2, Clock, FileBarChart, FileSpreadsheet, FileText, LayoutDashboard, MapPin, ShieldCheck, Sliders, User,
} from 'lucide-react';
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
  // Leave Balance Manager: this page only.
  { id: 'leave_balance', slug: 'leave-balance', roles: ['administrator', 'audit', 'leave_balance_manager'] },
  { id: 'holiday_calendar', slug: 'holidays', roles: ALL },
  { id: 'profile', slug: 'profiles', roles: ALL },
  { id: 'user_controls', slug: 'user-controls', roles: ['administrator', 'audit'] },
  { id: 'transfers', slug: 'employee-mapping', roles: ['administrator', 'audit'] },
  { id: 'master', slug: 'master-settings', roles: ['administrator', 'audit'] },
  { id: 'reports', slug: 'reports', roles: ['administrator', 'audit'] },
];

/** Older page IDs that point at the same screen. */
const ALIASES: Record<string, string> = {
  attendance_management: 'attendance',
  leave_matrix: 'leave_balance',
  roles: 'user_controls',
};

/**
 * One icon per page. The sidebar and the page's header both read it, so a page never has two different icons.
 * (Page ids as in HRMS_PAGES.)
 */
export const PAGE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  attendance: Clock,
  manual_attendance: CheckCircle2,
  od: MapPin,
  leave: FileText,
  leave_balance: FileSpreadsheet,
  holiday_calendar: Calendar,
  profile: User,
  user_controls: ShieldCheck,
  transfers: ArrowLeftRight,
  master: Sliders,
  reports: FileBarChart,
};

export const HRMS_HOME = 'dashboard';

/** The page a role lands on: the dashboard, or the first page it may open when it has no dashboard (Leave Balance Manager). */
export function homePageFor(role: UserRole | null | undefined): string {
  if (!role || canOpenPage(HRMS_HOME, role)) return HRMS_HOME;
  return HRMS_PAGES.find((page) => page.roles.includes(role))?.id ?? HRMS_HOME;
}

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
