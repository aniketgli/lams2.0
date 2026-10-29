/**
 * Fixed-window, in-memory attempt counter for brute-force protection.
 *
 * This is per server process. If the app is ever run as several processes
 * behind a load balancer, move the counters to MySQL or Redis.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxAttempts: number, private readonly windowMs: number) {
    // Periodically drop expired entries so the map cannot grow without bound.
    setInterval(() => this.sweep(), Math.min(windowMs, 5 * 60 * 1000)).unref();
  }

  /** Seconds until the key may try again, or 0 if it is not blocked. */
  retryAfter(key: string): number {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= Date.now()) return 0;
    return entry.count >= this.maxAttempts ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0;
  }

  fail(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep() {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
