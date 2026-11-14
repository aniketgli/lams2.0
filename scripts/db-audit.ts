/**
 * Database audit: READ-ONLY. It changes nothing and is safe to run on the live database.
 *
 *     npm run db:audit
 *
 * It reports:
 *   1. Tables the application does not use (legacy or left over), with their row counts
 *   2. Tables without a primary key
 *   3. Data problems: orphan role grants, duplicate active grants, accounts without a profile,
 *      profiles without an account, requests of deleted users, manager links to missing users,
 *      duplicate emails / phones, expired accounts still marked active
 *   4. Fixed system accounts still on their default password
 * Every check prints PASS / WARN / FAIL; the process exits 1 if anything FAILED.
 *
 * Retiring the legacy tables found in (1) is done by migrations/20261212_retire_legacy_tables.sql,
 * which renames them (reversible) instead of dropping them.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { databaseTarget } from '../src/db/connection';

type Level = 'PASS' | 'WARN' | 'FAIL';
let failed = 0;
const report = (level: Level, name: string, detail = ''): void => {
  if (level === 'FAIL') failed += 1;
  console.log(`${level.padEnd(4)}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const rows = async (c: Connection, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> => (await c.query<RowDataPacket[]>(sql, params))[0];

/** Every table the server reads or writes (server/, scripts/, src/db/schema.ts, masters definitions). */
export const USED_TABLES = new Set([
  'users', 'employee_profiles', 'user_module_roles', 'role_catalog', 'web_sessions', 'employee_photos', 'user_histories',
  'user_account_audit_logs', 'employee_mapping_log', 'master_audit_logs', 'lookup_values', 'organization_units', 'organization_settings',
  'designations', 'categories', 'projects', 'training_courses', 'trainee_batches', 'msc_streams', 'msc_batches', 'phd_enrollments',
  'shifts', 'biometric_machines', 'holidays', 'Attendance', 'manual_attendance_requests', 'outdoor_duty_requests',
  'leave_types', 'leave_type_quotas', 'leave_groups', 'leave_group_types', 'leave_balances', 'leave_requests', 'leave_certificates',
  'leave_comp_off_uses', 'leave_joining_reports', 'leave_joining_certificates', 'email_settings', 'email_outbox',
  'notification_recipients', 'account_settings', 'report_schedules', 'report_schedule_recipients', 'report_runs',
]);

/** Old tables whose rows were copied forward by earlier migrations; nothing reads them any more. */
export const LEGACY_TABLES: Record<string, string> = {
  sessions: 'replaced by web_sessions (express-session store)',
  shift_master_audit_logs: 'copied into master_audit_logs (20261029_master_settings.sql)',
  biometric_machine_audit_logs: 'copied into master_audit_logs (20261029_master_settings.sql)',
  organization_unit_audit_logs: 'copied into master_audit_logs (20261029_master_settings.sql)',
  profile_master_records: 'copied into the dedicated master tables (0007_dedicated_profile_master_tables.sql)',
};

async function count(c: Connection, sql: string): Promise<number> {
  try {
    const [row] = await rows(c, sql);
    return Number(row?.n ?? 0);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return -1;
    throw error;
  }
}

async function check(c: Connection, name: string, sql: string, level: Level = 'WARN', hint = ''): Promise<void> {
  const n = await count(c, sql);
  if (n === -1) report('WARN', name, 'table or column missing, not checked');
  else if (n === 0) report('PASS', name);
  else report(level, name, `${n} row(s)${hint ? `. ${hint}` : ''}`);
}

async function main(): Promise<void> {
  const c = await mysql.createConnection({ ...databaseTarget(), multipleStatements: false });
  try {
    await c.query('SET SESSION TRANSACTION READ ONLY');

    // 1. Unused tables ------------------------------------------------------------------------
    const tables = await rows(c, `SELECT TABLE_NAME AS name, TABLE_ROWS AS approx, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1048576, 1) AS mb
                                    FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
    for (const t of tables) {
      const name = String(t.name);
      if (USED_TABLES.has(name)) continue;
      if (name.startsWith('zz_retired_')) { report('PASS', `Retired table ${name}`, 'renamed by the cleanup migration; drop it once you are sure'); continue; }
      const why = LEGACY_TABLES[name];
      report('WARN', `Unused table ${name}`, `~${t.approx} rows, ${t.mb} MB. ${why ?? 'not used by the application; check before retiring'}`);
    }

    // 2. Primary keys -------------------------------------------------------------------------
    const noPk = await rows(c, `SELECT t.TABLE_NAME AS name FROM information_schema.TABLES t
      LEFT JOIN information_schema.TABLE_CONSTRAINTS k ON k.TABLE_SCHEMA = t.TABLE_SCHEMA AND k.TABLE_NAME = t.TABLE_NAME AND k.CONSTRAINT_TYPE = 'PRIMARY KEY'
      WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE' AND k.CONSTRAINT_NAME IS NULL`);
    if (noPk.length) report('WARN', 'Tables without a primary key', noPk.map((r) => r.name).join(', '));
    else report('PASS', 'Every table has a primary key');

    // 3. Data integrity -----------------------------------------------------------------------
    await check(c, 'Role grants of unknown accounts',
      'SELECT COUNT(*) AS n FROM user_module_roles r LEFT JOIN users u ON u.biometric_id = r.biometric_id WHERE u.id IS NULL', 'WARN',
      'Grants left behind by deleted accounts.');
    await check(c, 'Duplicate active role grants',
      `SELECT COUNT(*) AS n FROM (SELECT biometric_id, module_id, role_id FROM user_module_roles WHERE LOWER(status) = 'active'
         GROUP BY biometric_id, module_id, role_id HAVING COUNT(*) > 1) d`);
    await check(c, 'Accounts without an employee profile',
      'SELECT COUNT(*) AS n FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE p.id IS NULL AND u.is_system = 0');
    await check(c, 'Profiles without an account',
      'SELECT COUNT(*) AS n FROM employee_profiles p LEFT JOIN users u ON u.biometric_id = p.biometric_id WHERE u.id IS NULL');
    for (const table of ['leave_requests', 'outdoor_duty_requests', 'manual_attendance_requests']) {
      await check(c, `${table} of missing accounts`,
        `SELECT COUNT(*) AS n FROM ${table} m LEFT JOIN users u ON u.id = m.user_id WHERE u.id IS NULL`);
    }
    await check(c, 'Reporting manager links to missing accounts',
      `SELECT COUNT(*) AS n FROM employee_profiles p LEFT JOIN users u ON u.id = p.reporting_manager_id
        WHERE p.reporting_manager_id IS NOT NULL AND u.id IS NULL`);
    await check(c, 'HoD links to missing accounts',
      `SELECT COUNT(*) AS n FROM employee_profiles p LEFT JOIN users u ON u.id = p.reviewing_manager_id
        WHERE p.reviewing_manager_id IS NOT NULL AND u.id IS NULL`);
    await check(c, 'Duplicate emails (case-insensitive)',
      'SELECT COUNT(*) AS n FROM (SELECT LOWER(TRIM(email)) e FROM users GROUP BY e HAVING COUNT(*) > 1) d', 'FAIL');
    await check(c, 'Duplicate mobile numbers',
      `SELECT COUNT(*) AS n FROM (SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) ph FROM employee_profiles
        WHERE phone IS NOT NULL AND phone <> '' GROUP BY ph HAVING COUNT(*) > 1) d`);
    await check(c, 'Accounts past their validity date but still active',
      "SELECT COUNT(*) AS n FROM users WHERE LOWER(status) = 'active' AND valid_upto IS NOT NULL AND valid_upto < CURDATE() AND is_system = 0", 'WARN',
      'The account-expiry job marks these at startup; sign-in already refuses them.');
    await check(c, 'Leave balances of missing accounts',
      'SELECT COUNT(*) AS n FROM leave_balances b LEFT JOIN users u ON u.id = b.user_id WHERE u.id IS NULL');

    // 4. Default passwords --------------------------------------------------------------------
    await check(c, 'System accounts still on their default password',
      'SELECT COUNT(*) AS n FROM users WHERE is_system = 1 AND must_change_password = 1', 'FAIL',
      'Sign in as erp@wii.gov.in / erpauditor@wii.gov.in and set a strong password now.');
    await check(c, 'Employees who have not replaced their default / temporary password',
      'SELECT COUNT(*) AS n FROM users WHERE is_system = 0 AND must_change_password = 1 AND LOWER(status) = \'active\'', 'WARN');
  } finally {
    await c.end();
  }
  console.log(failed ? `\n${failed} check(s) FAILED.` : '\nNo failures.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('db-audit crashed:', e); process.exit(2); });
