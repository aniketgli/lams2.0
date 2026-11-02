import { TtlCache } from './ttlCache';

/**
 * Reference data that every attendance / leave request needs but that changes rarely:
 * shifts, attendance machines, holidays. One short-lived copy per process replaces a
 * query on every request. Routes that change this data call `clearReferenceCache()`
 * (see the router hooks in settings.routes and holidays.routes), so edits show at once
 * on this process and within `REFERENCE_CACHE_MS` on another.
 */
export const REFERENCE_CACHE_MS = 60_000;
const cache = new TtlCache<unknown>(REFERENCE_CACHE_MS, 500);

/** The cached value for `key`, loading it once when missing. Callers must not change the returned object. */
export function cachedReference<T>(key: string, load: () => Promise<T>): Promise<T> {
  return cache.getOrLoad(key, load) as Promise<T>;
}

export function clearReferenceCache(): void {
  cache.clear();
}

/** Express hook: after any write request finishes, forget the cached reference data. */
export function clearReferenceCacheAfterWrites(req: { method: string }, res: { on: (event: string, listener: () => void) => unknown }, next: () => void): void {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') res.on('finish', clearReferenceCache);
  next();
}
