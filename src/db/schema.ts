import { mysqlTable, varchar, text, longtext, timestamp, boolean, int, decimal, bigint, uniqueIndex, date } from 'drizzle-orm/mysql-core';

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
  shiftId: varchar('shift_id', { length: 36 }),
  profileData: text('profile_data'),
});

export const shifts = mysqlTable('shifts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  gracePeriodMins: int('grace_period_mins').default(0),
  halfDayHours: decimal('half_day_hours', { precision: 3, scale: 1 }),
  fullDayHours: decimal('full_day_hours', { precision: 3, scale: 1 }),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  halfDayCutoffTime: varchar('half_day_cutoff_time', { length: 10 }),
  description: text('description'),
  color: varchar('color', { length: 30 }),
  applicableDays: text('applicable_days'),
});


// Biometric device registry. Device ID, short name and serial number are unique.
export const biometric_machines = mysqlTable('biometric_machines', {
  id: varchar('id', { length: 64 }).primaryKey(),
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
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
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


export const user_project_histories = mysqlTable('user_project_histories', {
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
