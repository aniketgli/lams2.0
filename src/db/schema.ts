import { mysqlTable, varchar, text, timestamp, boolean, int, decimal } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  expires: timestamp('expires').notNull(),
  data: text('data'),
});

export const employee_profiles = mysqlTable('employee_profiles', {
  userId: varchar('user_id', { length: 36 }).primaryKey(),
  suffix: varchar('suffix', { length: 10 }),
  department: varchar('department', { length: 255 }).notNull(),
  designation: varchar('designation', { length: 255 }).notNull(),
  employmentType: varchar('employment_type', { length: 50 }).notNull(),
  joiningDate: varchar('joining_date', { length: 10 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  officeLocation: varchar('office_location', { length: 255 }),
  shiftId: varchar('shift_id', { length: 36 }),
  // Preserves the full HRMS User profile (manager hierarchy, leave balances, student/research fields, module roles, etc.).
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
  gracePeriodMins: int('grace_period_mins').default(0),
  description: text('description'),
  color: varchar('color', { length: 30 }),
  applicableDays: text('applicable_days'),
});
