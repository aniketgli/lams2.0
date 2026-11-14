/**
 * Test accounts for the security test (scripts/security/pentest.ts). Runs ONLY against a throw-away
 * database: it refuses to run unless SECURITY_TEST_DB=1 and the database name ends in "_test".
 *
 *   1001 admin@wii.gov.in        HRMS Administrator + User
 *   1002 rm@wii.gov.in           Reporting Manager + User   (manager of 1004)
 *   1003 hod@wii.gov.in          HoD + User                 (HoD of 1004)
 *   1004 staff@wii.gov.in        User                       (reports to 1002, HoD 1003)
 *   1005 other@wii.gov.in        User                       (reports to 1006)
 *   1006 rm2@wii.gov.in          Reporting Manager + User
 *   1007 pmsadmin@wii.gov.in     PMS Administrator + HRMS User
 *   1008 audit@wii.gov.in        Auditor
 *   1009 inactive@wii.gov.in     User, inactive
 *   1010 expired@wii.gov.in      User, validity date in the past
 *   1011 balance@wii.gov.in      Leave Balance Manager + User
 * All have the password in SECURITY_TEST_PASSWORD (default Test@12345). The fixed system accounts 9001/9002
 * come from migrations/20261120_bootstrap_users.sql with their published default password.
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { databaseTarget } from '../../src/db/connection';

const target = databaseTarget();
if (process.env.SECURITY_TEST_DB !== '1' || !/_test$/.test(String(target.database))) {
  console.error('Refusing to seed: set SECURITY_TEST_DB=1 and use a database whose name ends in _test.');
  process.exit(2);
}

const PASSWORD = process.env.SECURITY_TEST_PASSWORD || 'Test@12345';

interface Person { bio: string; name: string; email: string; roles: Array<[string, string]>; rm?: string; hod?: string; status?: string; validUpto?: string }
const PEOPLE: Person[] = [
  { bio: '1001', name: 'QA Admin', email: 'admin@wii.gov.in', roles: [['hrms', 'Administrator'], ['hrms', 'User']] },
  { bio: '1002', name: 'QA Manager', email: 'rm@wii.gov.in', roles: [['hrms', 'Reporting Manager'], ['hrms', 'User']] },
  { bio: '1003', name: 'QA HoD', email: 'hod@wii.gov.in', roles: [['hrms', 'HoD'], ['hrms', 'User']] },
  { bio: '1004', name: 'QA Staff', email: 'staff@wii.gov.in', roles: [['hrms', 'User']], rm: '1002', hod: '1003' },
  { bio: '1005', name: 'QA Other', email: 'other@wii.gov.in', roles: [['hrms', 'User']], rm: '1006', hod: '1003' },
  { bio: '1006', name: 'QA Manager Two', email: 'rm2@wii.gov.in', roles: [['hrms', 'Reporting Manager'], ['hrms', 'User']] },
  { bio: '1007', name: 'QA PMS Admin', email: 'pmsadmin@wii.gov.in', roles: [['pms', 'PMS Administrator / Dean R&D'], ['hrms', 'User']], rm: '1006' },
  { bio: '1008', name: 'QA Auditor', email: 'audit@wii.gov.in', roles: [['hrms', 'Auditor']] },
  { bio: '1009', name: 'QA Inactive', email: 'inactive@wii.gov.in', roles: [['hrms', 'User']], status: 'inactive' },
  { bio: '1010', name: 'QA Expired', email: 'expired@wii.gov.in', roles: [['hrms', 'User']], validUpto: '2020-01-01' },
  { bio: '1011', name: 'QA Balance', email: 'balance@wii.gov.in', roles: [['hrms', 'Leave Balance Manager'], ['hrms', 'User']] },
];

async function main(): Promise<void> {
  const c = await mysql.createConnection(target);
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids = new Map<string, number>();
  for (const p of PEOPLE) {
    await c.query(
      `INSERT INTO users (biometric_id, name, email, password_hash, status, valid_upto, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [p.bio, p.name, p.email, hash, p.status ?? 'active', p.validUpto ?? null],
    );
    const [[row]] = await c.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE biometric_id = ?', [p.bio]);
    ids.set(p.bio, Number(row.id));
  }
  for (const p of PEOPLE) {
    const data = {
      gender: 'Male', reportingManagerId: p.rm ? String(ids.get(p.rm)) : '', reviewingManagerId: p.hod ? String(ids.get(p.hod)) : '',
    };
    await c.query(
      `INSERT INTO employee_profiles (biometric_id, suffix, department, designation, employment_type, joining_date, phone, institute, profile_data)
       VALUES (?, 'Mr.', 'QA', 'Tester', 'permanent', '2020-01-01', ?, 'WII', ?)`,
      [p.bio, `98${p.bio}00000`.slice(0, 10), JSON.stringify(data)],
    );
    for (const [moduleId, roleId] of p.roles) {
      await c.query("INSERT INTO user_module_roles (biometric_id, module_id, role_id, status, last_updated_by) VALUES (?, ?, ?, 'active', '1001')", [p.bio, moduleId, roleId]);
    }
  }
  await c.end();
  console.log(`Seeded ${PEOPLE.length} test accounts:`, Object.fromEntries(ids));
}

main().catch((e) => { console.error(e); process.exit(1); });
