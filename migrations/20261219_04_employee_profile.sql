-- =============================================================================================
-- Normalization, step 4 of 6: employee profile
-- =============================================================================================
-- employee_profiles had the form fields as JSON text (profile_data) and some text columns that could point at
-- two different masters. Now:
--   * one column per field, each list / master value with a foreign key:
--       suffix → salutations, gender → genders, institute → institutes, employment_type → employee_types,
--       leave_group → leave_groups, employee_category → cadres, shift_id → shifts,
--       org_unit_name → organization_units(name), project_name → projects(name), designation_name → designations(name),
--       training_course_name / msc_stream_name, trainee_batch_name / msc_batch_name, phd_enrollment_name,
--       reporting_manager_id / reviewing_manager_id → users(id), biometric_id → users(biometric_id)
--   * department and designation stay readable as before: generated (not stored) columns made from the above;
--   * Aadhaar (encrypted + keyed hash + last 4) and PAN → employee_identity; bank → employee_bank_accounts
--     (unique keys: the database itself refuses an Aadhaar / PAN / account used twice);
--   * values that follow from other data are not stored: leave year (from the leave group), HoD name and the
--     researcher's default PI (from the accounts), "valid until" (users.valid_upto), retirement date (from DOB).
-- profile_data is removed once nothing is left in it. Safe to run again.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 0. Checks (nothing changes if one fails)
-- ---------------------------------------------------------------------------------------------
CALL lams_assert(NOT lams_has_column('employee_profiles', 'profile_data') OR lams_has_column('employee_profiles', 'org_unit_name')
  OR (SELECT COUNT(*) FROM employee_profiles p
       WHERE p.department <> '' AND NOT EXISTS (SELECT 1 FROM organization_units u WHERE u.name = p.department)
         AND NOT EXISTS (SELECT 1 FROM projects pr WHERE pr.name = p.department)) = 0,
  'An employee''s department / project is not in Institute Units or Projects. Fix it (or add it to the master), then run this file again.');
CALL lams_assert(lams_has_column('employee_profiles', 'designation_name')
  OR (SELECT COUNT(*) FROM employee_profiles p WHERE p.designation <> '' AND NOT EXISTS (SELECT 1 FROM designations d WHERE d.name = p.designation)) = 0,
  'An employee''s designation is not in Designations. Fix it (or add it to the master), then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE p.suffix IS NOT NULL AND p.suffix <> '' AND NOT EXISTS (SELECT 1 FROM salutations s WHERE s.code = p.suffix)) = 0,
  'An employee''s salutation is not in Salutations. Fix it, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE NOT EXISTS (SELECT 1 FROM employee_types t WHERE t.code = p.employment_type)) = 0,
  'An employee''s employee type is not in Employee Types. Fix it, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE p.institute IS NOT NULL AND p.institute <> '' AND NOT EXISTS (SELECT 1 FROM institutes i WHERE i.code = p.institute)) = 0,
  'An employee''s institute is not in Institutes. Fix it, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE p.shift_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = p.shift_id)) = 0,
  'An employee''s shift does not exist in Shifts. Fix it, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.biometric_id = p.biometric_id)) = 0,
  'An employee profile has no account (users) with its biometric ID. Fix it, then run this file again.');

-- ---------------------------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'gender'), 'ALTER TABLE employee_profiles ADD COLUMN gender VARCHAR(50) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'dob'), 'ALTER TABLE employee_profiles ADD COLUMN dob DATE NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'blood_group'), 'ALTER TABLE employee_profiles ADD COLUMN blood_group VARCHAR(3) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'leave_group'), 'ALTER TABLE employee_profiles ADD COLUMN leave_group VARCHAR(20) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'employee_category'), 'ALTER TABLE employee_profiles ADD COLUMN employee_category VARCHAR(100) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'permanent_employment_type'), 'ALTER TABLE employee_profiles ADD COLUMN permanent_employment_type VARCHAR(20) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'is_on_probation'), 'ALTER TABLE employee_profiles ADD COLUMN is_on_probation TINYINT(1) NOT NULL DEFAULT 0');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'probation_end_date'), 'ALTER TABLE employee_profiles ADD COLUMN probation_end_date DATE NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'is_pwd'), 'ALTER TABLE employee_profiles ADD COLUMN is_pwd TINYINT(1) NOT NULL DEFAULT 0');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'is_phd_enrolled'), 'ALTER TABLE employee_profiles ADD COLUMN is_phd_enrolled TINYINT(1) NOT NULL DEFAULT 0');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'pi_name'), 'ALTER TABLE employee_profiles ADD COLUMN pi_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'guide_supervisor'), 'ALTER TABLE employee_profiles ADD COLUMN guide_supervisor VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'org_unit_name'), 'ALTER TABLE employee_profiles ADD COLUMN org_unit_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'project_name'), 'ALTER TABLE employee_profiles ADD COLUMN project_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'designation_name'), 'ALTER TABLE employee_profiles ADD COLUMN designation_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'training_course_name'), 'ALTER TABLE employee_profiles ADD COLUMN training_course_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'msc_stream_name'), 'ALTER TABLE employee_profiles ADD COLUMN msc_stream_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'trainee_batch_name'), 'ALTER TABLE employee_profiles ADD COLUMN trainee_batch_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'msc_batch_name'), 'ALTER TABLE employee_profiles ADD COLUMN msc_batch_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'phd_enrollment_name'), 'ALTER TABLE employee_profiles ADD COLUMN phd_enrollment_name VARCHAR(255) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'status_change_reason'), 'ALTER TABLE employee_profiles ADD COLUMN status_change_reason VARCHAR(500) NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'status_effective_date'), 'ALTER TABLE employee_profiles ADD COLUMN status_effective_date DATE NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'status_changed_by'), 'ALTER TABLE employee_profiles ADD COLUMN status_changed_by CHAR(4) NULL');

-- Manager ids: MySQL worked them out from the JSON until now; they become ordinary columns keeping their values.
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'reporting_manager_id'), 'ALTER TABLE employee_profiles ADD COLUMN reporting_manager_id BIGINT UNSIGNED NULL');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'reviewing_manager_id'), 'ALTER TABLE employee_profiles ADD COLUMN reviewing_manager_id BIGINT UNSIGNED NULL');
CALL lams_exec_if((SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reporting_manager_id') LIKE '%GENERATED%',
  'ALTER TABLE employee_profiles MODIFY COLUMN reporting_manager_id BIGINT UNSIGNED NULL');
CALL lams_exec_if((SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reviewing_manager_id') LIKE '%GENERATED%',
  'ALTER TABLE employee_profiles MODIFY COLUMN reviewing_manager_id BIGINT UNSIGNED NULL');

-- ---------------------------------------------------------------------------------------------
-- 2. Copy the JSON values into the columns (rows that still have them; a value already in a column is kept)
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'UPDATE employee_profiles SET
    gender = COALESCE(gender, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.gender''))), ''null''), ''''), 50)),
    dob = COALESCE(dob, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.dob'')) REGEXP ''^[0-9]{4}-[0-9]{2}-[0-9]{2}'', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.dob'')), 10) AS DATE), NULL)),
    blood_group = COALESCE(blood_group, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bloodGroup''))), ''null''), ''''), 3)),
    leave_group = COALESCE(leave_group, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.leaveGroup''))), ''null''), ''''), 20)),
    employee_category = COALESCE(employee_category, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.employeeCategory''))), ''null''), ''''), 100)),
    permanent_employment_type = COALESCE(permanent_employment_type, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.permanentEmploymentType''))), ''null''), ''''), 20)),
    is_on_probation = GREATEST(is_on_probation, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.isOnProbation'')) IN (''true'', ''1''), 1, 0)),
    probation_end_date = COALESCE(probation_end_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.probationEndDate'')) REGEXP ''^[0-9]{4}-[0-9]{2}-[0-9]{2}'', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.probationEndDate'')), 10) AS DATE), NULL)),
    is_pwd = GREATEST(is_pwd, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.isPwd'')) IN (''true'', ''1''), 1, 0)),
    is_phd_enrolled = GREATEST(is_phd_enrolled, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.isPhDEnrolled'')) IN (''true'', ''1''), 1, 0)),
    guide_supervisor = COALESCE(guide_supervisor, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.guideSupervisor''))), ''null''), ''''), 255)),
    status_change_reason = COALESCE(status_change_reason, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.statusChangeReason''))), ''null''), ''''), 500)),
    status_effective_date = COALESCE(status_effective_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.statusEffectiveDate'')) REGEXP ''^[0-9]{4}-[0-9]{2}-[0-9]{2}'', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.statusEffectiveDate'')), 10) AS DATE), NULL)),
    status_changed_by = COALESCE(status_changed_by, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.statusChangedBy''))), ''null''), ''''), 4)),
    reporting_manager_id = COALESCE(reporting_manager_id, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reportingManagerId'')) REGEXP ''^[0-9]{1,18}$'', CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reportingManagerId'')) AS UNSIGNED), NULL)),
    reviewing_manager_id = COALESCE(reviewing_manager_id, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reviewingManagerId'')) REGEXP ''^[0-9]{1,18}$'', CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reviewingManagerId'')) AS UNSIGNED), NULL))
   WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data)');
-- PI: kept only when typed in (a researcher's PI defaulted to the reporting manager's name, which is now worked out)
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'UPDATE employee_profiles p LEFT JOIN users rm ON rm.id = p.reporting_manager_id
      SET p.pi_name = COALESCE(p.pi_name, NULLIF(LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.piName''))), ''null''), ''''), 255), rm.name))
    WHERE p.profile_data IS NOT NULL AND JSON_VALID(p.profile_data)');

-- Course / batch / enrollment: into the column of the right master
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'UPDATE employee_profiles p
      SET p.training_course_name = COALESCE(p.training_course_name, (SELECT c.name FROM training_courses c WHERE c.name = LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.courseProgram''))), ''null''), ''''), 255))),
          p.msc_stream_name      = COALESCE(p.msc_stream_name, (SELECT s.name FROM msc_streams s WHERE s.name = LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.courseProgram''))), ''null''), ''''), 255))),
          p.trainee_batch_name   = COALESCE(p.trainee_batch_name, (SELECT b.name FROM trainee_batches b WHERE b.name = LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.courseBatch''))), ''null''), ''''), 255))),
          p.msc_batch_name       = COALESCE(p.msc_batch_name, (SELECT b.name FROM msc_batches b WHERE b.name = LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.courseBatch''))), ''null''), ''''), 255))),
          p.phd_enrollment_name  = COALESCE(p.phd_enrollment_name, (SELECT e.name FROM phd_enrollments e WHERE e.name = LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, ''$.enrolledThrough''))), ''null''), ''''), 255)))
    WHERE p.profile_data IS NOT NULL AND JSON_VALID(p.profile_data)');
-- A trainee keeps a training course, an M.Sc student a stream (a name in both masters goes by the employee type)
UPDATE employee_profiles p JOIN employee_types t ON t.code = p.employment_type
   SET p.msc_stream_name = IF(t.form_layout = 'bsc_msc_student', p.msc_stream_name, NULL),
       p.msc_batch_name = IF(t.form_layout = 'bsc_msc_student', p.msc_batch_name, NULL),
       p.training_course_name = IF(t.form_layout = 'bsc_msc_student', NULL, p.training_course_name),
       p.trainee_batch_name = IF(t.form_layout = 'bsc_msc_student', NULL, p.trainee_batch_name)
 WHERE p.msc_stream_name IS NOT NULL OR p.training_course_name IS NOT NULL OR p.msc_batch_name IS NOT NULL OR p.trainee_batch_name IS NOT NULL;

-- Department / project and designation (the old text columns)
CALL lams_exec_if(lams_has_column('employee_profiles', 'department') AND (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'department') NOT LIKE '%GENERATED%',
  'UPDATE employee_profiles p JOIN employee_types t ON t.code = p.employment_type
      SET p.org_unit_name = COALESCE(p.org_unit_name, IF(t.form_layout = ''researcher'', NULL, (SELECT u.name FROM organization_units u WHERE u.name = p.department))),
          p.project_name  = COALESCE(p.project_name, IF(t.form_layout = ''researcher'' OR NOT EXISTS (SELECT 1 FROM organization_units u WHERE u.name = p.department),
                                                       (SELECT pr.name FROM projects pr WHERE pr.name = p.department), NULL))
    WHERE p.department <> ''''');
CALL lams_exec_if(lams_has_column('employee_profiles', 'designation') AND (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'designation') NOT LIKE '%GENERATED%',
  'UPDATE employee_profiles SET designation_name = COALESCE(designation_name, NULLIF(designation, '''')) WHERE designation <> ''''');

UPDATE employee_profiles SET suffix = NULL WHERE suffix = '';
UPDATE employee_profiles SET institute = NULL WHERE institute = '';
-- Manager ids that point at no account are cleared (they could not route anything)
UPDATE employee_profiles p LEFT JOIN users u ON u.id = p.reporting_manager_id SET p.reporting_manager_id = NULL WHERE p.reporting_manager_id IS NOT NULL AND u.id IS NULL;
UPDATE employee_profiles p LEFT JOIN users u ON u.id = p.reviewing_manager_id SET p.reviewing_manager_id = NULL WHERE p.reviewing_manager_id IS NOT NULL AND u.id IS NULL;
-- Values that are not in their list are cleared (they could not be chosen on the form either)
UPDATE employee_profiles p LEFT JOIN leave_groups g ON g.code = p.leave_group SET p.leave_group = NULL WHERE p.leave_group IS NOT NULL AND g.id IS NULL;
UPDATE employee_profiles SET blood_group = NULL WHERE blood_group IS NOT NULL AND blood_group NOT IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
UPDATE employee_profiles SET permanent_employment_type = NULL WHERE permanent_employment_type IS NOT NULL AND permanent_employment_type NOT IN ('Direct', 'Deputation');
CALL lams_assert((SELECT COUNT(*) FROM employee_profiles p WHERE p.gender IS NOT NULL AND NOT EXISTS (SELECT 1 FROM genders g WHERE g.code = p.gender)) = 0,
  'An employee''s gender is not in Genders. Fix it, then run this file again.');

-- ---------------------------------------------------------------------------------------------
-- 3. Aadhaar / PAN and bank details
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_identity (
  biometric_id CHAR(4) NOT NULL,
  aadhaar_enc VARCHAR(255) NULL,
  aadhaar_hash VARCHAR(64) NULL,
  aadhaar_last4 VARCHAR(4) NULL,
  pan VARCHAR(10) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (biometric_id),
  UNIQUE KEY uq_identity_aadhaar_hash (aadhaar_hash),
  UNIQUE KEY uq_identity_pan (pan),
  CONSTRAINT fk_identity_employee FOREIGN KEY (biometric_id) REFERENCES employee_profiles (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS employee_bank_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  biometric_id CHAR(4) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  ifsc VARCHAR(11) NOT NULL,
  account_enc VARCHAR(255) NOT NULL,
  account_hash VARCHAR(64) NOT NULL,
  account_last4 VARCHAR(4) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bank_account_hash (account_hash),
  KEY idx_bank_accounts_employee (biometric_id),
  CONSTRAINT fk_bank_account_employee FOREIGN KEY (biometric_id) REFERENCES employee_profiles (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'INSERT INTO employee_identity (biometric_id, aadhaar_enc, aadhaar_hash, aadhaar_last4, pan)
   SELECT biometric_id, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.aadhaarEnc''))), ''null''), ''''), 255), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.aadhaarHash''))), ''null''), ''''), 64), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.aadhaarLast4''))), ''null''), ''''), 4), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.panNumber''))), ''null''), ''''), 10)
     FROM employee_profiles
    WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data) AND (LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.aadhaarHash''))), ''null''), ''''), 64) IS NOT NULL OR LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.panNumber''))), ''null''), ''''), 10) IS NOT NULL)
   ON DUPLICATE KEY UPDATE biometric_id = employee_identity.biometric_id');
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'INSERT INTO employee_bank_accounts (biometric_id, bank_name, ifsc, account_enc, account_hash, account_last4, is_primary)
   SELECT p.biometric_id, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankName''))), ''null''), ''''), 100), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankIfsc''))), ''null''), ''''), 11), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankAccountEnc''))), ''null''), ''''), 255), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankAccountHash''))), ''null''), ''''), 64), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankAccountLast4''))), ''null''), ''''), 4), 1
     FROM employee_profiles p
    WHERE p.profile_data IS NOT NULL AND JSON_VALID(p.profile_data) AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankAccountHash''))), ''null''), ''''), 64) IS NOT NULL AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankAccountEnc''))), ''null''), ''''), 255) IS NOT NULL
      AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankName''))), ''null''), ''''), 100) IS NOT NULL AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.bankIfsc''))), ''null''), ''''), 11) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM employee_bank_accounts b WHERE b.biometric_id = p.biometric_id)');

-- ---------------------------------------------------------------------------------------------
-- 4. department / designation become generated columns; old text and JSON go
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(lams_has_column('employee_profiles', 'department') AND (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'department') NOT LIKE '%GENERATED%',
  'ALTER TABLE employee_profiles DROP COLUMN department');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'department'),
  'ALTER TABLE employee_profiles ADD COLUMN department VARCHAR(255) GENERATED ALWAYS AS (COALESCE(org_unit_name, project_name, '''')) VIRTUAL NOT NULL AFTER suffix');
CALL lams_exec_if(lams_has_column('employee_profiles', 'designation') AND (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'designation') NOT LIKE '%GENERATED%',
  'ALTER TABLE employee_profiles DROP COLUMN designation');
CALL lams_exec_if(NOT lams_has_column('employee_profiles', 'designation'),
  'ALTER TABLE employee_profiles ADD COLUMN designation VARCHAR(255) GENERATED ALWAYS AS (COALESCE(designation_name, '''')) VIRTUAL NOT NULL AFTER department');
CALL lams_exec_if(NOT lams_has_index('employee_profiles', 'idx_profiles_department'), 'ALTER TABLE employee_profiles ADD KEY idx_profiles_department (department)');

-- Remove the copied keys from the JSON; drop the column when nothing is left in it
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'UPDATE employee_profiles SET profile_data = NULL WHERE profile_data IS NOT NULL AND (NOT JSON_VALID(profile_data) OR JSON_LENGTH(JSON_REMOVE(profile_data,
     ''$.gender'', ''$.dob'', ''$.bloodGroup'', ''$.leaveGroup'', ''$.leaveCycle'', ''$.leaveCycleBasis'', ''$.employeeCategory'', ''$.permanentEmploymentType'',
     ''$.reportingManagerId'', ''$.reviewingManagerId'', ''$.hodName'', ''$.validUntilDate'', ''$.isOnProbation'', ''$.isPwd'', ''$.probationEndDate'',
     ''$.isPhDEnrolled'', ''$.piName'', ''$.courseProgram'', ''$.courseBatch'', ''$.enrolledThrough'', ''$.guideSupervisor'', ''$.retirementDate'',
     ''$.statusChangeReason'', ''$.statusEffectiveDate'', ''$.statusChangedBy'', ''$.status'',
     ''$.aadhaarEnc'', ''$.aadhaarHash'', ''$.aadhaarLast4'', ''$.panNumber'', ''$.bankName'', ''$.bankIfsc'', ''$.bankAccountEnc'', ''$.bankAccountHash'', ''$.bankAccountLast4'',
     ''$.aadhaarNumber'', ''$.bankAccountNumber'')) = 0)');
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'SELECT COUNT(*) AS profiles_with_unknown_json_kept FROM employee_profiles WHERE profile_data IS NOT NULL');
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data') AND (SELECT COUNT(*) FROM employee_profiles WHERE profile_data IS NOT NULL) = 0,
  'ALTER TABLE employee_profiles DROP COLUMN profile_data');

-- ---------------------------------------------------------------------------------------------
-- 5. Constraints
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_profiles_blood_group'),
  'ALTER TABLE employee_profiles ADD CONSTRAINT chk_profiles_blood_group CHECK (blood_group IN (''A+'', ''A-'', ''B+'', ''B-'', ''AB+'', ''AB-'', ''O+'', ''O-''))');
CALL lams_exec_if(NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_profiles_permanent_type'),
  'ALTER TABLE employee_profiles ADD CONSTRAINT chk_profiles_permanent_type CHECK (permanent_employment_type IN (''Direct'', ''Deputation''))');

CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_user'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_user FOREIGN KEY (biometric_id) REFERENCES users (biometric_id) ON UPDATE CASCADE');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_salutation'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_salutation FOREIGN KEY (suffix) REFERENCES salutations (code)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_gender'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_gender FOREIGN KEY (gender) REFERENCES genders (code)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_institute'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_institute FOREIGN KEY (institute) REFERENCES institutes (code)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_employee_type'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_employee_type FOREIGN KEY (employment_type) REFERENCES employee_types (code) ON UPDATE CASCADE');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_leave_group'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_leave_group FOREIGN KEY (leave_group) REFERENCES leave_groups (code)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_cadre'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_cadre FOREIGN KEY (employee_category) REFERENCES cadres (code) ON UPDATE CASCADE');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_shift'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_shift FOREIGN KEY (shift_id) REFERENCES shifts (id)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_org_unit'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_org_unit FOREIGN KEY (org_unit_name) REFERENCES organization_units (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_project'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_project FOREIGN KEY (project_name) REFERENCES projects (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_designation'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_designation FOREIGN KEY (designation_name) REFERENCES designations (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_training_course'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_training_course FOREIGN KEY (training_course_name) REFERENCES training_courses (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_msc_stream'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_msc_stream FOREIGN KEY (msc_stream_name) REFERENCES msc_streams (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_trainee_batch'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_trainee_batch FOREIGN KEY (trainee_batch_name) REFERENCES trainee_batches (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_msc_batch'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_msc_batch FOREIGN KEY (msc_batch_name) REFERENCES msc_batches (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_phd_enrollment'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_phd_enrollment FOREIGN KEY (phd_enrollment_name) REFERENCES phd_enrollments (name)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_reporting_manager'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_reporting_manager FOREIGN KEY (reporting_manager_id) REFERENCES users (id)');
CALL lams_exec_if(NOT lams_has_fk('employee_profiles', 'fk_profiles_reviewing_manager'), 'ALTER TABLE employee_profiles ADD CONSTRAINT fk_profiles_reviewing_manager FOREIGN KEY (reviewing_manager_id) REFERENCES users (id)');

SELECT COUNT(*) AS profiles, SUM(gender IS NOT NULL) AS with_gender, SUM(dob IS NOT NULL) AS with_dob, SUM(leave_group IS NOT NULL) AS with_leave_group,
       SUM(department <> '') AS with_department, SUM(reporting_manager_id IS NOT NULL) AS with_reporting_manager,
       (SELECT COUNT(*) FROM employee_identity) AS identity_rows, (SELECT COUNT(*) FROM employee_bank_accounts) AS bank_rows
  FROM employee_profiles;
SELECT 'step 4 of 6 done: employee profile' AS normalization;
