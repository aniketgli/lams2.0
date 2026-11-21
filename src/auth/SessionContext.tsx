import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EnterpriseModuleId, UserRole } from '../types';
import { ApiError, CONTEXT_CHANGED_EVENT, SESSION_ENDED_EVENT, api, currentSessionEpoch, setApiContext, startNewSessionEpoch } from '../shared/services/api';
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
  | { type: 'signed-out'; message: string | null; tag?: string | null };

interface SessionContextValue {
  status: Status;
  session: SessionPayload | null;
  /** Message to show on the login screen (e.g. "Account is inactive"). */
  notice: string | null;
  /** Where the last sign-out came from (shown small under the notice, so a report can say which part did it). */
  noticeRef: string | null;
  login: (email: string, password: string, captcha?: { token: string; answer: string }) => Promise<void>;
  logout: (message?: string | null, source?: string) => Promise<void>;
  enterModule: (moduleId: EnterpriseModuleId) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  exitModule: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Sets the user's own password; the server checks every rule. Throws ApiError with field details. */
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  /** Dismiss the one-time offer to change the default password. */
  skipPasswordChange: () => Promise<void>;
  /** Last user activity in any tab (epoch ms). */
  getLastActivity: () => number;
  /** Checks with the server before an inactivity sign-out; true when the session really is idle. */
  confirmIdle: () => Promise<boolean>;
  /** Milliseconds of inactivity after which this browser signs out. */
  idleLimitMs: number;
  /** "I'm still here": records activity and tells the server immediately. */
  stayActive: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const LEGACY_IDENTITY_KEYS = ['la_hub_users', 'la_hub_current_user_id', 'la_hub_is_authenticated'];

/**
 * After the server has ended a session (idle, time limit, account blocked), ask it to drop the session cookie too,
 * so nothing of the old session is left in the browser when the user signs in again. Best effort.
 */
let clearing: Promise<unknown> | null = null;
function clearServerSession(sessionTag: string | null): void {
  const request = api('/auth/logout', { method: 'POST', passive: true, body: { sessionTag } }).catch(() => undefined);
  clearing = request;
  void request.finally(() => { if (clearing === request) clearing = null; });
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeRef, setNoticeRef] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const tagRef = useRef<string | null>(null);
  tagRef.current = session?.sessionTag ?? null;
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

  const signedOut = useCallback((message: string | null = null, source: string | null = null) => {
    setApiContext(null, null);
    setSession(null);
    setStatus('signedOut');
    setNotice(message);
    setNoticeRef(message ? source : null);
    if (message && source) console.warn(`[session] signed out (${source}): ${message}`);
  }, []);

  /**
   * The server counts activity from every tab and device of the session. A tab that was asleep or frozen (and missed
   * the other tabs' activity messages) takes the server's count, so it never signs everyone out on a stale clock.
   * Relative seconds are used, so a wrong PC clock does not matter.
   */
  const adoptServerActivity = useCallback((payload: SessionPayload) => {
    const left = payload.limits?.idleSecondsLeft;
    if (typeof left !== 'number' || !Number.isFinite(left)) return;
    const serverLast = Date.now() - Math.max(0, payload.limits.idleSeconds - left) * 1000;
    lastActivityRef.current = Math.max(lastActivityRef.current, serverLast);
  }, []);

  /** Ask the server who we are. `passive` checks do not count as user activity. */
  const sync = useCallback(async (passive: boolean) => {
    const activityAtStart = lastActivityRef.current;
    const epoch = currentSessionEpoch();
    try {
      const payload = await api<SessionPayload>('/auth/me', { passive });
      lastSyncAtRef.current = Date.now();
      if (!passive) lastSyncedActivityRef.current = activityAtStart;
      adoptServerActivity(payload);
      applySession(payload);
    } catch (error) {
      // The user signed in again while this check was on its way: its answer is about the old session.
      if (epoch !== currentSessionEpoch()) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // 401 on first load just means "not signed in yet"; no notice needed.
        const wasSignedIn = statusRef.current === 'signedIn';
        // The server has ended the session: also drop its cookie, so the next sign-in starts clean.
        if (wasSignedIn) clearServerSession(tagRef.current);
        signedOut(wasSignedIn || error.status === 403 ? error.message : null, `check ${error.status} ${error.code ?? ''}`.trim());
      } else if (statusRef.current === 'loading') {
        signedOut(error instanceof Error ? error.message : 'Unable to reach the server.', 'start');
      }
      // A network blip while signed in keeps the current screen; the next check retries.
    }
  }, [applySession, signedOut, adoptServerActivity]);

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
          // Signing in or switching role in another tab is the user being active.
          lastActivityRef.current = Date.now();
          void sync(true);
        } else if (message?.type === 'signed-out') {
          // Another tab signed out a different (older) sign-in than this tab's — or is still running an older version
          // of the app that does not name its sign-in: ask the server what is current instead of signing out.
          if (tagRef.current && message.tag !== tagRef.current) void sync(true);
          else signedOut(message.message, 'other tab');
        }
      };
      channelRef.current = channel;
    }

    const onEnded = (event: Event) => {
      if (statusRef.current !== 'signedIn') return;
      clearServerSession(tagRef.current);
      const detail = (event as CustomEvent<{ message?: string; code?: string; path?: string }>).detail ?? {};
      signedOut(detail.message ?? 'Your session has ended. Please sign in again.', `server ${detail.code ?? ''} ${detail.path ?? ''}`.replace(/\s+/g, ' ').trim());
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
  const login = useCallback(async (email: string, password: string, captcha?: { token: string; answer: string }) => {
    // Answers to requests sent before this sign-in (an old tab, a check on its way) are about the old session.
    startNewSessionEpoch();
    // Let a cookie clean-up still on its way finish first, so its answer cannot remove the new cookie.
    if (clearing) await clearing;
    const payload = await api<SessionPayload>('/auth/login', {
      method: 'POST',
      body: { email, password, ...(captcha ? { captchaToken: captcha.token, captchaAnswer: captcha.answer } : {}) },
    });
    startNewSessionEpoch();
    const now = Date.now();
    lastActivityRef.current = now;
    lastSyncedActivityRef.current = now;
    lastSyncAtRef.current = now;
    setNotice(null);
    applySession(payload);
    tell({ type: 'session-changed' });
  }, [applySession, tell]);

  const logout = useCallback(async (message: string | null = null, source = 'sign out') => {
    const tag = tagRef.current;
    let kept = false;
    try {
      // Only this tab's sign-in: if the user has signed in again elsewhere meanwhile, the server keeps that session.
      kept = Boolean((await api<{ kept?: boolean }>('/auth/logout', { method: 'POST', body: { sessionTag: tag } }))?.kept);
    } catch {
      /* already signed out on the server */
    } finally {
      if (kept) {
        // A newer sign-in is in use: show it here too instead of signing out.
        void sync(true);
      } else {
        signedOut(message, source);
        tell({ type: 'signed-out', message: message ?? 'You signed out in another tab.', tag });
      }
    }
  }, [signedOut, tell, sync]);

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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    applySession(await api<SessionPayload>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword, confirmPassword } }));
    // Other devices were signed out by the server; other tabs here re-check.
    tell({ type: 'session-changed' });
  }, [applySession, tell]);

  const skipPasswordChange = useCallback(async () => {
    applySession(await api<SessionPayload>('/auth/skip-password-change', { method: 'POST' }));
    tell({ type: 'session-changed' });
  }, [applySession, tell]);

  const stayActive = useCallback(async () => {
    lastActivityRef.current = Date.now();
    tell({ type: 'activity', at: lastActivityRef.current });
    await sync(false);
  }, [sync, tell]);

  const getLastActivity = useCallback(() => lastActivityRef.current, []);

  /**
   * Before signing out for inactivity, ask the server (passively): another tab may have been in use. Returns true
   * only when the session is still idle by both counts; when the server has already ended it, the sign-out notice
   * comes from the server instead.
   */
  const confirmIdle = useCallback(async () => {
    await sync(true);
    if (statusRef.current !== 'signedIn') return false;
    const limit = Math.max(60_000, (session?.limits.idleSeconds ?? 900) * 1000 - IDLE_SAFETY_MARGIN_MS);
    return Date.now() - lastActivityRef.current >= limit;
  }, [sync, session]);
  const idleLimitMs = Math.max(60_000, (session?.limits.idleSeconds ?? 900) * 1000 - IDLE_SAFETY_MARGIN_MS);

  const value = useMemo<SessionContextValue>(
    () => ({
      status, session, notice, noticeRef, login, logout, enterModule, switchRole, exitModule, refresh, changePassword, skipPasswordChange,
      getLastActivity, confirmIdle, idleLimitMs, stayActive,
    }),
    [status, session, notice, noticeRef, login, logout, enterModule, switchRole, exitModule, refresh, changePassword, skipPasswordChange, getLastActivity, confirmIdle, idleLimitMs, stayActive],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>.');
  return ctx;
}
