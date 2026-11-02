import { describe, expect, test } from 'bun:test';
import { parseDownload } from './downloadRules';

const fields = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return (e as { details?: Record<string, string> }).details ?? {}; } };

describe('parseDownload', () => {
  test('accepts a known area and format', () => {
    expect(parseDownload({ area: 'attendance', format: 'csv', rows: 12, filters: ' Status: P ' })).toEqual({ area: 'attendance', format: 'csv', rows: 12, filters: 'Status: P' });
  });
  test('rejects unknown areas, formats and bad counts', () => {
    expect(fields(() => parseDownload({ area: 'payroll', format: 'csv', rows: 1 }))?.area).toBeTruthy();
    expect(fields(() => parseDownload({ area: 'attendance', format: 'xls', rows: 1 }))?.format).toBeTruthy();
    expect(fields(() => parseDownload({ area: 'attendance', format: 'csv', rows: -1 }))?.rows).toBeTruthy();
    expect(fields(() => parseDownload({ area: 'attendance', format: 'csv', rows: 'x' }))?.rows).toBeTruthy();
  });
});
