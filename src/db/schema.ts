import { mysqlTable, varchar, text, longtext, timestamp, boolean, int, decimal, bigint, uniqueIndex, date, json, datetime, time, index } from 'drizzle-orm/mysql-core';

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

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  expires: timestamp('expires').notNull(),
  data: text('data'),
});

export const employee_profiles = mysqlTable('employee_profiles', {
  // ORM mapping only; uses the existing biometric_id key, not a user_id relationship.
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  biometricId: varchar('biometric_id', { length: 4 }).notNull().unique(),
  suffix: varchar('suffix', { length: 10 }),
  department: varchar('department', { length: 255 }),
  designation: varchar('designation', { length: 255 }),
  employmentType: varchar('employment_type', { length: 50 }),
  joiningDate: varchar('joining_date', { length: 10 }),
  phone: varchar('phone', { length: 20 }),
  officeLocation: varchar('office_location', { length: 255 }),
  /** Institute code (lookup 'institute'): WII, SACON, … */
  institute: varchar('institute', { length: 50 }),
  shiftId: varchar('shift_id', { length: 36 }),
  profileData: text('profile_data'),
});

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
  applicableDays: json('applicable_days').$type<string[]>(),
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



// Immutable audit trail for biometric machine master changes.
export const biometric_machine_audit_logs = mysqlTable('biometric_machine_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  machineId: varchar('machine_id', { length: 64 }).notNull(),
  action: varchar('action', { length: 16 }).notNull(),
  changedByBiometricId: varchar('changed_by_biometric_id', { length: 4 }),
  changedByName: varchar('changed_by_name', { length: 255 }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
  beforeData: longtext('before_data'),
  afterData: longtext('after_data'),
  reason: text('reason'),
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
  /** JSON text: which employee types / cadres the unit is offered for (empty = all). */
  metadata: longtext('metadata'),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Audit history for Organization Profile Master create, update and delete actions.
export const organization_unit_audit_logs = mysqlTable('organization_unit_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  organizationId: bigint('organization_id', { mode: 'number', unsigned: true }).notNull(),
  organizationName: varchar('organization_name', { length: 255 }).notNull(),
  organizationCode: varchar('organization_code', { length: 80 }),
  action: varchar('action', { length: 16 }).notNull(),
  changedByBiometricId: varchar('changed_by_biometric_id', { length: 4 }),
  changedByName: varchar('changed_by_name', { length: 255 }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
  beforeData: longtext('before_data'),
  afterData: longtext('after_data'),
});

export const profile_master_records = mysqlTable('profile_master_records', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  masterKey: varchar('master_key', { length: 40 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 100 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({ masterCodeUnique: uniqueIndex('profile_master_key_code_unique').on(table.masterKey, table.code) }));

/** Dedicated database tables for each Profile Master. */
export const designations = mysqlTable('designations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const msc_streams = mysqlTable('msc_streams', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const msc_batches = mysqlTable('msc_batches', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const training_courses = mysqlTable('training_courses', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const trainee_batches = mysqlTable('trainee_batches', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const projects = mysqlTable('projects', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const categories = mysqlTable('categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
  createdAt: timestamp('created_at').defaultNow(), updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
export const phd_enrollments = mysqlTable('phd_enrollments', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), code: varchar('code', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'), metadata: longtext('metadata'),
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


/** Audit trail for Shift Master create/update/status/default/delete actions. */
export const shift_master_audit_logs = mysqlTable('shift_master_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  shiftId: bigint('shift_id', { mode: 'number', unsigned: true }).notNull(),
  shiftCode: varchar('shift_code', { length: 50 }).notNull(),
  action: varchar('action', { length: 24 }).notNull(),
  changedByBiometricId: varchar('changed_by_biometric_id', { length: 4 }),
  changedByName: varchar('changed_by_name', { length: 255 }),
  changedAt: timestamp('changed_at').defaultNow(),
  reason: text('reason'),
  beforeData: longtext('before_data'),
  afterData: longtext('after_data'),
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

// Short admin-managed dropdown lists (salutation, gender, employee type, ...).
export const lookup_values = mysqlTable('lookup_values', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  lookupType: varchar('lookup_type', { length: 40 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  metadata: longtext('metadata'),
  createdAt: timestamp('created_at', { fsp: 3, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3, mode: 'string' }).defaultNow().onUpdateNow(),
});

// Organization-wide CC / BCC copies for notification emails (migrations/20261029_notification_recipients.sql).
export const notification_recipients = mysqlTable('notification_recipients', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  recipientType: varchar('recipient_type', { length: 3 }).notNull(),
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
