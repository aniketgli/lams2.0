import { describe, expect, test } from 'bun:test';
import { parseLogFilter, parseReplace, parseTransfer } from './mappingRules';

const TODAY = '2026-11-02';
const fieldsOf = (fn: () => unknown) => {
  try { fn(); return null; } catch (e) { return (e as { details?: Record<string, string> }).details ?? {}; }
};

describe('parseTransfer', () => {
  test('accepts a department change for several people and de-duplicates ids', () => {
    const r = parseTransfer({ userIds: ['3', 2, '3'], department: ' Ecology ', effectiveDate: '2026-11-01', notes: ' order 4 ' }, TODAY);
    expect(r.userIds).toEqual([2, 3]);
    expect(r.department).toBe('Ecology');
    expect(r.notes).toBe('order 4');
  });
  test('needs at least one change', () => {
    expect(fieldsOf(() => parseTransfer({ userIds: [1], effectiveDate: TODAY }, TODAY))?.department).toBeTruthy();
  });
  test('needs employees', () => {
    expect(fieldsOf(() => parseTransfer({ department: 'X', effectiveDate: TODAY }, TODAY))?.userIds).toBeTruthy();
  });
  test('rejects a future effective date and bad ids', () => {
    expect(fieldsOf(() => parseTransfer({ userIds: [1], department: 'X', effectiveDate: '2026-11-03' }, TODAY))?.effectiveDate).toBeTruthy();
    expect(fieldsOf(() => parseTransfer({ userIds: ['1; DROP'], department: 'X', effectiveDate: TODAY }, TODAY))?.userIds).toBeTruthy();
    expect(fieldsOf(() => parseTransfer({ userIds: [1], reportingManagerId: 'abc', effectiveDate: TODAY }, TODAY))?.reportingManagerId).toBeTruthy();
  });
  test('caps the size of an order', () => {
    const ids = Array.from({ length: 201 }, (_, i) => i + 1);
    expect(fieldsOf(() => parseTransfer({ userIds: ids, department: 'X', effectiveDate: TODAY }, TODAY))?.userIds).toBeTruthy();
  });
});

describe('parseReplace', () => {
  test('valid order', () => {
    const r = parseReplace({ outgoingManagerId: '5', incomingManagerId: '6', scope: 'both', effectiveDate: TODAY }, TODAY);
    expect(r).toMatchObject({ outgoingManagerId: 5, incomingManagerId: 6, scope: 'both', userIds: [] });
  });
  test('managers must differ and scope must be known', () => {
    expect(fieldsOf(() => parseReplace({ outgoingManagerId: 5, incomingManagerId: 5, scope: 'both', effectiveDate: TODAY }, TODAY))?.incomingManagerId).toBeTruthy();
    expect(fieldsOf(() => parseReplace({ outgoingManagerId: 5, incomingManagerId: 6, scope: 'all', effectiveDate: TODAY }, TODAY))?.scope).toBeTruthy();
  });
  test('both managers are required', () => {
    const f = fieldsOf(() => parseReplace({ scope: 'reporting', effectiveDate: TODAY }, TODAY));
    expect(f?.outgoingManagerId).toBeTruthy();
    expect(f?.incomingManagerId).toBeTruthy();
  });
});

describe('parseLogFilter', () => {
  test('reads filters and rejects bad ones', () => {
    expect(parseLogFilter({ kind: 'transfer', search: ' ab ', from: '2026-01-01', to: '2026-02-01' })).toMatchObject({ kind: 'transfer', search: 'ab' });
    expect(fieldsOf(() => parseLogFilter({ kind: 'x' }))?.kind).toBeTruthy();
    expect(fieldsOf(() => parseLogFilter({ from: '2026-03-01', to: '2026-02-01' }))?.to).toBeTruthy();
  });
});
