/**
 * Functional check of the screens whose data moved into normalized tables (migrations/20261219_*):
 * masters (per-list tables, real columns), employee profile (columns, derived values), shifts (shift_days),
 * leave types (employee types / purposes tables), report schedules (send_csv / send_pdf) and role aliases.
 *
 * Only for the throw-away CI server and database (.github/workflows/security.yml), after seed.ts and
 * scripts/sql/ci/legacy_sample.sql:
 *     SECURITY_TEST_URL=http://127.0.0.1:3000 bun scripts/security/normalized_flows.ts
 * Exit code 1 when any check fails.
 */
/** Session cookie name (server/lib/http.ts). */
const SID = (process.env.SESSION_COOKIE_NAME || '').trim() || 'lams2.sid';
const BASE = (process.env.SECURITY_TEST_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: only a local test server is allowed.`);
  process.exit(2);
}
const PASSWORD = process.env.SECURITY_TEST_PASSWORD || 'Test@12345';

let failed = 0;
function check(title: string, ok: boolean, detail = ''): void {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? ` — ${detail}` : ''}`);
}

let cookie = '';
async function req(method: string, path: string, body?: unknown): Promise<{ status: number; body: any; text: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const c of (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const pair = c.split(';')[0];
    if (pair.startsWith(`${SID}=`)) cookie = pair;
  }
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  return { status: res.status, body: parsed, text };
}

/** A 12-digit number that passes the Aadhaar check digit (Verhoeff). */
function aadhaarFrom(prefix11: string): string {
  const D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
  const P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];
  for (let d = 0; d <= 9; d++) {
    const s = prefix11 + d;
    let c = 0;
    s.split('').reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
    if (c === 0) return s;
  }
  throw new Error('no check digit');
}

const profileOf = (record: any): Record<string, any> => { try { return JSON.parse(record?.profileData || '{}'); } catch { return {}; } };

async function main(): Promise<void> {
  const login = await req('POST', '/api/auth/login', { email: 'admin@wii.gov.in', password: PASSWORD });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${login.text}`);
  await req('POST', '/api/access/module', { moduleId: 'hrms' });
  const role = await req('POST', '/api/access/active-role', { moduleId: 'hrms', role: 'Administrator' });
  if (role.status !== 200) throw new Error(`role failed: ${role.status} ${role.text}`);

  // ---- Masters ------------------------------------------------------------------------------
  const types = await req('GET', '/api/hrms/masters/employeeType');
  const permanent = (types.body?.records ?? []).find((r: any) => r.code === 'permanent');
  check('Employee types come from employee_types with their form layout', permanent?.fields?.formLayout === 'permanent', JSON.stringify(permanent ?? types.text).slice(0, 160));

  const desig = await req('POST', '/api/hrms/masters/designations', { name: 'CI Scientist', code: 'CISCI', status: 'ACTIVE', fields: { empType: 'permanent', cadre: 'Scientific' } });
  check('Designation saved with employee type and cadre columns', desig.status === 201 && desig.body?.record?.fields?.empType === 'permanent' && desig.body?.record?.fields?.cadre === 'Scientific', `${desig.status} ${desig.text.slice(0, 200)}`);
  const plain = await req('POST', '/api/hrms/masters/designations', { name: 'CI Any Type', code: 'CIANY', status: 'ACTIVE', fields: { empType: '', cadre: '' } });
  check('Designation without employee type stores NULL (no foreign key error)', plain.status === 201 && plain.body?.record?.fields?.empType === '', `${plain.status} ${plain.text.slice(0, 200)}`);
  const badType = await req('POST', '/api/hrms/masters/designations', { name: 'CI Bad', code: 'CIBAD', status: 'ACTIVE', fields: { empType: 'nope' } });
  check('Designation with an unknown employee type is refused', badType.status === 400, String(badType.status));

  const batches = await req('GET', '/api/hrms/masters/mscBatches');
  const ws = (batches.body?.records ?? []).find((r: any) => r.name === 'WS 2026');
  check('M.Sc batch reads its stream and validity from columns', ws?.fields?.parentStream === 'Wildlife Science' && ws?.fields?.validity === '2026-2028', JSON.stringify(ws ?? batches.text).slice(0, 160));
  const projects = await req('GET', '/api/hrms/masters/projects');
  const tiger = (projects.body?.records ?? []).find((r: any) => r.name === 'Tiger Project');
  check('Project reads its PI from pi_name', tiger?.fields?.pi === 'Dr. Stripes', JSON.stringify(tiger ?? projects.text).slice(0, 160));

  const sal = await req('POST', '/api/hrms/masters/salutation', { name: 'CI Shri', code: 'CI-SHRI', status: 'ACTIVE' });
  check('A new salutation goes into salutations (at the end of the list)', sal.status === 201 && Number(sal.body?.record?.sortOrder) > 0, `${sal.status} ${sal.text.slice(0, 200)}`);

  const used = (await req('GET', '/api/hrms/masters/designations')).body?.records?.find((r: any) => r.name === 'Technical Assistant');
  const rename = used ? await req('PUT', `/api/hrms/masters/designations/${used.id}`, { name: 'Tech Asst', code: used.code, status: used.status, fields: used.fields }) : { status: 0, text: 'missing' };
  check('A designation in use cannot be renamed', rename.status === 409, `${rename.status} ${String(rename.text).slice(0, 120)}`);
  const delUsed = used ? await req('DELETE', `/api/hrms/masters/designations/${used.id}`, { reason: 'ci' }) : { status: 0 };
  check('A designation in use cannot be deleted', delUsed.status === 409, String(delUsed.status));

  // Employee type code change reaches profiles, designations and leave rules (ON UPDATE CASCADE)
  const contractual = (types.body?.records ?? []).find((r: any) => r.code === 'contractual');
  if (contractual) {
    const moved = await req('PUT', `/api/hrms/masters/employeeType/${contractual.id}`, { name: contractual.name, code: 'contract', status: contractual.status, fields: contractual.fields });
    const lt = (await req('GET', '/api/hrms/leave-types')).body?.types?.find((t: any) => t.code === 'CISCL');
    check('Employee type code change cascades to leave rules', moved.status === 200 && (lt?.employeeTypes ?? []).includes('contract') && !(lt?.employeeTypes ?? []).includes('contractual'),
      `${moved.status} ${JSON.stringify(lt?.employeeTypes)} ${moved.status === 200 ? '' : moved.text.slice(0, 160)}`);
    await req('PUT', `/api/hrms/masters/employeeType/${contractual.id}`, { name: contractual.name, code: 'contractual', status: contractual.status, fields: contractual.fields });
  } else check('Employee type contractual present', false);

  // ---- Shifts -------------------------------------------------------------------------------
  const shift = await req('POST', '/api/hrms/shifts', { code: 'CIALT', name: 'CI Alternate', startTime: '07:00', endTime: '15:00', gracePeriodMins: 5, halfDayHours: 4, fullDayHours: 8, applicableDays: ['Wed', 'Mon'], isDefault: false, status: 'active' });
  check('Shift saved with its working days (shift_days)', shift.status === 201 && JSON.stringify(shift.body?.applicableDays) === '["Mon","Wed"]', `${shift.status} ${shift.text.slice(0, 200)}`);
  if (shift.body?.id) {
    const upd = await req('PUT', `/api/hrms/shifts/${shift.body.id}`, { ...shift.body, applicableDays: ['Sat'] });
    check('Shift working days change', upd.status === 200 && JSON.stringify(upd.body?.applicableDays) === '["Sat"]', `${upd.status} ${upd.text.slice(0, 160)}`);
    const del = await req('DELETE', `/api/hrms/shifts/${shift.body.id}`, { reason: 'ci' });
    check('Unused shift deleted (its days go with it)', del.status === 200, String(del.status));
  }
  const list = await req('GET', '/api/hrms/shifts');
  const ci = (list.body ?? []).find((s: any) => s.code === 'CIGEN');
  const none = (list.body ?? []).find((s: any) => s.code === 'CINIL');
  check('Shift days copied from the old JSON; a shift without days got Mon–Fri', JSON.stringify(ci?.applicableDays) === '["Mon","Tue","Wed","Thu","Fri"]' && JSON.stringify(none?.applicableDays) === '["Mon","Tue","Wed","Thu","Fri"]',
    `${JSON.stringify(ci?.applicableDays)} / ${JSON.stringify(none?.applicableDays)}`);

  // ---- Leave types ----------------------------------------------------------------------------
  const lt = (await req('GET', '/api/hrms/leave-types')).body?.types?.find((t: any) => t.code === 'CISCL');
  check('Leave type reads employee types and purposes from their tables', JSON.stringify(lt?.employeeTypes) === '["contractual","permanent"]' || JSON.stringify(lt?.employeeTypes) === '["permanent","contractual"]', JSON.stringify(lt?.employeeTypes));
  check('Leave type purposes kept in order, without repeats', JSON.stringify(lt?.purposes) === '["Sports","Blood donation"]', JSON.stringify(lt?.purposes));
  if (lt) {
    // contractual keeps its own quota row, so it stays in the list (an app rule)
    const put = await req('PUT', `/api/hrms/leave-types/${lt.id}`, { ...lt, employeeTypes: ['contractual', 'permanent', 'msc'], purposes: ['Sports', 'Chess'], reason: 'ci' });
    const after = (await req('GET', '/api/hrms/leave-types')).body?.types?.find((t: any) => t.code === 'CISCL');
    check('Leave type lists saved', put.status === 200 && [...(after?.employeeTypes ?? [])].sort().join(',') === 'contractual,msc,permanent' && JSON.stringify(after?.purposes) === '["Sports","Chess"]',
      `${put.status} ${put.status === 200 ? JSON.stringify([after?.employeeTypes, after?.purposes]) : put.text.slice(0, 200)}`);
  }

  // ---- Report schedules -----------------------------------------------------------------------
  const sched = await req('GET', '/api/hrms/reports/schedules');
  const old = (sched.body?.schedules ?? []).find((s: any) => s.name === 'CI report');
  check('Report formats read from send_csv / send_pdf', JSON.stringify(old?.formats) === '["csv","pdf"]', JSON.stringify(old?.formats ?? sched.text.slice(0, 160)));
  const me = (await req('GET', '/api/auth/me')).body;
  const adminId = Number(me?.user?.id ?? me?.id ?? 0);
  const made = await req('POST', '/api/hrms/reports/schedules', { name: 'CI pdf only', reportKey: 'attendance', frequency: 'daily', sendTime: '07:45', formats: ['pdf'], userIds: [adminId], roles: [], status: 'active' });
  check('Report schedule saved with one format', made.status === 201 && JSON.stringify(made.body?.schedule?.formats) === '["pdf"]', `${made.status} ${made.text.slice(0, 200)}`);

  // ---- Role aliases ---------------------------------------------------------------------------
  const cat = await req('GET', '/api/access/role-catalog');
  const text = JSON.stringify(cat.body ?? {});
  check('Role catalog loads (aliases from role_aliases)', cat.status === 200 && text.includes('administrator'), String(cat.status));

  // ---- Legacy employees: values worked out when reading ---------------------------------------
  const all = (await req('GET', '/api/hrms/employees')).body ?? [];
  const byBio = (b: string) => all.find((e: any) => e.biometricId === b);
  const e1 = byBio('2001'); const e2 = byBio('2002'); const e3 = byBio('2003');
  const p1 = profileOf(e1); const p2 = profileOf(e2); const p3 = profileOf(e3);
  check('Permanent employee: department, designation and superannuation date', e1?.department === 'IT Cell' && e1?.designation === 'Technical Assistant' && p1.retirementDate === '2050-05-31' && !p1.validUntilDate,
    JSON.stringify({ d: e1?.department, g: e1?.designation, r: p1.retirementDate, v: p1.validUntilDate }));
  check('Permanent employee: HoD name and leave year from other tables', p1.hodName === 'Legacy Researcher' && p1.leaveCycle === 'CY' && p1.isPwd === true, JSON.stringify({ h: p1.hodName, c: p1.leaveCycle, pwd: p1.isPwd }));
  check('Researcher: project, typed PI kept, valid until from the account', e2?.department === 'Tiger Project' && p2.piName === 'Dr. Typed PI' && p2.validUntilDate === '2027-03-31',
    JSON.stringify({ d: e2?.department, pi: p2.piName, v: p2.validUntilDate }));
  check('M.Sc student: stream and batch', p3.courseProgram === 'Wildlife Science' && p3.courseBatch === 'WS 2026', JSON.stringify({ c: p3.courseProgram, b: p3.courseBatch }));

  // ---- New employee: create, update, read back ------------------------------------------------
  const shifts = (await req('GET', '/api/hrms/shifts')).body ?? [];
  const shiftId = String(shifts.find((s: any) => s.code === 'CIGEN')?.id ?? '');
  const rmId = String(byBio('1002')?.id ?? '');
  const hodId = String(byBio('1003')?.id ?? '');
  const body = {
    biometricId: '3001', suffix: 'Dr.', name: 'CI New Scientist', email: 'ci.new@wii.gov.in', gender: 'Female', dob: '1985-01-01', phone: '9876500001',
    employmentType: 'permanent', shiftId, leaveGroup: 'CIPS', joiningDate: '2015-07-01', institute: 'WII', department: 'IT Cell', designation: 'CI Scientist',
    employeeCategory: 'Scientific', permanentEmploymentType: 'Direct', reportingManagerId: rmId, reviewingManagerId: hodId, isPwd: false, isOnProbation: false,
    aadhaarNumber: aadhaarFrom('23456789012'), panNumber: 'ABCDE9876K', bankName: 'State Bank of India', bankIfsc: 'SBIN0001234', bankAccountNumber: '123456789012', bloodGroup: 'O+',
  };
  const created = await req('POST', '/api/hrms/employees', body);
  const rec = created.body?.employee;
  const pc = profileOf(rec);
  check('New permanent employee saved into the columns', created.status === 201 && rec?.department === 'IT Cell' && rec?.designation === 'CI Scientist' && pc.retirementDate === '2044-12-31' && pc.leaveCycle === 'CY',
    `${created.status} ${created.status === 201 ? JSON.stringify({ d: rec?.department, g: rec?.designation, r: pc.retirementDate }) : created.text.slice(0, 300)}`);
  if (rec?.id) {
    const updated = await req('PUT', `/api/hrms/employees/${rec.id}`, { ...body, designation: 'CI Any Type', bloodGroup: 'A+' });
    const pu = profileOf(updated.body?.employee);
    check('Employee update changes designation and blood group', updated.status === 200 && updated.body?.employee?.designation === 'CI Any Type' && pu.bloodGroup === 'A+' && (updated.body?.changed ?? []).length > 0,
      `${updated.status} ${updated.status === 200 ? JSON.stringify(updated.body?.changed) : updated.text.slice(0, 300)}`);
    const same = await req('PUT', `/api/hrms/employees/${rec.id}`, { ...body, designation: 'CI Any Type', bloodGroup: 'A+' });
    check('Saving again without changes writes nothing', same.status === 200 && (same.body?.changed ?? ['x']).length === 0, `${same.status} ${JSON.stringify(same.body?.changed)}`);
  }
  const researcher = await req('POST', '/api/hrms/employees', {
    ...body, biometricId: '3002', name: 'CI New Fellow', email: 'ci.fellow@wii.gov.in', phone: '9876500002', employmentType: 'project', department: 'Tiger Project', designation: 'CI Any Type',
    employeeCategory: undefined, permanentEmploymentType: undefined, reviewingManagerId: undefined, validUntilDate: '2027-12-31', piName: '',
    aadhaarNumber: aadhaarFrom('34567890123'), panNumber: 'ABCDE9877K', bankAccountNumber: '223456789012',
  });
  const pr = profileOf(researcher.body?.employee);
  check('New researcher: project stored, PI defaults to the reporting manager, valid until from the account', researcher.status === 201 && researcher.body?.employee?.department === 'Tiger Project' && pr.piName === 'QA Manager' && pr.validUntilDate === '2027-12-31',
    `${researcher.status} ${researcher.status === 201 ? JSON.stringify({ d: researcher.body?.employee?.department, pi: pr.piName, v: pr.validUntilDate }) : researcher.text.slice(0, 300)}`);

  // ---- No Dues (leave clearance) for a leaving project employee: worked out, then issued (audit log) -------------
  const fellowId = researcher.body?.employee?.id;
  if (fellowId) {
    const nd = await req('GET', `/api/hrms/leave/no-dues?userId=${fellowId}&relievingDate=2027-06-15`);
    check('No Dues: clearance of a project employee is worked out per leave type', nd.status === 200 && Array.isArray(nd.body?.rows) && typeof nd.body?.totalExcess === 'number' && nd.body?.relievingDate === '2027-06-15',
      `${nd.status} ${nd.text.slice(0, 200)}`);
    check('No Dues: entitled never above credited, excess never negative', (nd.body?.rows ?? []).every((r: any) => r.entitled <= r.credited && r.excess >= 0), JSON.stringify(nd.body?.rows ?? []).slice(0, 200));
    const badDate = await req('GET', `/api/hrms/leave/no-dues?userId=${fellowId}&relievingDate=2027-02-30`);
    check('No Dues: an invalid relieving date is refused', badDate.status === 400, String(badDate.status));
    const issued = await req('POST', '/api/hrms/leave/no-dues', { userId: fellowId, relievingDate: '2027-06-15' });
    check('No Dues: issuing records the clearance', issued.status === 200 && typeof issued.body?.issuedAt === 'string', `${issued.status} ${issued.text.slice(0, 160)}`);
  } else check('No Dues: project employee for the clearance check', false);
  const permId = created.body?.employee?.id;
  if (permId) {
    const perm = await req('GET', `/api/hrms/leave/no-dues?userId=${permId}&relievingDate=2027-06-15`);
    check('No Dues: refused for a permanent employee (not pro-rata)', perm.status === 400, String(perm.status));
  }
  const dup = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3003', email: 'ci.dup@wii.gov.in', phone: '9876500003', panNumber: 'ABCDE9878K', bankAccountNumber: '323456789012' });
  check('The same Aadhaar for a second employee is refused', dup.status === 409, `${dup.status} ${dup.text.slice(0, 160)}`);

  // Unknown master values are refused by the form checks (and by the foreign keys underneath)
  const badDesig = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3004', email: 'ci.bad@wii.gov.in', phone: '9876500004', designation: 'No Such Post', aadhaarNumber: aadhaarFrom('45678901234'), panNumber: 'ABCDE9879K', bankAccountNumber: '423456789012' });
  check('An unknown designation is refused with 400', badDesig.status === 400, String(badDesig.status));

  // ---- Reporting manager / HoD must hold that role --------------------------------------------
  const staffId = String(byBio('1004')?.id ?? '');
  const noRoleRm = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3006', email: 'ci.rm@wii.gov.in', phone: '9876500006', reportingManagerId: staffId, aadhaarNumber: aadhaarFrom('67890123456'), panNumber: 'ABCDE9881K', bankAccountNumber: '623456789012' });
  check('A reporting manager without the Reporting Manager role is refused', noRoleRm.status === 400 && /Reporting Manager role/.test(String(noRoleRm.body?.details?.reportingManagerId)), `${noRoleRm.status} ${JSON.stringify(noRoleRm.body?.details ?? {}).slice(0, 160)}`);
  const noRoleHod = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3007', email: 'ci.hod@wii.gov.in', phone: '9876500007', reviewingManagerId: rmId, aadhaarNumber: aadhaarFrom('78901234567'), panNumber: 'ABCDE9882K', bankAccountNumber: '723456789012' });
  check('An HoD without the HoD role is refused', noRoleHod.status === 400 && /HoD role/.test(String(noRoleHod.body?.details?.reviewingManagerId)), `${noRoleHod.status} ${JSON.stringify(noRoleHod.body?.details ?? {}).slice(0, 160)}`);

  // ---- Aadhaar is optional for now (AADHAAR_REQUIRED = false) -----------------------------------
  const noAadhaar = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3008', email: 'ci.noaadhaar@wii.gov.in', phone: '9876500008', aadhaarNumber: '', panNumber: 'ABCDE9883K', bankAccountNumber: '823456789012' });
  check('A new employee can be saved without Aadhaar', noAadhaar.status === 201, `${noAadhaar.status} ${noAadhaar.text.slice(0, 160)}`);
  const badAadhaar = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3009', email: 'ci.badaadhaar@wii.gov.in', phone: '9876500009', aadhaarNumber: '123412341234', panNumber: 'ABCDE9884K', bankAccountNumber: '923456789012' });
  check('An Aadhaar that is entered is still checked', badAadhaar.status === 400 && Boolean(badAadhaar.body?.details?.aadhaarNumber), String(badAadhaar.status));

  // ---- Deactivation: only a plain User account -------------------------------------------------
  const rmCheck = await req('GET', `/api/hrms/employees/${rmId}/deactivation-check`);
  check('A reporting manager cannot be deactivated (shown before the form)', rmCheck.status === 200 && rmCheck.body?.allowed === false && /role/i.test(String(rmCheck.body?.reason)), `${rmCheck.status} ${JSON.stringify(rmCheck.body)}`);
  const rmDeact = await req('PATCH', `/api/hrms/employees/${rmId}/status`, { status: 'inactive', reason: 'ci' });
  check('…and the deactivation itself is refused', rmDeact.status === 409, String(rmDeact.status));

  // ---- Mobile number is optional for now (MOBILE_REQUIRED = false) ------------------------------
  const noPhone = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3010', email: 'ci.nophone@wii.gov.in', phone: '', aadhaarNumber: '', panNumber: 'ABCDE9885K', bankAccountNumber: '1023456789012' });
  check('A new employee can be saved without a mobile number', noPhone.status === 201, `${noPhone.status} ${noPhone.text.slice(0, 160)}`);
  const noPhone2 = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3011', email: 'ci.nophone2@wii.gov.in', phone: '', aadhaarNumber: '', panNumber: 'ABCDE9886K', bankAccountNumber: '1123456789012' });
  check('…and so can a second one (no mobile is not a duplicate)', noPhone2.status === 201, `${noPhone2.status} ${noPhone2.text.slice(0, 160)}`);
  const badPhone = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3012', email: 'ci.badphone@wii.gov.in', phone: '12', aadhaarNumber: '', panNumber: 'ABCDE9887K', bankAccountNumber: '1223456789012' });
  check('A mobile number that is entered is still checked', badPhone.status === 400 && Boolean(badPhone.body?.details?.phone), String(badPhone.status));

  // ---- Biometric IDs with letters for an institute that allows them (SACON: SAC1001) ---------------
  {
    const inst = await req('POST', '/api/hrms/masters/institute', { name: 'CI SACON', code: 'CISACON', status: 'ACTIVE', fields: { biometricIdFormat: 'Letters and digits' } });
    check('An institute can allow letters in biometric IDs', inst.status === 201 && inst.body?.record?.fields?.biometricIdFormat === 'Letters and digits', `${inst.status} ${inst.text.slice(0, 160)}`);
    const unit = await req('POST', '/api/hrms/masters/organizations', { name: 'CI SACON Office', code: 'CISACOFF', status: 'ACTIVE', fields: { institute: 'CISACON', type: 'Department' } });
    check('…with an office of its own', unit.status === 201, `${unit.status} ${unit.text.slice(0, 160)}`);
    const sac = { ...body, institute: 'CISACON', department: 'CI SACON Office', reportingManagerId: '', reviewingManagerId: '', aadhaarNumber: '', phone: '' };
    // Reporting manager and HoD are WII employees: a manager may belong to another institute.
    const sacEmp = await req('POST', '/api/hrms/employees', { ...sac, biometricId: 'sac1001', email: 'ci.sac1001@wii.gov.in', panNumber: 'ABCDE9888K', bankAccountNumber: '1323456789012', reportingManagerId: rmId, reviewingManagerId: hodId });
    check('An employee of that institute (managers from WII) is saved with biometric ID SAC1001 (stored in capitals)', sacEmp.status === 201 && sacEmp.body?.employee?.biometricId === 'SAC1001', `${sacEmp.status} ${sacEmp.text.slice(0, 200)}`);
    const wiiLetters = await req('POST', '/api/hrms/employees', { ...body, biometricId: 'SAC1002', email: 'ci.sac1002@wii.gov.in', phone: '', aadhaarNumber: '', panNumber: 'ABCDE9889K', bankAccountNumber: '1423456789012' });
    check('A WII employee still needs a 4-digit biometric ID', wiiLetters.status === 400 && /4 digits/.test(String(wiiLetters.body?.details?.biometricId)), `${wiiLetters.status} ${JSON.stringify(wiiLetters.body?.details ?? {}).slice(0, 160)}`);
    const sacLogin = await fetch(`${BASE}/api/hrms/photos/SAC1001`, { headers: { Cookie: cookie } });
    check('Biometric-ID routes accept SAC1001', sacLogin.status === 404 || sacLogin.status === 200, String(sacLogin.status));
  }

  // ---- Banks master ----------------------------------------------------------------------------
  const bankList = await req('GET', '/api/hrms/masters/banks');
  check('Banks master lists the common banks', (bankList.body?.records ?? []).some((r: any) => r.name === 'State Bank of India' && r.code === 'SBIN'), String(bankList.status));
  const badBank = await req('POST', '/api/hrms/employees', { ...body, biometricId: '3005', email: 'ci.bank@wii.gov.in', phone: '9876500005', bankName: 'Not A Bank', aadhaarNumber: aadhaarFrom('56789012345'), panNumber: 'ABCDE9880K', bankAccountNumber: '523456789012' });
  check('A bank outside the master is refused', badBank.status === 400 && Boolean(badBank.body?.details?.bankName), `${badBank.status} ${JSON.stringify(badBank.body?.details ?? {}).slice(0, 120)}`);
  const sbi = (bankList.body?.records ?? []).find((r: any) => r.code === 'SBIN');
  const sbiDel = sbi ? await req('DELETE', `/api/hrms/masters/banks/${sbi.id}`, { reason: 'ci' }) : { status: 0 };
  check('A bank in use cannot be deleted', sbiDel.status === 409, String(sbiDel.status));

  // ---- A leftover second session cookie (another path / app) does not sign the user out ------------
  const goodCookie = cookie;
  cookie = `${SID}=s%3Aleftover.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA; ${goodCookie}`;
  const twoCookies = await req('GET', '/api/auth/me');
  cookie = goodCookie;
  check('With two session cookies the newest one is used', twoCookies.status === 200, String(twoCookies.status));
  cookie = `wii.sid=s%3Aold.AAAA; ${goodCookie}`;
  const oldName = await req('GET', '/api/auth/me');
  cookie = goodCookie;
  check('A cookie of the old name is ignored', oldName.status === 200, String(oldName.status));

  // ---- Forgot password (code by email) -----------------------------------------------------------
  {
    const target = 'ci.new@wii.gov.in'; // created above; not used by the security test
    const unknown = await req('POST', '/api/auth/forgot-password', { email: 'nobody.here@wii.gov.in' });
    const known = await req('POST', '/api/auth/forgot-password', { email: target });
    check('Forgot password answers the same for a known and an unknown email', unknown.status === 200 && known.status === 200 && unknown.body?.message === known.body?.message, `${unknown.status}/${known.status}`);
    // The CI database cannot read the email: put a known code in place of the one that was sent.
    const { createHmac } = await import('node:crypto');
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(String(process.env.DATABASE_URL));
    const setCode = async (code: string) => {
      const [[u]] = await conn.query<any[]>('SELECT id FROM users WHERE email = ?', [target]);
      const hash = createHmac('sha256', String(process.env.SESSION_SECRET)).update(`password-reset:${u.id}:${code}`).digest('hex');
      const [r] = await conn.query<any>('UPDATE password_reset_otps SET otp_hash = ? WHERE user_id = ?', [hash, u.id]);
      return Number(r.affectedRows);
    };
    check('A code was stored for the known email (hashed)', (await setCode('123456')) === 1);
    const wrong = await req('POST', '/api/auth/reset-password', { email: target, otp: '000000', newPassword: 'Forest#2026a', confirmPassword: 'Forest#2026a' });
    check('A wrong code is refused', wrong.status === 400 && wrong.body?.code === 'OTP_INVALID', String(wrong.status));
    const weak = await req('POST', '/api/auth/reset-password', { email: target, otp: '123456', newPassword: 'short', confirmPassword: 'short' });
    check('A weak new password is refused (the code stays usable)', weak.status === 400 && Boolean(weak.body?.details?.newPassword), String(weak.status));
    const ok = await req('POST', '/api/auth/reset-password', { email: target, otp: '123456', newPassword: 'Forest#2026a', confirmPassword: 'Forest#2026a' });
    check('The right code sets the new password', ok.status === 200, `${ok.status} ${ok.text.slice(0, 160)}`);
    const again = await req('POST', '/api/auth/reset-password', { email: target, otp: '123456', newPassword: 'Forest#2026b', confirmPassword: 'Forest#2026b' });
    check('A code works only once', again.status === 400, String(again.status));
    await req('POST', '/api/auth/forgot-password', { email: target });
    await setCode('654321');
    const reused = await req('POST', '/api/auth/reset-password', { email: target, otp: '654321', newPassword: 'Forest#2026a', confirmPassword: 'Forest#2026a' });
    check('The current / a previous password cannot be chosen again', reused.status === 400 && /not used before/.test(String(reused.body?.details?.newPassword)), `${reused.status} ${JSON.stringify(reused.body?.details)}`);
    let tries = 0;
    for (let i = 0; i < 5; i++) { const r = await req('POST', '/api/auth/reset-password', { email: target, otp: '111111', newPassword: 'Forest#2026c' }); if (r.status === 400) tries++; }
    const usedUp = await req('POST', '/api/auth/reset-password', { email: target, otp: '654321', newPassword: 'Forest#2026c', confirmPassword: 'Forest#2026c' });
    check('After 5 wrong tries the code is used up', tries === 5 && usedUp.status === 400 && usedUp.body?.code === 'OTP_INVALID', `${tries} / ${usedUp.status}`);
    // (A successful reset starts the count again: requests since then are the one above and these two.)
    await req('POST', '/api/auth/forgot-password', { email: target });
    await req('POST', '/api/auth/forgot-password', { email: target }); // third request: still allowed
    const fourth = await req('POST', '/api/auth/forgot-password', { email: target });
    check('At most 3 code requests per email in 15 minutes', fourth.status === 429, String(fourth.status));
    await conn.end();
  }

  // ---- Sign-out names the sign-in it means (a sleeping tab must not end a newer sign-in) ---------
  const first = (await req('GET', '/api/auth/me')).body?.sessionTag;
  const again = await req('POST', '/api/auth/login', { email: 'admin@wii.gov.in', password: PASSWORD });
  const second = again.body?.sessionTag;
  check('Every sign-in gets its own tag', typeof first === 'string' && typeof second === 'string' && first !== second, `${first} / ${second}`);
  const untagged = await req('POST', '/api/auth/logout', {});
  const stillAfterUntagged = await req('GET', '/api/auth/me');
  check('A sign-out that names no sign-in (an old version still open in a tab) keeps the current one', untagged.body?.kept === true && stillAfterUntagged.status === 200, `${JSON.stringify(untagged.body)} / me ${stillAfterUntagged.status}`);
  const stale = await req('POST', '/api/auth/logout', { sessionTag: first });
  const still = await req('GET', '/api/auth/me');
  check('Signing out an older sign-in keeps the newer one', stale.body?.kept === true && still.status === 200, `${stale.status} ${JSON.stringify(stale.body)} / me ${still.status}`);
  const own = await req('POST', '/api/auth/logout', { sessionTag: second });
  const gone = await req('GET', '/api/auth/me');
  check('Signing out this sign-in ends it', own.status === 200 && !own.body?.kept && gone.status === 401, `${own.status} / me ${gone.status}`);

  console.log(`\n${failed ? `${failed} check(s) failed.` : 'All normalized flows work.'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
