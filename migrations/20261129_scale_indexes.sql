-- Migration: indexes and columns for many simultaneous users. Safe to re-run.
--
-- 1. employee_profiles.reporting_manager_id / reviewing_manager_id
--    The manager links live inside the profile_data JSON text. Finding "everyone who reports to X"
--    meant reading every profile and parsing it in the server. These two generated columns copy the
--    ids out of the JSON (MySQL keeps them in step automatically) and are indexed, so a manager's
--    team is found by MySQL directly. Invalid JSON or a non-numeric value gives NULL.
--
-- 2. Attendance (biometric punches): a covering index (employee, date, time, device) so reading one
--    person's punches for a range is answered from the index alone.
--
-- Adding a column / index to a big table can take a while and briefly slows writes; run it at a quiet time.

SET @has_rm := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reporting_manager_id');
SET @ddl := IF(@has_rm = 0,
  'ALTER TABLE employee_profiles ADD COLUMN reporting_manager_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN JSON_VALID(profile_data) THEN (CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reportingManagerId'')) REGEXP ''^[0-9]{1,18}$'' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reportingManagerId'')) AS UNSIGNED) END) END) STORED, ADD KEY idx_profiles_reporting_manager (reporting_manager_id)',
  'SELECT ''employee_profiles.reporting_manager_id already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_hod := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'reviewing_manager_id');
SET @ddl := IF(@has_hod = 0,
  'ALTER TABLE employee_profiles ADD COLUMN reviewing_manager_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN JSON_VALID(profile_data) THEN (CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reviewingManagerId'')) REGEXP ''^[0-9]{1,18}$'' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.reviewingManagerId'')) AS UNSIGNED) END) END) STORED, ADD KEY idx_profiles_reviewing_manager (reviewing_manager_id)',
  'SELECT ''employee_profiles.reviewing_manager_id already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cover := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Attendance' AND INDEX_NAME = 'idx_atten_cover');
SET @has_table := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Attendance');
SET @ddl := IF(@has_table = 1 AND @has_cover = 0,
  'ALTER TABLE `Attendance` ADD KEY `idx_atten_cover` (`EmployeeCode`, `LogDate`, `LogDateTime`, `DeviceSR`)',
  'SELECT ''Attendance covering index already exists (or the table is missing)''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
