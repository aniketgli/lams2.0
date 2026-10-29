/**
 * Session lifetime rules. Both limits are enforced by the server on every
 * request; the browser only mirrors them to show a warning before logout.
 *
 *   SESSION_IDLE_MINUTES  sign out after this long with no user activity (default 15)
 *   SESSION_MAX_HOURS     sign out this long after login, however active (default 8)
 */
function readNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.max(raw, min), max);
}

export const sessionConfig = {
  idleMs: readNumber('SESSION_IDLE_MINUTES', 15, 2, 240) * 60 * 1000,
  maxMs: readNumber('SESSION_MAX_HOURS', 8, 1, 24) * 60 * 60 * 1000,
  /** Activity timestamps are written at most this often to avoid a DB write on every request. */
  activityWriteIntervalMs: 15 * 1000,
};

/** Requests carrying this header (background checks) do not count as user activity. */
export const PASSIVE_REQUEST_HEADER = 'x-wii-passive';
