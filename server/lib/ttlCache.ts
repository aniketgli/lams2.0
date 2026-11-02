/**
 * Small in-process cache with an expiry time and a size limit.
 *
 * `getOrLoad` also joins concurrent callers of the same key onto one load, so a burst of
 * requests for the same data (5000 people opening the portal at 9:30) costs one query,
 * not one query each.
 *
 * It lives in one process. With several processes each keeps its own copy, so keep `ttlMs`
 * short for anything that must change quickly and call `clear()` after the data is written.
 */
export class TtlCache<V> {
  private readonly items = new Map<string, { value: V; expiresAt: number }>();
  private readonly loading = new Map<string, Promise<V>>();
  /** Bumped by clear(), so a load that began earlier does not store stale data. */
  private generation = 0;

  constructor(private readonly ttlMs: number, private readonly maxItems = 5000, private readonly now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const hit = this.items.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) { this.items.delete(key); return undefined; }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.items.size >= this.maxItems && !this.items.has(key)) {
      // Drop the oldest entry (Map keeps insertion order).
      const oldest = this.items.keys().next().value;
      if (oldest !== undefined) this.items.delete(oldest);
    }
    this.items.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  /** The cached value, or the result of `load()` (run once however many callers wait). A failed load is not cached. */
  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const running = this.loading.get(key);
    if (running) return running;
    const generation = this.generation;
    const started = load()
      .then((value) => { if (generation === this.generation) this.set(key, value); return value; })
      .finally(() => { if (this.loading.get(key) === started) this.loading.delete(key); });
    this.loading.set(key, started);
    return started;
  }

  delete(key: string): void { this.items.delete(key); }

  /** Forget everything, including loads in flight (their results will not be stored). */
  clear(): void { this.generation += 1; this.items.clear(); this.loading.clear(); }

  get size(): number { return this.items.size; }
}
