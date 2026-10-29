import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EnterpriseModuleId, UserRole } from '../types';
import { ApiError, SESSION_ENDED_EVENT, api } from '../shared/services/api';
import { SessionPayload, toServerModule } from './access';

/**
 * Session state for the whole app. The server is the only source of truth:
 * nothing about identity, modules or roles is kept in localStorage, and every
 * change (login, enter module, switch role) is decided by the server and the
 * returned state replaces the local one.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionContextValue {
  status: Status;
  session: SessionPayload | null;
  /** Message to show on the login screen (e.g. "Account is inactive"). */
  notice: string | null;
  login: (userId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enterModule: (moduleId: EnterpriseModuleId) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  exitModule: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const signedOut = useCallback((message: string | null = null) => {
    setSession(null);
    setStatus('signedOut');
    setNotice(message);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api<SessionPayload>('/auth/me', { broadcastSessionEnd: false });
      setSession(payload);
      setStatus('signedIn');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // 401 on first load just means "not signed in yet"; no notice needed.
        signedOut(statusRef.current === 'signedIn' || error.status === 403 ? error.message : null);
      } else if (statusRef.current === 'loading') {
        signedOut(error instanceof Error ? error.message : 'Unable to reach the server.');
      }
      // Network blips while signed in keep the current session on screen.
    }
  }, [signedOut]);

  // Initial load. Also clears identity data older versions cached in the browser.
  useEffect(() => {
    try {
      ['la_hub_users', 'la_hub_current_user_id', 'la_hub_is_authenticated'].forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage unavailable: nothing to clear */
    }
    void refresh();
  }, [refresh]);

  // Any API call that finds the session gone sends everyone back to login.
  useEffect(() => {
    const onEnded = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message ?? 'Your session has ended. Please sign in again.';
      signedOut(message);
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, [signedOut]);

  // Re-check when the tab comes back into view, so a deactivation or revoked
  // role made by an administrator shows up without waiting for the next click.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'signedIn') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const login = useCallback(async (userId: string, password: string) => {
    const payload = await api<SessionPayload>('/auth/login', {
      method: 'POST',
      body: { userId, password },
      broadcastSessionEnd: false,
    });
    setNotice(null);
    setSession(payload);
    setStatus('signedIn');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', broadcastSessionEnd: false });
    } finally {
      signedOut(null);
    }
  }, [signedOut]);

  const enterModule = useCallback(async (moduleId: EnterpriseModuleId) => {
    setSession(await api<SessionPayload>('/access/module', { method: 'POST', body: { moduleId: toServerModule(moduleId) } }));
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    setSession(await api<SessionPayload>('/access/active-role', { method: 'POST', body: { role } }));
  }, []);

  const exitModule = useCallback(async () => {
    setSession(await api<SessionPayload>('/access/exit-module', { method: 'POST' }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, notice, login, logout, enterModule, switchRole, exitModule, refresh }),
    [status, session, notice, login, logout, enterModule, switchRole, exitModule, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>.');
  return ctx;
}
