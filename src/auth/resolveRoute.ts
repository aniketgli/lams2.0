import type { EnterpriseModuleId } from '../types';
import { SessionPayload, toUiModule } from './access';
import { HRMS_HOME, canOpenPage, findPageBySlug, hrmsPath } from '../modules/hrms/hrmsPages';

export type Screen =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'lobby' }
  | { kind: 'hrms'; page: string }
  | { kind: 'module'; module: Exclude<EnterpriseModuleId, 'lams'> };

/**
 * Decides what a URL may show for the current session. The URL never grants
 * access: whatever is typed or pasted, the result is limited to what the
 * session allows, and `path` is the address the browser should show for it.
 *
 *   signed out                 → /login (any deep link included)
 *   signed in, no module open  → /lobby
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
  if (!session.activeModule) return { screen: { kind: 'lobby' }, path: '/lobby' };

  const [, moduleSegment, pageSegment] = rawPath.split('/');
  if (session.activeModule === 'hrms') {
    const page = moduleSegment === 'hrms' && pageSegment ? findPageBySlug(pageSegment) : undefined;
    const pageId = page && canOpenPage(page.id, session.activeRole) ? page.id : HRMS_HOME;
    return { screen: { kind: 'hrms', page: pageId }, path: hrmsPath(pageId) };
  }
  const module = toUiModule(session.activeModule) as Exclude<EnterpriseModuleId, 'lams'>;
  return { screen: { kind: 'module', module }, path: `/${session.activeModule}` };
}
