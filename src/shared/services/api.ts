/**
 * HTTP layer for the app's JSON API.
 *
 * - `api()` is the client new code should use: JSON in/out, ApiError on failure.
 * - `installFetchGuard()` wraps window.fetch once at start-up so that older
 *   screens that still call fetch('/api/...') directly get the same session
 *   handling without being rewritten.
 *
 * Every /api request carries the tab's current module:role (`x-wii-context`).
 * The server refuses the request if another tab or device has changed the role,
 * and every response is checked for "session ended" and "role changed".
 */

export const SESSION_ENDED_EVENT = 'wii:session-ended';
export const CONTEXT_CHANGED_EVENT = 'wii:context-changed';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CONTEXT_HEADER = 'x-wii-context';
const PASSIVE_HEADER = 'x-wii-passive';

/** Kept in sync with the session by SessionProvider. */
let currentContext = 'none';
export function setApiContext(moduleId: string | null, role: string | null) {
  currentContext = moduleId && role ? `${moduleId}:${role}` : 'none';
}

const nativeFetch: typeof window.fetch = window.fetch.bind(window);

function apiPath(input: RequestInfo | URL): string | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/** Sign-in and module/role selection change the context themselves, so they never claim one. */
const claimsContext = (path: string) => !path.startsWith('/api/auth/') && !path.startsWith('/api/access/');

/**
 * Changes on every sign-in. A request sent before the latest sign-in still carries the old session; when its answer
 * ("signed out") arrives after the user has signed in again, it must not sign the new session out.
 */
let sessionEpoch = 0;
export function startNewSessionEpoch(): void { sessionEpoch += 1; }
export function currentSessionEpoch(): number { return sessionEpoch; }

function emit(name: string, message: string, extra: { code?: string; path?: string } = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail: { message, ...extra } }));
}

/** Looks at a response and raises the app-wide events. Reads a clone, never the original body. */
async function inspect(response: Response, path: string, epoch: number) {
  if (response.ok) return;
  if (epoch !== sessionEpoch) return; // answer to a request from before the latest sign-in
  if (path === '/api/auth/login') return; // a wrong password is not a session ending
  if (response.status !== 401 && response.status !== 403 && response.status !== 409) return;
  const body = await response.clone().json().catch(() => null);
  const message = (body && (body.message || body.error)) || '';
  if (response.status === 401 || body?.code === 'ACCOUNT_BLOCKED') {
    emit(SESSION_ENDED_EVENT, message || 'Your session has ended. Please sign in again.', { code: body?.code, path });
  } else if (body?.code === 'CONTEXT_CHANGED') {
    emit(CONTEXT_CHANGED_EVENT, message);
  }
}

function withSessionHeaders(path: string, headersInit: HeadersInit | undefined, passive: boolean): Headers {
  const headers = new Headers(headersInit);
  if (claimsContext(path) && !headers.has(CONTEXT_HEADER)) headers.set(CONTEXT_HEADER, currentContext);
  if (passive) headers.set(PASSIVE_HEADER, '1');
  return headers;
}

let guardInstalled = false;
export function installFetchGuard() {
  if (guardInstalled) return;
  guardInstalled = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = apiPath(input);
    if (!path) return nativeFetch(input, init);
    const headers = withSessionHeaders(path, init?.headers ?? (input instanceof Request ? input.headers : undefined), false);
    const epoch = sessionEpoch;
    const response = await nativeFetch(input, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
    void inspect(response, path, epoch);
    return response;
  };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** Background check that must not count as user activity for the idle timer. */
  passive?: boolean;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, passive = false } = options;
  const fullPath = path.startsWith('/api') ? path : `/api${path}`;
  const headers = withSessionHeaders(fullPath, { Accept: 'application/json' }, passive);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const epoch = sessionEpoch;
  let response: Response;
  try {
    response = await nativeFetch(fullPath, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }

  await inspect(response, fullPath, epoch);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${response.status}).`;
    throw new ApiError(response.status, message, data?.code, data?.details);
  }
  return data as T;
}
