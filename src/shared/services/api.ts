/**
 * Single HTTP client for the app's JSON API.
 *
 * - Always sends the session cookie and JSON.
 * - Throws ApiError with the server's message, code and field-level details.
 * - Broadcasts SESSION_ENDED_EVENT when the server says the session is gone
 *   (signed out, expired, account deactivated), so the app can return to login
 *   from anywhere without each screen handling it.
 */

export const SESSION_ENDED_EVENT = 'wii:session-ended';

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

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** Set false for the login/me calls themselves, which handle 401 on their own. */
  broadcastSessionEnd?: boolean;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, broadcastSessionEnd = true } = options;

  let response: Response;
  try {
    response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${response.status}).`;
    const error = new ApiError(response.status, message, data?.code, data?.details);
    const sessionEnded = response.status === 401 || data?.code === 'ACCOUNT_BLOCKED';
    if (sessionEnded && broadcastSessionEnd) {
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { message } }));
    }
    throw error;
  }

  return data as T;
}
