import { describe, expect, test } from 'bun:test';
import { hrmsRoleOf, hrmsViewerOf } from './hrmsViewer';
import { visibilityClause } from './visibility';

// A request as requireAuth leaves it: only `auth` matters here.
const req = (activeModule: string | null, activeRole: string | null) =>
  ({ auth: { account: { id: 42 }, grants: {}, activeModule, activeRole } }) as never;

describe('HRMS role is read only inside HRMS (cross-module privilege escalation)', () => {
  test('HRMS administrator keeps the administrator role', () => {
    expect(hrmsRoleOf(req('hrms', 'administrator'))).toBe('administrator');
    expect(hrmsViewerOf(req('hrms', 'audit'))).toEqual({ id: 42, role: 'audit' });
  });

  test('a PMS / Stock / Facility / Finance administrator is not an HRMS administrator', () => {
    for (const module of ['pms', 'stock', 'facility', 'finance']) {
      expect(hrmsRoleOf(req(module, 'administrator'))).toBeNull();
      // With no HRMS role the viewer sees only their own rows, never everyone's.
      expect(visibilityClause(hrmsViewerOf(req(module, 'administrator')))).toEqual({ sql: 'm.user_id = ?', params: [42] });
    }
  });

  test('another module\'s manager role does not open the HRMS team view', () => {
    expect(hrmsRoleOf(req('stock', 'reporting_manager'))).toBeNull();
    expect(hrmsRoleOf(req('pms', 'reviewing_manager'))).toBeNull();
  });

  test('lobby (no module) and signed-out requests have no role', () => {
    expect(hrmsRoleOf(req(null, null))).toBeNull();
    expect(hrmsRoleOf({} as never)).toBeNull();
  });
});

describe('HRMS route files read the role through hrmsViewerOf', () => {
  test('no HRMS route builds a viewer from the raw active role', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(import.meta.dir, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!name.endsWith('.routes.ts')) continue;
        if (/role:\s*req\.auth!?\??\.activeRole/.test(readFileSync(path, 'utf8'))) offenders.push(path.slice(root.length + 1));
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
