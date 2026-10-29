import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EnterpriseModuleId, UserRole } from '../types';
import { ApiError, CONTEXT_CHANGED_EVENT, SESSION_ENDED_EVENT, api, setApiContext } from '../shared/services/api';
import { SessionPayload, toServerModule } from './access';

/**
 * Session state for the whole app. The server is the only source of truth:
 * identity, modules and roles are never kept in localStorage, and every change
 * (login, enter module, switch role, logout) is decided by the server.
 *
 * Tabs of the same browser share one server session, so they are kept in step
 * with a BroadcastChannel: signing in, signing out or changing role in one tab
 * updates the others immediately. Other devices have their own sessions; they
 * pick up account or role changes on their next request or status check.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

/** How often a signed-in tab re-checks its session with the server. */
const STATUS_CHECK_MS = 60_000;
/** User activity is reported to the server at most this often. */
const ACTIVITY_SYNC_MS = 15_000;
/**
 * The browser signs out this much before the server's idle limit, so the
 * server never ends a session the user still sees as alive.
 */
const IDLE_SAFETY_MARGIN_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'] as const;

type TabMessage =
  | { type: 'activity'; at: number }
  | { type: 'session-changed' }
  | { type: 'signed-out'; message: string | null };

interface SessionContextValue {
  status: Status;
  session: SessionPayload | null;
  /** Message to show on the login screen (e.g. "Account is inactive"). */
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (message?: string | null) => Promise<void>;
  enterModule: (moduleId: EnterpriseModuleId) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  exitModule: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Last user activity in any tab (epoch ms). */
  getLastActivity: () => number;
  /** Milliseconds of inactivity after which this browser signs out. */
  idleLimitMs: number;
  /** "I'm still here": records activity and tells the server immediately. */
  stayActive: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const LEGACY_IDENTITY_KEYS = ['la_hub_users', 'la_hub_current_user_id', 'la_hub_is_authenticated'];

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const lastActivityRef = useRef(Date.now());
  const lastSyncedActivityRef = useRef(Date.now());
  const lastSyncAtRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const tell = useCallback((message: TabMessage) => {
    try {
      channelRef.current?.postMessage(message);
    } catch {
      /* channel closed */
    }
  }, []);

  const applySession = useCallback((payload: SessionPayload) => {
    setApiContext(payload.activeModule, payload.activeRole);
    setSession(payload);
    setStatus('signedIn');
  }, []);

  const signedOut = useCallback((message: string | null = null) => {
    setApiContext(null, null);
    setSession(null);
    setStatus('signedOut');
    setNotice(message);
  }, []);

  /** Ask the server who we are. `passive` checks do not count as user activity. */
  const sync = useCallback(async (passive: boolean) => {
    const activityAtStart = lastActivityRef.current;
    try {
      const payload = await api<SessionPayload>('/auth/me', { passive });
      lastSyncAtRef.current = Date.now();
      if (!passive) lastSyncedActivityRef.current = activityAtStart;
      applySession(payload);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // 401 on first load just means "not signed in yet"; no notice needed.
        const wasSignedIn = statusRef.current === 'signedIn';
        signedOut(wasSignedIn || error.status === 403 ? error.message : null);
      } else if (statusRef.current === 'loading') {
        signedOut(error instanceof Error ? error.message : 'Unable to reach the server.');
      }
      // A network blip while signed in keeps the current screen; the next check retries.
    }
  }, [applySession, signedOut]);

  const refresh = useCallback(() => sync(true), [sync]);

  // --- Start-up, tab channel, app-wide events ------------------------------
  useEffect(() => {
    try {
      LEGACY_IDENTITY_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage unavailable */
    }

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('wii-session');
      channel.onmessage = (event: MessageEvent<TabMessage>) => {
        const message = event.data;
        if (message?.type === 'activity') {
          lastActivityRef.current = Math.max(lastActivityRef.current, message.at);
        } else if (message?.type === 'session-changed') {
          void sync(true);
        } else if (message?.type === 'signed-out') {
          signedOut(message.message);
        }
      };
      channelRef.current = channel;
    }

    const onEnded = (event: Event) => {
      if (statusRef.current !== 'signedIn') return;
      signedOut((event as CustomEvent<{ message?: string }>).detail?.message ?? 'Your session has ended. Please sign in again.');
    };
    const onContextChanged = () => void sync(true);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    window.addEventListener(CONTEXT_CHANGED_EVENT, onContextChanged);

    void sync(false);

    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener(CONTEXT_CHANGED_EVENT, onContextChanged);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [sync, signedOut]);

  // --- Activity tracking (signed in only) -----------------------------------
  useEffect(() => {
    if (status !== 'signedIn') return;
    let lastBroadcast = 0;
    const onActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastBroadcast > 5_000) {
        lastBroadcast = now;
        tell({ type: 'activity', at: now });
      }
      // Report the first activity after a quiet spell straight away, so the
      // server's idle clock never lags far behind what the user is doing.
      if (now - lastSyncAtRef.current > ACTIVITY_SYNC_MS) {
        lastSyncAtRef.current = now;
        void sync(false);
      }
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
  }, [status, sync, tell]);

  // --- Periodic status check + re-check when the tab is shown again ----------
  useEffect(() => {
    if (status !== 'signedIn') return;
    const check = () => {
      const activeSinceLastSync = lastActivityRef.current > lastSyncedActivityRef.current;
      void sync(!activeSinceLastSync);
    };
    const timer = window.setInterval(check, STATUS_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    // A page restored from the back/forward cache (e.g. Back after logout) must re-check.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [status, sync]);

  // --- Actions ---------------------------------------------------------------
  const login = useCallback(async (email: string, password: string) => {
    const payload = await api<SessionPayload>('/auth/login', { method: 'POST', body: { email, password } });
    const now = Date.now();
    lastActivityRef.current = now;
    lastSyncedActivityRef.current = now;
    lastSyncAtRef.current = now;
    setNotice(null);
    applySession(payload);
    tell({ type: 'session-changed' });
  }, [applySession, tell]);

  const logout = useCallback(async (message: string | null = null) => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* already signed out on the server */
    } finally {
      signedOut(message);
      tell({ type: 'signed-out', message: message ?? 'You signed out in another tab.' });
    }
  }, [signedOut, tell]);

  const changeContext = useCallback(async (path: string, body?: unknown) => {
    applySession(await api<SessionPayload>(path, { method: 'POST', body }));
    tell({ type: 'session-changed' });
  }, [applySession, tell]);

  const enterModule = useCallback(
    (moduleId: EnterpriseModuleId) => changeContext('/access/module', { moduleId: toServerModule(moduleId) }),
    [changeContext],
  );
  const switchRole = useCallback((role: UserRole) => changeContext('/access/active-role', { role }), [changeContext]);
  const exitModule = useCallback(() => changeContext('/access/exit-module'), [changeContext]);

  const stayActive = useCallback(async () => {
    lastActivityRef.current = Date.now();
    tell({ type: 'activity', at: lastActivityRef.current });
    await sync(false);
  }, [sync, tell]);

  const getLastActivity = useCallback(() => lastActivityRef.current, []);
  const idleLimitMs = Math.max(60_000, (session?.limits.idleSeconds ?? 900) * 1000 - IDLE_SAFETY_MARGIN_MS);

  const value = useMemo<SessionContextValue>(
    () => ({
      status, session, notice, login, logout, enterModule, switchRole, exitModule, refresh,
      getLastActivity, idleLimitMs, stayActive,
    }),
    [status, session, notice, login, logout, enterModule, switchRole, exitModule, refresh, getLastActivity, idleLimitMs, stayActive],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>.');
  return ctx;
}
