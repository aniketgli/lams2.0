import { describe, expect, test } from 'bun:test';
import { rateLimiter } from './apiRateLimit';

/** Runs the middleware like Express would and reports what it did. */
function call(mw: ReturnType<typeof rateLimiter>, req: Record<string, unknown>) {
  const headers: Record<string, string> = {};
  let error: { status?: number } | undefined;
  mw(req as never, { setHeader: (k: string, v: string) => { headers[k] = v; } } as never, (e?: unknown) => { error = e as { status?: number }; });
  return { status: error?.status ?? 200, retryAfter: headers['Retry-After'] };
}

describe('API rate limits', () => {
  test('stops a key after `max` requests in the window and says when to retry', () => {
    const mw = rateLimiter(3, 60_000, (req) => String((req as { ip: string }).ip), 'slow down');
    expect([1, 2, 3].map(() => call(mw, { ip: 'a' }).status)).toEqual([200, 200, 200]);
    const blocked = call(mw, { ip: 'a' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.retryAfter)).toBeGreaterThan(0);
    // Another address is not affected.
    expect(call(mw, { ip: 'b' }).status).toBe(200);
  });
  test('requests without a key (e.g. reads for the write limit) are not counted', () => {
    const mw = rateLimiter(1, 60_000, () => null, 'x');
    expect([1, 2, 3].map(() => call(mw, {}).status)).toEqual([200, 200, 200]);
  });
});
