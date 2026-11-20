import { mysqlTable, varchar, text, longtext, timestamp, boolean, int, decimal, bigint, uniqueIndex, date, json, datetime, time, index, foreignKey } from 'drizzle-orm/mysql-core';

// Legacy tables (sessions, profile_master_records and the three old master audit-log tables) are no longer
// used; migrations/20261212_retire_legacy_tables.sql renames them. Do not run `drizzle-kit push` on the live database.

export const users = mysqlTable('users', {
  // ORM mapping only: the existing MySQL table is not modified by this declaration.
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  validUpto: date('valid_upto', { mode: 'string' }),
  lastUpdatedBy: varchar('last_updated_by', { length: 20 }),
  lastUpdatedAt: timestamp('last_updated_at'),
  lastUpdateSummary: text('last_update_summary'),
  /** 1 = must set their own password before using the portal (new account or admin reset). */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  /** 1 = fixed system account (Administrator / Auditor): never edited, deleted or listed outside the Profiles table. */
  isSystem: boolean('is_system').notNull().default(false),
  passwordChangedAt: timestamp('password_changed_at'),
});

export const user_module_roles = mysqlTable('user_module_roles', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull(),
  moduleId: varchar('module_id', { length: 80 }).notNull(),
  roleId: varchar('role_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastUpdated: timestamp('last_updated').defaultNow().onUpdateNow(),
  lastUpdatedBy: varchar('last_updated_by', { length: 4 }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
}, (table) => ({
  assignmentUnique: uniqueIndex('user_module_role_biometric_unique').on(table.biometricId, table.moduleId, table.roleId),
}));

// Immutable audit trail for permanent user-account deletion. Kept separate from users
// so the deletion event survives after the account row is removed.
export const user_account_audit_logs = mysqlTable('user_account_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  targetBiometricId: varchar('target_biometric_id', { length: 4 }).notNull(),
  targetName: varchar('target_name', { length: 255 }).notNull(),
  targetEmail: varchar('target_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  reason: text('reason'),
  reference: varchar('reference', { length: 255 }),
  deletedBy: varchar('deleted_by', { length: 4 }).notNull(),
  deletedAt: timestamp('deleted_at').defaultNow().notNull(),
});

export const employee_profiles = mysqlTable('employee_profiles', {
  // ORM mapping only; uses the existing biometric_id key, not a user_id relationship.
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull().unique(),
  suffix: varchar('suffix', { length: 10 }),
  /** Generated (read only): org_unit_name or project_name. */
  department: varchar('department', { length: 255 }),
  /** Generated (read only): designation_name. */
  designation: varchar('designation', { length: 255 }),
  employmentType: varchar('employment_type', { length: 50 }),
  joiningDate: date('joining_date', { mode: 'string' }),
  phone: varchar('phone', { length: 20 }),
  officeLocation: varchar('office_location', { length: 255 }),
  /** Institute code (lookup 'institute'): WII, SACON, … */
  institute: varchar('institute', { length: 50 }),
  shiftId: bigint('shift_id', { mode: 'number', unsigned: true }),
  // One column per profile field (migrations/20261219_04_employee_profile.sql; server/employees/profileSql.ts).
  gender: varchar('gender', { length: 50 }),
  dob: date('dob', { mode: 'string' }),
  bloodGroup: varchar('blood_group', { length: 3 }),
  leaveGroup: varchar('leave_group', { length: 20 }),
  employeeCategory: varchar('employee_category', { length: 100 }),
  permanentEmploymentType: varchar('permanent_employment_type', { length: 20 }),
  reportingManagerId: bigint('reporting_manager_id', { mode: 'number', unsigned: true }),
  reviewingManagerId: bigint('reviewing_manager_id', { mode: 'number', unsigned: true }),
  isOnProbation: boolean('is_on_probation').notNull().default(false),
  probationEndDate: date('probation_end_date', { mode: 'string' }),
  isPwd: boolean('is_pwd').notNull().default(false),
  isPhdEnrolled: boolean('is_phd_enrolled').notNull().default(false),
  /** Only when typed in: a researcher's PI otherwise is the reporting manager (worked out when reading). */
  piName: varchar('pi_name', { length: 255 }),
  guideSupervisor: varchar('guide_supervisor', { length: 255 }),
  /** Department / project: one of the two (department is generated from them). */
  orgUnitName: varchar('org_unit_name', { length: 255 }),
  projectName: varchar('project_name', { length: 255 }),
  designationName: varchar('designation_name', { length: 255 }),
  trainingCourseName: varchar('training_course_name', { length: 255 }),
  mscStreamName: varchar('msc_stream_name', { length: 255 }),
  traineeBatchName: varchar('trainee_batch_name', { length: 255 }),
  mscBatchName: varchar('msc_batch_name', { length: 255 }),
  phdEnrollmentName: varchar('phd_enrollment_name', { length: 255 }),
  statusChangeReason: varchar('status_change_reason', { length: 500 }),
  statusEffectiveDate: date('status_effective_date', { mode: 'string' }),
  statusChangedBy: varchar('status_changed_by', { length: 4 }),
}, (t) => ({
  byReportingManager: index('idx_profiles_reporting_manager').on(t.reportingManagerId),
  byReviewingManager: index('idx_profiles_reviewing_manager').on(t.reviewingManagerId),
  byLeaveGroup: index('idx_profiles_leave_group').on(t.leaveGroup),
}));

/** Aadhaar (encrypted, keyed hash for uniqueness, last 4 digits) and PAN: one row per employee. */
export const employee_identity = mysqlTable('employee_identity', {
  biometricId: varchar('biometric_id', { length: 4 }).primaryKey(),
  aadhaarEnc: varchar('aadhaar_enc', { length: 255 }),
  aadhaarHash: varchar('aadhaar_hash', { length: 64 }).unique('uq_identity_aadhaar_hash'),
  aadhaarLast4: varchar('aadhaar_last4', { length: 4 }),
  pan: varchar('pan', { length: 10 }).unique('uq_identity_pan'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  employee: foreignKey({ name: 'fk_identity_employee', columns: [t.biometricId], foreignColumns: [employee_profiles.biometricId] })
    .onDelete('cascade').onUpdate('cascade'),
}));

/** Bank accounts of an employee (account number encrypted, keyed hash unique within a bank). One primary today. */
export const employee_bank_accounts = mysqlTable('employee_bank_accounts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  ifsc: varchar('ifsc', { length: 11 }).notNull(),
  accountEnc: varchar('account_enc', { length: 255 }).notNull(),
  accountHash: varchar('account_hash', { length: 64 }).notNull().unique('uq_bank_account_hash'),
  accountLast4: varchar('account_last4', { length: 4 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => ({
  byEmployee: index('idx_bank_accounts_employee').on(t.biometricId),
  employee: foreignKey({ name: 'fk_bank_account_employee', columns: [t.biometricId], foreignColumns: [employee_profiles.biometricId] })
    .onDelete('cascade').onUpdate('cascade'),
}));

export const shifts = mysqlTable('shifts', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  gracePeriodMins: int('grace_period_mins').default(0),
  halfDayHours: decimal('half_day_hours', { precision: 3, scale: 1 }),
  fullDayHours: decimal('full_day_hours', { precision: 3, scale: 1 }),
  isDefault: boolean('is_default').default(false),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  halfDayCutoffTime: varchar('half_day_cutoff_time', { length: 10 }),
  description: text('description'),
});

// Working days of a shift, one row per day (Sun … Sat).
export const shift_days = mysqlTable('shift_days', {
  shiftId: bigint('shift_id', { mode: 'number', unsigned: true }).notNull(),
  day: varchar('day', { length: 3 }).notNull(),
});

// Biometric device registry. Device ID, short name and serial number are unique.
export const biometric_machines = mysqlTable('biometric_machines', {
  rowId: bigint('row_id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  id: varchar('machine_id', { length: 64 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 80 }).notNull().unique(),
  serialNumber: varchar('serial_number', { length: 120 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  purpose: varchar('purpose', { length: 24 }).notNull().default('ATTENDANCE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// One active organization record (id = 'default'). Logo is stored as a validated data URL.
export const organization_settings = mysqlTable('organization_settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  orgName: varchar('org_name', { length: 255 }).notNull(),
  logoData: longtext('logo_data'),
  address: text('address'),
  copyrightText: varchar('copyright_text', { length: 500 }),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Shared organization units used by HRMS Profile Master.
export const organization_units = mysqlTable('organization_units', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  type: varchar('type', { length: 50 }).notNull().default('Department'),
  /** Institute code (lookup 'institute'). */
  institute: varchar('institute', { length: 50 }),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

/** Dedicated database tables for each Profile Master. */
export const designations = mysqlTable('designations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  employeeTypeCode: varchar('employee_type_code', { length: 50 }), cadreCode: varchar('cadre_code', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const msc_streams = mysqlTable('msc_streams', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const msc_batches = mysqlTable('msc_batches', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  mscStreamName: varchar('msc_stream_name', { length: 255 }), validity: varchar('validity', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const training_courses = mysqlTable('training_courses', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const trainee_batches = mysqlTable('trainee_batches', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  trainingCourseName: varchar('training_course_name', { length: 255 }), validity: varchar('validity', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const projects = mysqlTable('projects', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  piName: varchar('pi_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const categories = mysqlTable('categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  cadreGroupCode: varchar('cadre_group_code', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const phd_enrollments = mysqlTable('phd_enrollments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  fundingCategoryCode: varchar('funding_category_code', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const user_project_histories = mysqlTable('user_histories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull(),
  projectName: varchar('project_name', { length: 255 }).notNull(),
  projectCode: varchar('project_code', { length: 100 }),
  piName: varchar('pi_name', { length: 255 }),
  piEmail: varchar('pi_email', { length: 255 }),
  roleInProject: varchar('role_in_project', { length: 255 }),
  pay: varchar('pay', { length: 255 }),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  isOngoing: boolean('is_ongoing').notNull().default(false),
  department: varchar('department', { length: 255 }),
  fundingAgency: varchar('funding_agency', { length: 255 }),
  grantAmount: varchar('grant_amount', { length: 255 }),
  responsibilities: longtext('responsibilities'),
  remarks: longtext('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Unified audit trail for every master (migrations/20261029_master_settings.sql).
export const master_audit_logs = mysqlTable('master_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  masterKey: varchar('master_key', { length: 40 }).notNull(),
  recordId: varchar('record_id', { length: 64 }).notNull(),
  recordLabel: varchar('record_label', { length: 255 }),
  action: varchar('action', { length: 16 }).notNull(),
  changedFields: text('changed_fields'),
  beforeData: longtext('before_data'),
  afterData: longtext('after_data'),
  reason: varchar('reason', { length: 500 }),
  actorBiometricId: varchar('actor_biometric_id', { length: 4 }),
  actorName: varchar('actor_name', { length: 255 }),
  actorRole: varchar('actor_role', { length: 32 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { fsp: 3, mode: 'string' }).defaultNow(),
  legacyRef: varchar('legacy_ref', { length: 64 }),
});

// Short admin-managed dropdown lists, one table each (server/lib/lookups.ts; migrations/20261219_02_list_tables.sql).
export const salutations = mysqlTable('salutations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const genders = mysqlTable('genders', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const institutes = mysqlTable('institutes', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const employee_types = mysqlTable('employee_types', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  formLayout: varchar('form_layout', { length: 32 }).notNull().default('permanent'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const org_unit_types = mysqlTable('org_unit_types', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const cadre_groups = mysqlTable('cadre_groups', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
export const funding_categories = mysqlTable('funding_categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: datetime('created_at', { fsp: 3, mode: 'string' }),
  updatedAt: datetime('updated_at', { fsp: 3, mode: 'string' }),
});
// Cadres (Scientific, Technical, …): fixed in the code (server/employees/lists.ts), kept here for the foreign keys.
export const cadres = mysqlTable('cadres', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
});

// Organization-wide CC / BCC copies for notification emails (migrations/20261029_notification_recipients.sql).
export const notification_recipients = mysqlTable('notification_recipients', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  recipientType: varchar('recipient_type', { length: 3 }).notNull(),
  scope: varchar('scope', { length: 16 }).notNull().default('ALL'),
  email: varchar('email', { length: 254 }).notNull(),
  name: varchar('name', { length: 255 }),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { fsp: 3, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3, mode: 'string' }).defaultNow().onUpdateNow(),
});

// Email sender + SMTP server (migrations/20261029_email_settings.sql). Single row 'default'.
export const email_settings = mysqlTable('email_settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  fromName: varchar('from_name', { length: 255 }).notNull(),
  fromEmail: varchar('from_email', { length: 254 }).notNull(),
  replyTo: varchar('reply_to', { length: 254 }),
  smtpHost: varchar('smtp_host', { length: 255 }).notNull(),
  smtpPort: int('smtp_port').notNull().default(587),
  smtpSecurity: varchar('smtp_security', { length: 10 }).notNull().default('starttls'),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPasswordEnc: text('smtp_password_enc'),
  updatedAt: timestamp('updated_at', { fsp: 3, mode: 'string' }).defaultNow().onUpdateNow(),
});

/** Default password for new employees (bcrypt hash only). One row, id = 'default'. */
export const account_settings = mysqlTable('account_settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  defaultPasswordHash: varchar('default_password_hash', { length: 255 }),
  updatedBy: varchar('updated_by', { length: 4 }),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Biometric punch log, filled by the machine software (parallel export). The portal only reads it.
// Column names follow the export format (migrations/20261030_attendance_logs.sql).
export const attendance_punches = mysqlTable('Attendance', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  employeeCode: varchar('EmployeeCode', { length: 50 }).notNull(),
  logDateTime: datetime('LogDateTime', { fsp: 6 }).notNull(),
  logDate: date('LogDate').notNull(),
  logTime: time('LogTime', { fsp: 6 }),
  direction: varchar('Direction', { length: 20 }),
  deviceName: varchar('DeviceName', { length: 150 }),
  deviceSr: varchar('DeviceSR', { length: 120 }),
  deviceId: varchar('DeviceId', { length: 50 }),
}, (t) => ({
  byDateEmp: index('idx_atten_date_emp').on(t.logDate, t.employeeCode),
  byEmpDate: index('idx_atten_emp_date').on(t.employeeCode, t.logDate),
}));

// Manual attendance requests (missed / wrong punches); approved ones count on the Attendance page.
export const manual_attendance_requests = mysqlTable('manual_attendance_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  attDate: date('att_date').notNull(),
  inTime: varchar('in_time', { length: 5 }).notNull(),
  outTime: varchar('out_time', { length: 5 }).notNull(),
  originalIn: varchar('original_in', { length: 5 }),
  originalOut: varchar('original_out', { length: 5 }),
  category: varchar('category', { length: 40 }).notNull(),
  reason: varchar('reason', { length: 500 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  appliedBy: bigint('applied_by', { mode: 'number', unsigned: true }).notNull(),
  managerId: bigint('manager_id', { mode: 'number', unsigned: true }),
  actionBy: bigint('action_by', { mode: 'number', unsigned: true }),
  actionAt: datetime('action_at', { fsp: 3 }),
  managerComment: varchar('manager_comment', { length: 500 }),
  undoCount: int('undo_count').notNull().default(0),
  createdAt: datetime('created_at', { fsp: 3 }),
  updatedAt: datetime('updated_at', { fsp: 3 }),
});

// Outdoor duty (OD) requests; approved ones show as OD on the Attendance page.
export const outdoor_duty_requests = mysqlTable('outdoor_duty_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  daysCount: int('days_count').notNull(),
  odType: varchar('od_type', { length: 16 }).notNull(),
  location: varchar('location', { length: 200 }).notNull(),
  estimatedFunds: decimal('estimated_funds', { precision: 12, scale: 2 }).notNull().default('0'),
  fundingSource: varchar('funding_source', { length: 100 }),
  purpose: varchar('purpose', { length: 1000 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  appliedBy: bigint('applied_by', { mode: 'number', unsigned: true }).notNull(),
  managerId: bigint('manager_id', { mode: 'number', unsigned: true }),
  actionBy: bigint('action_by', { mode: 'number', unsigned: true }),
  actionAt: datetime('action_at', { fsp: 3 }),
  managerComment: varchar('manager_comment', { length: 500 }),
  undoCount: int('undo_count').notNull().default(0),
  createdAt: datetime('created_at', { fsp: 3 }),
  updatedAt: datetime('updated_at', { fsp: 3 }),
});
