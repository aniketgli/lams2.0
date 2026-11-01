import type { EnterpriseModuleId } from '../types';
import { SessionPayload, toUiModule } from './access';
import { HRMS_HOME, canOpenPage, findPageBySlug, hrmsPath } from '../modules/hrms/hrmsPages';

export const CHANGE_PASSWORD_PATH = '/change-password';

export type Screen =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'lobby' }
  /** first = the one-time offer after the first sign-in of a new or reactivated account (can be skipped). */
  | { kind: 'changePassword'; first: boolean }
  | { kind: 'hrms'; page: string }
  | { kind: 'module'; module: Exclude<EnterpriseModuleId, 'lams'> };

/**
 * Decides what a URL may show for the current session. The URL never grants
 * access: whatever is typed or pasted, the result is limited to what the
 * session allows, and `path` is the address the browser should show for it.
 *
 *   signed out                 → /login (any deep link included)
 *   password change offered    → /change-password once, skippable
 *   signed in, no module open  → /lobby, or /change-password if asked for
 *   module open                → only that module's pages; others → its dashboard
 *   HRMS page the role may not open, or unknown page → /hrms/dashboard
 */
export function resolveRoute(
  rawPath: string,
  status: 'loading' | 'signedOut' | 'signedIn',
  session: SessionPayload | null,
): { screen: Screen; path: string | null } {
  if (status === 'loading') return { screen: { kind: 'loading' }, path: null };
  if (status === 'signedOut' || !session) return { screen: { kind: 'login' }, path: '/login' };
  if (session.mustChangePassword) return { screen: { kind: 'changePassword', first: true }, path: CHANGE_PASSWORD_PATH };
  if (!session.activeModule) {
    if (rawPath === CHANGE_PASSWORD_PATH) return { screen: { kind: 'changePassword', first: false }, path: CHANGE_PASSWORD_PATH };
    return { screen: { kind: 'lobby' }, path: '/lobby' };
  }

  const [, moduleSegment, pageSegment] = rawPath.split('/');
  if (session.activeModule === 'hrms') {
    const page = moduleSegment === 'hrms' && pageSegment ? findPageBySlug(pageSegment) : undefined;
    const pageId = page && canOpenPage(page.id, session.activeRole) ? page.id : HRMS_HOME;
    return { screen: { kind: 'hrms', page: pageId }, path: hrmsPath(pageId) };
  }
  const module = toUiModule(session.activeModule) as Exclude<EnterpriseModuleId, 'lams'>;
  return { screen: { kind: 'module', module }, path: `/${session.activeModule}` };
}
