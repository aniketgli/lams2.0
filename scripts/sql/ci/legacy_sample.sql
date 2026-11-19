-- CI only: old-style data in the live schema, before the normalization migrations (checked by verify_normalization.sh).
INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, status, metadata) VALUES
  ('salutation', 'Mr.', 'Mr.', 10, 'ACTIVE', NULL), ('salutation', 'Dr.', 'Dr.', 20, 'ACTIVE', NULL),
  ('gender', 'Male', 'Male', 10, 'ACTIVE', NULL), ('gender', 'Female', 'Female', 20, 'ACTIVE', NULL),
  ('institute', 'WII', 'Wildlife Institute of India', 10, 'ACTIVE', NULL),
  ('employee_type', 'permanent', 'Permanent', 10, 'ACTIVE', '{"formLayout":"permanent"}'),
  ('employee_type', 'contractual', 'Contractual', 20, 'ACTIVE', '{"formLayout":"contractual"}'),
  ('employee_type', 'project', 'Project Staff', 30, 'ACTIVE', '{"formLayout":"researcher"}'),
  ('employee_type', 'msc', 'M.Sc Student', 40, 'ACTIVE', '{"formLayout":"bsc_msc_student"}'),
  ('org_unit_type', 'Department', 'Department', 10, 'ACTIVE', NULL),
  ('funding_category', 'UGC', 'UGC', 10, 'ACTIVE', NULL),
  ('cadre_group', 'Group A', 'Group A', 10, 'ACTIVE', NULL);
INSERT INTO organization_units (name, code, type, institute, metadata, status) VALUES
  ('IT Cell', 'ITC', 'Department', 'WII', '{"empTypes":"permanent,contractual","cadres":"Technical"}', 'ACTIVE');
INSERT INTO projects (name, code, metadata, status) VALUES ('Tiger Project', 'TP', '{"pi":"Dr. Stripes"}', 'ACTIVE');
INSERT INTO designations (name, code, metadata, status) VALUES ('Technical Assistant', 'TA', '{"empType":"permanent","cadre":"Technical"}', 'ACTIVE');
INSERT INTO categories (name, code, metadata, status) VALUES ('Scientists', 'SCI', '{"group":"Group A"}', 'ACTIVE');
INSERT INTO msc_streams (name, code, status) VALUES ('Wildlife Science', 'WS', 'ACTIVE');
INSERT INTO msc_batches (name, code, metadata, status) VALUES ('WS 2026', 'WS26', '{"parentStream":"Wildlife Science","validity":"2026-2028"}', 'ACTIVE');
INSERT INTO training_courses (name, code, status) VALUES ('Diploma', 'DIP', 'ACTIVE');
INSERT INTO trainee_batches (name, code, metadata, status) VALUES ('DIP 2026', 'D26', '{"parentCourse":"Diploma","validity":"2026"}', 'ACTIVE');
INSERT INTO phd_enrollments (name, code, metadata, status) VALUES ('UGC JRF', 'JRF', '{"category":"UGC"}', 'ACTIVE');
INSERT INTO shifts (code, name, start_time, end_time, grace_period_mins, is_default, status, applicable_days)
  VALUES ('CIGEN', 'CI General', '09:30', '18:00', 10, 0, 'active', '["Mon","Tue","Wed","Thu","Fri"]'),
         ('CINIL', 'CI No days', '08:00', '16:00', 0, 0, 'active', NULL);
INSERT INTO leave_groups (code, name, leave_year, status) VALUES ('CIPS', 'CI Permanent', 'CY', 'active');
INSERT INTO leave_types (code, name, default_quota, employee_types, purposes, status)
  VALUES ('CISCL', 'CI Special Casual', 8, 'permanent,contractual', 'Sports\nBlood donation\r\nSports', 'active');
INSERT INTO leave_type_quotas (leave_type_id, employee_type, quota) SELECT id, 'contractual', 6 FROM leave_types WHERE code = 'CISCL';
INSERT INTO report_schedules (name, report_key, frequency, send_time, formats, status) VALUES ('CI report', 'attendance', 'daily', '08:15', 'csv,pdf', 'active');

INSERT INTO users (biometric_id, name, email, password_hash, status, valid_upto) VALUES
  ('2001', 'Legacy Permanent', 'legacy1@wii.gov.in', 'x', 'active', '2050-06-30'),
  ('2002', 'Legacy Researcher', 'legacy2@wii.gov.in', 'x', 'active', '2027-03-31'),
  ('2003', 'Legacy Student', 'legacy3@wii.gov.in', 'x', 'active', '2028-06-30');
SET @u2 = (SELECT id FROM users WHERE biometric_id = '2002');
SET @shift = (SELECT id FROM shifts WHERE code = 'CIGEN');
INSERT INTO employee_profiles (biometric_id, suffix, department, designation, employment_type, joining_date, phone, institute, shift_id, profile_data) VALUES
  ('2001', 'Mr.', 'IT Cell', 'Technical Assistant', 'permanent', '2020-01-15', '9000000001', 'WII', CAST(@shift AS CHAR),
   JSON_OBJECT('gender', 'Male', 'dob', '1990-06-01', 'bloodGroup', 'B+', 'leaveGroup', 'CIPS', 'leaveCycle', 'CY', 'employeeCategory', 'Technical',
               'permanentEmploymentType', 'Direct', 'reportingManagerId', CAST(@u2 AS CHAR), 'reviewingManagerId', CAST(@u2 AS CHAR), 'hodName', 'Legacy Researcher',
               'isPwd', TRUE, 'retirementDate', '2050-05-31', 'aadhaarEnc', 'v1:a:b:c', 'aadhaarHash', 'h2001', 'aadhaarLast4', '1234', 'panNumber', 'ABCDE1234F',
               'bankName', 'SBI', 'bankIfsc', 'SBIN0001234', 'bankAccountEnc', 'v1:x:y:z', 'bankAccountHash', 'b2001', 'bankAccountLast4', '6789',
               'statusChangeReason', 'rejoined', 'statusEffectiveDate', '2021-01-01', 'statusChangedBy', '9001')),
  ('2002', 'Dr.', 'Tiger Project', 'Technical Assistant', 'project', '2025-04-01', '9000000002', 'WII', '',
   JSON_OBJECT('gender', 'Female', 'dob', '1995-02-10', 'validUntilDate', '2027-03-31', 'piName', 'Dr. Typed PI', 'isPhDEnrolled', TRUE, 'avatarColor', 'teal')),
  ('2003', 'Mr.', '', '', 'msc', '2026-07-01', '9000000003', 'WII', NULL,
   JSON_OBJECT('gender', 'Male', 'dob', '2003-03-03', 'courseProgram', 'Wildlife Science', 'courseBatch', 'WS 2026', 'validUntilDate', '2028-06-30'));
INSERT INTO manual_attendance_requests (user_id, att_date, in_time, out_time, original_in, category, reason, status, applied_by)
  SELECT id, '2026-11-02', '09:30', '18:05', '', 'forgot', 'CI', 'pending', id FROM users WHERE biometric_id = '2001';
INSERT INTO outdoor_duty_requests (user_id, start_date, end_date, start_time, end_time, days_count, od_type, location, purpose, status, applied_by)
  SELECT id, '2026-11-03', '2026-11-03', '10:00', '17:00', 1, 'field', 'Corbett', 'CI', 'pending', id FROM users WHERE biometric_id = '2002';
