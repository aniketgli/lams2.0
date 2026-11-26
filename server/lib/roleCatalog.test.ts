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
    // PMS has no HoD; its role pms_pi is the PI (migrations/20261231_pms_pi_project_workspace.sql).
    expect(findRole(catalog, 'pms', 'HoD')).toBeNull();
    expect(findRole(catalog, 'pms', 'Project PI')?.accessRole).toBe('project_pi');
    expect(findRole(catalog, 'pms', 'Principal Investigator (PI)')?.roleId).toBe('pms_pi');
    expect(findRole(catalog, 'hrms', 'PI')).toBeNull();
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
      { moduleId: 'pms', roleId: 'Reporting Manager' },
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
    // Roles added after the aliases moved to their own table (role_aliases).
    const later = await Bun.file(new URL('../../migrations/20261225_hrms_pms_split.sql', import.meta.url)).text();
    const added = catalog.filter((r) => later.includes(`('${r.moduleId}', '${r.roleId}', '${r.name}', '${r.accessRole}'`));
    expect(added.length).toBe(3);
    const likeHrms = await Bun.file(new URL('../../migrations/20261227_pms_roles_like_hrms.sql', import.meta.url)).text();
    const renamed = ['pms_admin', 'pms_co_pi', 'pms_researcher'];
    const piMigration = await Bun.file(new URL('../../migrations/20261231_pms_pi_project_workspace.sql', import.meta.url)).text();
    for (const r of catalog) {
      expect(ROLE_IDS).toContain(r.accessRole);
      if (added.includes(r)) {
        for (const alias of r.aliases.split(',')) expect(later).toContain(`('${r.moduleId}', '${r.roleId}', '${alias}')`);
      } else if (r.roleId === 'pms_pi') {
        // migrations/20261231_pms_pi_project_workspace.sql: the PMS PI, with its own access.
        expect(piMigration).toContain(`SET name = '${r.name}', access_role = '${r.accessRole}', is_active = 1`);
        expect(sql).toContain(`('pms', 'pms_pi', '`);
      } else if (renamed.includes(r.roleId)) {
        // migrations/20261227_pms_roles_like_hrms.sql: the PMS roles carry the HRMS names and access.
        expect(likeHrms).toContain(`UPDATE role_catalog SET name = '${r.name}', access_role = '${r.accessRole}',`);
        expect(likeHrms).toContain(`WHERE module_id = 'pms' AND role_id = '${r.roleId}';`);
        const hrms = catalog.find((h) => h.moduleId === 'hrms' && h.name === r.name);
        expect(hrms?.accessRole).toBe(r.accessRole);
        expect(sql).toContain(`('pms', '${r.roleId}', '`);
      } else {
        expect(sql).toContain(`('${r.moduleId}', '${r.roleId}', '${r.name.replace(/'/g, "''")}', '${r.accessRole}', '${r.aliases.replace(/'/g, "''")}'`);
      }
    }
    // The PMS HoD (pms_pi) was switched off (20261230) and comes back as the PI (20261231).
    const noHod = await Bun.file(new URL('../../migrations/20261230_pms_no_hod.sql', import.meta.url)).text();
    expect(noHod).toContain("UPDATE role_catalog SET is_active = 0 WHERE module_id = 'pms' AND role_id = 'pms_pi';");
    expect((sql.match(/^\s+\('/gm) ?? []).length).toBe(catalog.length - added.length);
  });
});
