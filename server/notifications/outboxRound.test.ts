import { beforeEach, describe, expect, test } from 'bun:test';

// A stand-in database that remembers the SQL and answers the outbox's SELECTs from `table`.
type Row = Record<string, unknown>;
let table: Row[] = [];
const statements: Array<{ sql: string; params: unknown[] }> = [];
const query = async (sql: string, params: unknown[] = []) => {
  statements.push({ sql, params });
  if (/^SELECT id FROM email_outbox WHERE status = 'pending'/.test(sql)) return [table.filter((r) => r.status === 'pending').map((r) => ({ id: r.id }))];
  if (/^SELECT \* FROM email_outbox WHERE id IN/.test(sql)) return [table.filter((r) => params.includes(r.id))];
  if (/^UPDATE email_outbox SET status = 'sending'/.test(sql)) { table.filter((r) => params.includes(r.id)).forEach((r) => { r.status = 'sending'; r.attempts = Number(r.attempts) + 1; }); }
  if (/^UPDATE email_outbox SET status = 'sent'/.test(sql)) { const r = table.find((x) => x.id === params[2]); if (r) r.status = 'sent'; }
  if (/^UPDATE email_outbox SET status = \?/.test(sql)) { const r = table.find((x) => x.id === params[2]); if (r) { r.status = params[0]; r.last_error = params[1]; } }
  return [{ affectedRows: 0 }];
};
let notReady: string | null = null;
let outcome: { status: 'delivered' | 'simulated' | 'failed'; message: string } = { status: 'delivered', message: 'ok' };
const mailed: Row[] = [];
const { runOutboxRound } = await import('./outboxRound');
const deps = {
  query: query as never,
  transaction: async <T,>(work: (c: { query: never }) => Promise<T>) => work({ query: query as never }),
  notReady: async () => notReady,
  send: async (p: Row) => { mailed.push(p); return { ...outcome, ccCount: 1, bccCount: 2 }; },
  brandLogo: async () => null,
};
const processOutbox = () => runOutboxRound(deps as never);
const mail = (id: number, attempts = 0): Row => ({ id, status: 'pending', attempts, to_email: `p${id}@wii.gov.in`, to_name: null, cc: 'rm@wii.gov.in', subject: 's', body_html: '<p>x</p>', body_text: 'x', category: 'NOTIFICATION', event: 'LEAVE_APPLIED', reference_id: '9', with_logo: 0 });

beforeEach(() => { table = []; statements.length = 0; mailed.length = 0; notReady = null; outcome = { status: 'delivered', message: 'ok' }; });

describe('background sender', () => {
  test('sends what is waiting and marks it sent', async () => {
    table = [mail(1), mail(2)];
    expect(await processOutbox()).toBe(2);
    expect(table.map((r) => r.status)).toEqual(['sent', 'sent']);
    expect(mailed[0]).toMatchObject({ to: 'p1@wii.gov.in', cc: ['rm@wii.gov.in'], eventType: 'LEAVE_APPLIED' });
  });

  test('a server whose settings do not work leaves the mails for another', async () => {
    notReady = 'No SMTP server is configured.';
    table = [mail(1)];
    expect(await processOutbox()).toBe(0);
    expect(table[0].status).toBe('pending');
    expect(mailed).toHaveLength(0);
  });

  test('a passing failure is tried again later', async () => {
    outcome = { status: 'failed', message: 'Email could not be sent: connect ETIMEDOUT' };
    table = [mail(1)];
    await processOutbox();
    expect(table[0].status).toBe('pending');
    expect(statements.some((s) => /INTERVAL 1 MINUTE/.test(s.sql))).toBe(true);
  });

  test('a rejected address is not retried', async () => {
    outcome = { status: 'failed', message: 'Email could not be sent: 550 5.1.1 Recipient address rejected' };
    table = [mail(1)];
    await processOutbox();
    expect(table[0].status).toBe('failed');
  });

  test('after the last try it is failed', async () => {
    outcome = { status: 'failed', message: 'Email could not be sent: 421 try later' };
    table = [mail(1, 4)];
    await processOutbox();
    expect(table[0].status).toBe('failed');
  });

  test('stuck and day-old mails are tidied before sending', async () => {
    await processOutbox();
    expect(statements[0].sql).toContain("status = 'sending' AND locked_at <");
    expect(statements[1].sql).toContain("SET status = 'not_sent'");
  });
});
