-- =============================================================================================
-- employee_profiles: one column per field, and Aadhaar / PAN / bank details in their own tables
-- =============================================================================================
-- Until now the form fields of an employee (gender, DOB, leave group, managers, …) were kept together as JSON text
-- in employee_profiles.profile_data, and Aadhaar / PAN / bank details inside the same JSON. This migration:
--
--   1. adds one column per field to employee_profiles (reporting_manager_id / reviewing_manager_id, which MySQL
--      worked out from the JSON until now, become ordinary columns keeping their values),
--   2. creates employee_identity (Aadhaar encrypted + keyed hash + last 4 digits, PAN) and
--      employee_bank_accounts (bank, IFSC, account encrypted + keyed hash + last 4 digits); both have UNIQUE keys,
--      so the database itself refuses an Aadhaar / PAN / account used by two employees,
--   3. copies every employee's values out of the JSON into the new columns / tables,
--   4. removes the copied keys from profile_data (anything else that was in it stays there).
--
-- Leave year, its "basis" and the HoD's name are not stored: they follow from the leave group and the HoD's
-- account and are worked out when reading.
--
-- BEFORE RUNNING take a backup (this rewrites profile_data):
--   mysqldump --no-tablespaces -u lams2_admin -p lams2_db > ~/backup_before_profile_columns.sql
-- Run as lams2_admin, with the app stopped (pm2 stop lams2), then deploy the new code and start it:
--   mysql -u lams2_admin -p lams2_db < migrations/20261218_employee_profile_columns.sql
-- Safe to run again: existing columns / tables are left as they are and nothing is copied twice.
-- Nothing is deleted: no row, no table, no column.
-- =============================================================================================

-- reporting_manager_id: generated column → ordinary column (values kept), or added
SET @extra = (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reporting_manager_id');
SET @sql = CASE
  WHEN @extra IS NULL THEN 'ALTER TABLE employee_profiles ADD COLUMN reporting_manager_id BIGINT UNSIGNED NULL'
  WHEN @extra LIKE '%GENERATED%' THEN 'ALTER TABLE employee_profiles MODIFY COLUMN reporting_manager_id BIGINT UNSIGNED NULL'
  ELSE 'DO 0' END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewing_manager_id: generated column → ordinary column (values kept), or added
SET @extra = (SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reviewing_manager_id');
SET @sql = CASE
  WHEN @extra IS NULL THEN 'ALTER TABLE employee_profiles ADD COLUMN reviewing_manager_id BIGINT UNSIGNED NULL'
  WHEN @extra LIKE '%GENERATED%' THEN 'ALTER TABLE employee_profiles MODIFY COLUMN reviewing_manager_id BIGINT UNSIGNED NULL'
  ELSE 'DO 0' END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1. One column per field (added only when missing)
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'gender') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN gender VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'dob') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN dob DATE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'blood_group') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN blood_group VARCHAR(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- leave_group is compared with leave_groups.code, so it takes that column's character set / collation
SET @lgc = (SELECT IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME))
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_groups' AND COLUMN_NAME = 'code');
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'leave_group') = 0,
  CONCAT('ALTER TABLE employee_profiles ADD COLUMN leave_group VARCHAR(50)', COALESCE(@lgc, ''), ' NULL'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'employee_category') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN employee_category VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'permanent_employment_type') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN permanent_employment_type VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'valid_until_date') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN valid_until_date DATE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'is_on_probation') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN is_on_probation TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'probation_end_date') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN probation_end_date DATE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'is_pwd') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN is_pwd TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'is_phd_enrolled') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN is_phd_enrolled TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'pi_name') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN pi_name VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'course_program') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN course_program VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'course_batch') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN course_batch VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'enrolled_through') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN enrolled_through VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'guide_supervisor') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN guide_supervisor VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'retirement_date') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN retirement_date DATE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'status_change_reason') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN status_change_reason VARCHAR(500) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'status_effective_date') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN status_effective_date DATE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'status_changed_by') = 0,
  'ALTER TABLE employee_profiles ADD COLUMN status_changed_by VARCHAR(50) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND INDEX_NAME = 'idx_profiles_reporting_manager') = 0,
  'ALTER TABLE employee_profiles ADD KEY idx_profiles_reporting_manager (reporting_manager_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND INDEX_NAME = 'idx_profiles_reviewing_manager') = 0,
  'ALTER TABLE employee_profiles ADD KEY idx_profiles_reviewing_manager (reviewing_manager_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND INDEX_NAME = 'idx_profiles_leave_group') = 0,
  'ALTER TABLE employee_profiles ADD KEY idx_profiles_leave_group (leave_group)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profile_data may be empty from now on (new employees have nothing to keep there)
SET @pd = (SELECT CONCAT(COLUMN_TYPE, IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
             FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'profile_data' AND IS_NULLABLE = 'NO');
SET @sql = IF(@pd IS NULL, 'DO 0', CONCAT('ALTER TABLE employee_profiles MODIFY COLUMN profile_data ', @pd, ' NULL'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Identity and bank tables. biometric_id gets exactly the type / character set of employee_profiles.biometric_id,
--    so the foreign key can be made on any server.
SET @bio = (SELECT CONCAT(COLUMN_TYPE, IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'biometric_id');
SET @sql = CONCAT('CREATE TABLE IF NOT EXISTS employee_identity (',
  'biometric_id ', @bio, ' NOT NULL, ',
  'aadhaar_enc VARCHAR(255) NULL, aadhaar_hash VARCHAR(64) NULL, aadhaar_last4 VARCHAR(4) NULL, pan VARCHAR(10) NULL, ',
  'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ',
  'PRIMARY KEY (biometric_id), UNIQUE KEY uq_identity_aadhaar_hash (aadhaar_hash), UNIQUE KEY uq_identity_pan (pan), ',
  'CONSTRAINT fk_identity_employee FOREIGN KEY (biometric_id) REFERENCES employee_profiles (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE',
  ') ENGINE=InnoDB');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('CREATE TABLE IF NOT EXISTS employee_bank_accounts (',
  'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, biometric_id ', @bio, ' NOT NULL, ',
  'bank_name VARCHAR(100) NOT NULL, ifsc VARCHAR(11) NOT NULL, account_enc VARCHAR(255) NOT NULL, account_hash VARCHAR(64) NOT NULL, ',
  'account_last4 VARCHAR(4) NOT NULL, is_primary TINYINT(1) NOT NULL DEFAULT 1, ',
  'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ',
  'PRIMARY KEY (id), UNIQUE KEY uq_bank_account_hash (account_hash), KEY idx_bank_accounts_employee (biometric_id), ',
  'CONSTRAINT fk_bank_account_employee FOREIGN KEY (biometric_id) REFERENCES employee_profiles (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE',
  ') ENGINE=InnoDB');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Copy the values out of the JSON (only rows that still have them; a value already in a column is kept)

UPDATE employee_profiles SET
  gender = COALESCE(gender, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.gender'))), 'null'), ''), 20)),
  dob = COALESCE(dob, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.dob')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.dob')), 10) AS DATE), NULL)),
  blood_group = COALESCE(blood_group, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bloodGroup'))), 'null'), ''), 3)),
  leave_group = COALESCE(leave_group, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.leaveGroup'))), 'null'), ''), 50)),
  employee_category = COALESCE(employee_category, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.employeeCategory'))), 'null'), ''), 100)),
  permanent_employment_type = COALESCE(permanent_employment_type, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.permanentEmploymentType'))), 'null'), ''), 20)),
  reporting_manager_id = COALESCE(reporting_manager_id, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reportingManagerId')) REGEXP '^[0-9]{1,18}$', CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reportingManagerId')) AS UNSIGNED), NULL)),
  reviewing_manager_id = COALESCE(reviewing_manager_id, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reviewingManagerId')) REGEXP '^[0-9]{1,18}$', CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reviewingManagerId')) AS UNSIGNED), NULL)),
  valid_until_date = COALESCE(valid_until_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.validUntilDate')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.validUntilDate')), 10) AS DATE), NULL)),
  is_on_probation = GREATEST(is_on_probation, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.isOnProbation')) IN ('true', '1'), 1, 0)),
  probation_end_date = COALESCE(probation_end_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.probationEndDate')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.probationEndDate')), 10) AS DATE), NULL)),
  is_pwd = GREATEST(is_pwd, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.isPwd')) IN ('true', '1'), 1, 0)),
  is_phd_enrolled = GREATEST(is_phd_enrolled, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.isPhDEnrolled')) IN ('true', '1'), 1, 0)),
  pi_name = COALESCE(pi_name, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.piName'))), 'null'), ''), 255)),
  course_program = COALESCE(course_program, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.courseProgram'))), 'null'), ''), 255)),
  course_batch = COALESCE(course_batch, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.courseBatch'))), 'null'), ''), 255)),
  enrolled_through = COALESCE(enrolled_through, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.enrolledThrough'))), 'null'), ''), 255)),
  guide_supervisor = COALESCE(guide_supervisor, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.guideSupervisor'))), 'null'), ''), 255)),
  retirement_date = COALESCE(retirement_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.retirementDate')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.retirementDate')), 10) AS DATE), NULL)),
  status_change_reason = COALESCE(status_change_reason, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.statusChangeReason'))), 'null'), ''), 500)),
  status_effective_date = COALESCE(status_effective_date, IF(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.statusEffectiveDate')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}', CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.statusEffectiveDate')), 10) AS DATE), NULL)),
  status_changed_by = COALESCE(status_changed_by, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.statusChangedBy'))), 'null'), ''), 50))
WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data);

INSERT INTO employee_identity (biometric_id, aadhaar_enc, aadhaar_hash, aadhaar_last4, pan)
SELECT biometric_id, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.aadhaarEnc'))), 'null'), ''), 255), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.aadhaarHash'))), 'null'), ''), 64), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.aadhaarLast4'))), 'null'), ''), 4), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.panNumber'))), 'null'), ''), 10)
  FROM employee_profiles
 WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data)
   AND (LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.aadhaarHash'))), 'null'), ''), 64) IS NOT NULL OR LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.panNumber'))), 'null'), ''), 10) IS NOT NULL)
ON DUPLICATE KEY UPDATE biometric_id = employee_identity.biometric_id;

INSERT INTO employee_bank_accounts (biometric_id, bank_name, ifsc, account_enc, account_hash, account_last4, is_primary)
SELECT p.biometric_id, LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankName'))), 'null'), ''), 100), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankIfsc'))), 'null'), ''), 11), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankAccountEnc'))), 'null'), ''), 255), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankAccountHash'))), 'null'), ''), 64), LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankAccountLast4'))), 'null'), ''), 4), 1
  FROM employee_profiles p
 WHERE p.profile_data IS NOT NULL AND JSON_VALID(p.profile_data)
   AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankAccountHash'))), 'null'), ''), 64) IS NOT NULL AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankAccountEnc'))), 'null'), ''), 255) IS NOT NULL
   AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankName'))), 'null'), ''), 100) IS NOT NULL AND LEFT(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.bankIfsc'))), 'null'), ''), 11) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM employee_bank_accounts b WHERE b.biometric_id = p.biometric_id)
ON DUPLICATE KEY UPDATE biometric_id = employee_bank_accounts.biometric_id;

-- 4. Remove the copied keys from the JSON (keys this migration does not know stay)
UPDATE employee_profiles SET profile_data = JSON_REMOVE(profile_data, '$.gender', '$.dob', '$.bloodGroup', '$.leaveGroup', '$.employeeCategory', '$.permanentEmploymentType', '$.reportingManagerId', '$.reviewingManagerId', '$.validUntilDate', '$.isOnProbation', '$.probationEndDate', '$.isPwd', '$.isPhDEnrolled', '$.piName', '$.courseProgram', '$.courseBatch', '$.enrolledThrough', '$.guideSupervisor', '$.retirementDate', '$.statusChangeReason', '$.statusEffectiveDate', '$.statusChangedBy', '$.leaveCycle', '$.leaveCycleBasis', '$.hodName', '$.aadhaarEnc', '$.aadhaarHash', '$.aadhaarLast4', '$.panNumber', '$.bankName', '$.bankIfsc', '$.bankAccountEnc', '$.bankAccountHash', '$.bankAccountLast4', '$.aadhaarNumber', '$.bankAccountNumber', '$.status')
 WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data);
UPDATE employee_profiles SET profile_data = NULL WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data) AND JSON_LENGTH(profile_data) = 0;

-- 5. Check: expect the new columns, both tables, and these counts
SELECT COUNT(*) AS profiles,
       SUM(gender IS NOT NULL) AS with_gender, SUM(dob IS NOT NULL) AS with_dob, SUM(leave_group IS NOT NULL) AS with_leave_group,
       SUM(reporting_manager_id IS NOT NULL) AS with_reporting_manager, SUM(profile_data IS NOT NULL) AS still_with_other_json
  FROM employee_profiles;
SELECT (SELECT COUNT(*) FROM employee_identity) AS identity_rows, (SELECT COUNT(*) FROM employee_bank_accounts) AS bank_rows;
