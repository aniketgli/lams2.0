/**
 * Database health check — run it against a copy / staging database before going live:
 *
 *     npm run db:check
 *
 * It only READS (and takes row locks inside transactions it rolls back), so it is safe on real data.
 * Every check prints PASS / WARN / FAIL; the process exits 1 if anything FAILED.
 *
 * What it covers
 *   1. Connection, MySQL version and connection limits against the app's pool size
 *   2. Required tables, columns and indexes (so a missed migration is named explicitly)
 *   3. The generated manager columns really match the manager ids inside profile_data
 *   4. EXPLAIN of the hot queries: each must use an index instead of scanning the whole table
 *   5. Timing of the heavy reads (a year of one person's punches, a month of everyone's)
 *   6. Row-lock behaviour that stops a double submit (two sessions locking the same employee)
 */
import 'dotenv/config';
import { databaseTarget, type DatabaseTarget } from '../src/db/connection';
import mysql from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';

type Level = 'PASS' | 'WARN' | 'FAIL';
let failed = 0;
const report = (level: Level, name: string, detail = ''): void => {
  if (level === 'FAIL') failed += 1;
  console.log(`${level.padEnd(4)}  ${name}${detail ? ` — ${detail}` : ''}`);
};

let target: DatabaseTarget;
try { target = databaseTarget(); } catch (error) { console.error((error as Error).message); process.exit(2); }

const rows = async (c: Connection, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> => (await c.query<RowDataPacket[]>(sql, params))[0];
const one = async (c: Connection, sql: string, params: unknown[] = []): Promise<RowDataPacket | undefined> => (await rows(c, sql, params))[0];

/** Tables / columns the application cannot run without. */
const REQUIRED: Record<string, string[]> = {
  users: ['id', 'biometric_id', 'status', 'valid_upto', 'is_system', 'must_change_password'],
  employee_profiles: ['biometric_id', 'profile_data', 'joining_date', 'shift_id', 'reporting_manager_id', 'reviewing_manager_id'],
  user_module_roles: ['biometric_id', 'module_id', 'role_id', 'status'],
  web_sessions: ['sid'],
  leave_requests: ['user_id', 'start_date', 'end_date', 'status'],
  outdoor_duty_requests: ['user_id', 'start_date', 'end_date', 'status'],
  manual_attendance_requests: ['user_id', 'att_date', 'status'],
  biometric_machines: ['serial_number', 'short_name', 'status', 'purpose'],
  Attendance: ['EmployeeCode', 'LogDate', 'LogDateTime', 'DeviceSR'],
  // Notification emails: queue, retries and log (migrations/20261202_email_outbox.sql). Without it mails are sent at once, with no retry.
  email_outbox: ['status', 'next_attempt_at', 'queued_at', 'body_html'],
  // The latest columns for leave purposes / paternity details (20261130_scl_paternity.sql).
  leave_types: ['purposes'],
  // Roles that can be given and used (20261203_role_catalog.sql). Without it the built-in list is used.
  role_catalog: ['module_id', 'role_id', 'name', 'access_role', 'aliases', 'is_active'],
};

/** Indexes that keep the hot queries fast: table -> index name. */
const REQUIRED_INDEXES: Array<[string, string]> = [
  ['employee_profiles', 'idx_profiles_reporting_manager'],
  ['employee_profiles', 'idx_profiles_reviewing_manager'],
  ['Attendance', 'idx_atten_cover'],
];

async function main(): Promise<void> {
  const c = await mysql.createConnection({ ...target, multipleStatements: false });
  try {
    // 1. Connection and limits ------------------------------------------------------------------
    const v = await one(c, 'SELECT VERSION() AS v, DATABASE() AS db');
    report('PASS', 'Connected', `${v?.db} on MySQL ${v?.v}`);
    const maxConn = Number((await one(c, "SHOW VARIABLES LIKE 'max_connections'"))?.Value ?? 0);
    const pool = Number(process.env.DB_POOL_SIZE || 40);
    if (maxConn && maxConn < pool * 2) report('WARN', 'max_connections', `${maxConn} is low for a pool of ${pool} per process; raise it (and count every server process)`);
    else report('PASS', 'max_connections', `${maxConn} (pool ${pool} per process)`);
    const bufferMb = Math.round(Number((await one(c, "SHOW VARIABLES LIKE 'innodb_buffer_pool_size'"))?.Value ?? 0) / 1048576);
    report(bufferMb >= 512 ? 'PASS' : 'WARN', 'innodb_buffer_pool_size', `${bufferMb} MB${bufferMb >= 512 ? '' : ' (small; the attendance table should fit in memory)'}`);

    // 2. Schema ----------------------------------------------------------------------------------
    for (const [table, columns] of Object.entries(REQUIRED)) {
      const found = await rows(c, 'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
      if (!found.length) { report('FAIL', `Table ${table}`, 'missing — run the migrations'); continue; }
      const have = new Set(found.map((r) => String(r.name).toLowerCase()));
      const missing = columns.filter((col) => !have.has(col.toLowerCase()));
      if (missing.length) report('FAIL', `Table ${table}`, `missing column(s): ${missing.join(', ')}`);
      else report('PASS', `Table ${table}`);
    }
    for (const [table, index] of REQUIRED_INDEXES) {
      const found = await one(c, 'SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [table, index]);
      report(Number(found?.n) > 0 ? 'PASS' : 'FAIL', `Index ${table}.${index}`, Number(found?.n) > 0 ? '' : 'missing — run migrations/20261129_scale_indexes.sql');
    }

    // 3. Generated manager columns match the JSON -----------------------------------------------
    try {
      const bad = await one(c, `
        SELECT COUNT(*) AS n FROM employee_profiles
         WHERE JSON_VALID(profile_data)
           AND NOT (reporting_manager_id <=> CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reportingManagerId')), 'null') AS UNSIGNED))`);
      report(Number(bad?.n) === 0 ? 'PASS' : 'FAIL', 'reporting_manager_id matches profile_data', `${bad?.n} mismatching profile(s)`);
      const invalid = await one(c, 'SELECT COUNT(*) AS n FROM employee_profiles WHERE NOT JSON_VALID(profile_data)');
      report(Number(invalid?.n) === 0 ? 'PASS' : 'WARN', 'profile_data is valid JSON everywhere', `${invalid?.n} invalid`);
    } catch (e) { report('FAIL', 'Generated manager columns', (e as Error).message); }

    // 3b. Every active role grant names a role of the role catalog (otherwise it gives no access) ----
    try {
      const { catalogFromRows, BUILT_IN_CATALOG, findRole } = await import('../server/lib/roleCatalog');
      const fromTable = await rows(c, 'SELECT module_id, role_id, name, access_role, aliases, description, sort_order FROM role_catalog WHERE is_active = 1').catch(() => null);
      const catalog = fromTable ? catalogFromRows(fromTable) : BUILT_IN_CATALOG;
      const grants = await rows(c, "SELECT biometric_id, module_id, role_id FROM user_module_roles WHERE LOWER(status) = 'active'");
      const orphans = grants.filter((g) => !findRole(catalog, g.module_id, g.role_id));
      report(orphans.length ? 'WARN' : 'PASS', 'Role grants match the role catalog',
        orphans.length ? `${orphans.length} grant(s) give no access: ${orphans.slice(0, 10).map((g) => `${g.biometric_id} ${g.module_id}/${g.role_id}`).join(', ')}` : `${grants.length} grant(s)`);
    } catch (e) { report('FAIL', 'Role grants match the role catalog', (e as Error).message); }

    // 4. EXPLAIN: hot queries must use an index ---------------------------------------------------
    const sample = await one(c, 'SELECT id, biometric_id FROM users WHERE is_system = 0 ORDER BY id LIMIT 1');
    const uid = sample?.id ?? 0;
    const code = sample?.biometric_id ?? '';
    const hot: Array<[string, string, unknown[]]> = [
      ['Team of a manager', 'SELECT u.id FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE p.reporting_manager_id = ? OR p.reviewing_manager_id = ?', [uid, uid]],
      ['One person\'s punches for a year', 'SELECT LogDateTime, DeviceSR FROM `Attendance` WHERE EmployeeCode = ? AND LogDate BETWEEN ? AND ?', [code, '2026-01-01', '2026-12-31']],
      ['Everyone\'s punches for a month', 'SELECT EmployeeCode, LogDateTime, DeviceSR FROM `Attendance` WHERE LogDate BETWEEN ? AND ?', ['2026-10-01', '2026-10-31']],
      ['Leave of one person', 'SELECT id FROM leave_requests WHERE user_id = ? AND status <> \'rejected\' AND start_date <= ? AND end_date >= ?', [uid, '2026-12-31', '2026-01-01']],
      ['Outdoor duty of one person', 'SELECT id FROM outdoor_duty_requests WHERE user_id = ? AND start_date <= ? AND end_date >= ?', [uid, '2026-12-31', '2026-01-01']],
      ['Manual attendance of one person', 'SELECT id FROM manual_attendance_requests WHERE user_id = ? AND att_date = ?', [uid, '2026-10-01']],
      ['Roles of one person', 'SELECT module_id, role_id FROM user_module_roles WHERE biometric_id = ? AND status = \'active\'', [code]],
    ];
    for (const [name, sql, params] of hot) {
      try {
        const plan = await rows(c, `EXPLAIN ${sql}`, params);
        const scans = plan.filter((p) => p.type === 'ALL' && Number(p.rows) > 1000);
        if (scans.length) report('WARN', `Plan: ${name}`, `full scan of ${scans.map((p) => `${p.table} (~${p.rows} rows)`).join(', ')}`);
        else report('PASS', `Plan: ${name}`, plan.map((p) => `${p.table}:${p.key ?? 'no key'}`).join(', '));
      } catch (e) { report('FAIL', `Plan: ${name}`, (e as Error).message); }
    }

    // 5. Timing of heavy reads --------------------------------------------------------------------
    const timed = async (name: string, sql: string, params: unknown[], limitMs: number): Promise<void> => {
      const t = Date.now();
      try {
        const found = await rows(c, sql, params);
        const ms = Date.now() - t;
        report(ms <= limitMs ? 'PASS' : 'WARN', `Time: ${name}`, `${found.length.toLocaleString('en-IN')} row(s) in ${ms} ms (target ≤ ${limitMs} ms)`);
      } catch (e) { report('FAIL', `Time: ${name}`, (e as Error).message); }
    };
    await timed('one person, a year of punches', hot[1][1], hot[1][2], 300);
    await timed('everyone, a month of punches', hot[2][1], hot[2][2], 3000);
    await timed('team lookup', hot[0][1], hot[0][2], 100);

    // 6. Double-submit lock: a second session must wait for the first ----------------------------
    if (uid) {
      const a = await mysql.createConnection({ ...target });
      const b = await mysql.createConnection({ ...target });
      try {
        await a.query('SET SESSION innodb_lock_wait_timeout = 2');
        await b.query('SET SESSION innodb_lock_wait_timeout = 2');
        await a.beginTransaction();
        await a.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]);
        await b.beginTransaction();
        let waited = false;
        try { await b.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]); } catch (e) { waited = (e as { code?: string }).code === 'ER_LOCK_WAIT_TIMEOUT'; }
        report(waited ? 'PASS' : 'FAIL', 'Employee row lock serialises two submits', waited ? 'second session had to wait' : 'second session was not blocked');
      } finally {
        await a.rollback().catch(() => undefined); await b.rollback().catch(() => undefined);
        await a.end(); await b.end();
      }
    }
  } finally {
    await c.end();
  }
  console.log(failed ? `\n${failed} check(s) FAILED.` : '\nNo failures.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('db-check crashed:', e); process.exit(2); });
