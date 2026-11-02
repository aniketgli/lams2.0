import { describe, expect, test } from 'bun:test';
import { TtlCache } from './ttlCache';

describe('TtlCache', () => {
  test('keeps a value until it expires', () => {
    let t = 1000;
    const c = new TtlCache<string>(100, 10, () => t);
    c.set('a', 'x');
    expect(c.get('a')).toBe('x');
    t += 101;
    expect(c.get('a')).toBeUndefined();
  });
  test('concurrent callers share one load', async () => {
    const c = new TtlCache<number>(1000);
    let calls = 0;
    const load = async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return 7; };
    const out = await Promise.all([c.getOrLoad('k', load), c.getOrLoad('k', load), c.getOrLoad('k', load)]);
    expect(out).toEqual([7, 7, 7]);
    expect(calls).toBe(1);
    expect(await c.getOrLoad('k', load)).toBe(7);
    expect(calls).toBe(1);
  });
  test('a failed load is not cached and can be retried', async () => {
    const c = new TtlCache<number>(1000);
    await expect(c.getOrLoad('k', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await c.getOrLoad('k', async () => 1)).toBe(1);
  });
  test('a load started before clear() is not stored', async () => {
    const c = new TtlCache<number>(1000);
    const p = c.getOrLoad('k', async () => { await new Promise((r) => setTimeout(r, 5)); return 1; });
    c.clear();
    await p;
    expect(c.get('k')).toBeUndefined();
  });
  test('size limit drops the oldest', () => {
    const c = new TtlCache<number>(1000, 2);
    c.set('a', 1); c.set('b', 2); c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });
});
