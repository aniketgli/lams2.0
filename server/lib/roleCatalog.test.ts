import { describe, expect, test } from 'bun:test';
import { BUILT_IN_CATALOG, catalogFromRows, findRole, resolveGrant, validateGrants } from './roleCatalog';
import { ROLE_ALIASES_FOR_TEST, ROLE_IDS } from './roles';

const catalog = BUILT_IN_CATALOG;

describe('role catalog', () => {
  test('a role is found by id, name or alias, in any spelling', () => {
    expect(findRole(catalog, 'hrms', 'administrator')?.name).toBe('Administrator');
    expect(findRole(catalog, 'lams', 'hrms_admin')?.roleId).toBe('administrator');
    expect(findRole(catalog, 'hrms', 'Leave Balance Manager')?.accessRole).toBe('leave_balance_manager');
    expect(findRole(catalog, 'pms', 'Co-PI')?.roleId).toBe('pms_co_pi');
    expect(findRole(catalog, 'pms', 'PMS Admin')?.roleId).toBe('pms_admin');
    expect(findRole(catalog, 'pms', 'Project PI')?.roleId).toBe('pms_pi');
  });

  test('every HRMS spelling the server accepted before still resolves to the same role', () => {
    for (const [alias, role] of Object.entries(ROLE_ALIASES_FOR_TEST)) {
      expect(resolveGrant(catalog, 'hrms', alias)?.role).toBe(role);
    }
  });

  test('a role of another module, an unknown role or an unknown module gives nothing', () => {
    expect(findRole(catalog, 'hrms', 'pms_admin')).toBeNull();
    expect(findRole(catalog, 'hrms', 'Super User')).toBeNull();
    expect(findRole(catalog, 'nomodule', 'administrator')).toBeNull();
    expect(resolveGrant(catalog, 'hrms', '')).toBeNull();
  });

  test('a role switched off in the catalog gives nothing', () => {
    const without = catalog.filter((r) => !(r.moduleId === 'hrms' && r.roleId === 'leave_balance_manager'));
    expect(resolveGrant(without, 'hrms', 'Leave Balance Manager')).toBeNull();
  });

  test('assignments are checked against the catalog and stored under the catalog name', () => {
    expect(validateGrants(catalog, [
      { moduleId: 'hrms', roleId: 'hrms_admin' },
      { moduleId: 'hrms', roleId: 'Administrator' },
      { moduleId: 'pms', roleId: 'Co-PI' },
    ])).toEqual([
      { moduleId: 'hrms', roleId: 'Administrator' },
      { moduleId: 'pms', roleId: 'Co-Principal Investigator (Co-PI)' },
    ]);
    expect(() => validateGrants(catalog, [{ moduleId: 'hrms', roleId: 'Super User' }, { moduleId: 'hrms', roleId: 'User' }]))
      .toThrow('hrms: Super User');
  });

  test('rows from the table: unknown module or access role are left out', () => {
    const list = catalogFromRows([
      { module_id: 'hrms', role_id: 'x', name: 'X', access_role: 'administrator', aliases: '', description: '', sort_order: 1 },
      { module_id: 'hrms', role_id: 'y', name: 'Y', access_role: 'superuser' },
      { module_id: 'nomodule', role_id: 'z', name: 'Z', access_role: 'audit' },
    ]);
    expect(list.map((r) => r.roleId)).toEqual(['x']);
  });

  test('the built-in list matches the migration', async () => {
    const sql = await Bun.file(new URL('../../migrations/20261203_role_catalog.sql', import.meta.url)).text();
    for (const r of catalog) {
      expect(ROLE_IDS).toContain(r.accessRole);
      expect(sql).toContain(`('${r.moduleId}', '${r.roleId}', '${r.name.replace(/'/g, "''")}', '${r.accessRole}', '${r.aliases.replace(/'/g, "''")}'`);
    }
    expect((sql.match(/^\s+\('/gm) ?? []).length).toBe(catalog.length);
  });
});
