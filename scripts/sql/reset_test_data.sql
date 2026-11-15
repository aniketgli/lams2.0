-- =====================================================================================================
-- RESET TEST DATA: empties lams2_db for a fresh start after testing.            !!! CANNOT BE UNDONE !!!
-- =====================================================================================================
-- What it does
--   * Empties every application table below and restarts its ids at 1 (TRUNCATE).
--   * Keeps exactly two accounts, renumbered:  users.id 1 = Administrator (erp@wii.gov.in)
--                                              users.id 2 = Auditor (erpauditor@wii.gov.in)
--     with their CURRENT passwords, their role grants and (if any) their profile rows.
--   * Re-adds the starting lists the employee form needs (salutation, gender, employee types,
--     unit types, cadre groups, funding categories, institutes) - same values as the original migrations.
-- What it does NOT touch
--   * role_catalog (the role definitions), Attendance (biometric punches written by the vendor export),
--     zz_retired_* tables, and any table not named below. No table or column is dropped or altered.
--   * The PC and the server use this same database: both will see the empty data.
--
-- Before running
--   1. Backup:   mysqldump -u lams2_admin -p lams2_db > ~/lams2_db_before_reset_$(date +%F).sql
--   2. Stop the app on the server (and on the PC), so nobody writes while it runs.
-- Run as lams2_admin (TRUNCATE needs it):
--   mysql -u lams2_admin -p lams2_db
--   mysql> source /erp_wii/applications/lams2.0/scripts/sql/reset_test_data.sql
-- If the two accounts are not found, the script changes NOTHING and says so.
-- After running: start the app, sign in as Administrator, then re-enter Master Settings
-- (organization, email/SMTP, default password, leave types and groups, holidays, shifts, machines, ...).
-- =====================================================================================================

SELECT DATABASE() AS database_being_reset;

SET @admin_email = 'erp@wii.gov.in';
SET @auditor_email = 'erpauditor@wii.gov.in';
SET @ok = IF((SELECT COUNT(*) FROM users WHERE LOWER(email) = @admin_email) = 1
         AND (SELECT COUNT(*) FROM users WHERE LOWER(email) = @auditor_email) = 1, 1, 0);
SELECT IF(@ok = 1, 'Administrator and Auditor found - resetting.',
                   'STOPPED: Administrator / Auditor account not found. Nothing was changed.') AS status;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------------------------
-- 1. Keep the two fixed accounts (copied aside, renumbered 1 and 2)
-- ---------------------------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS keep_users, keep_roles, keep_profiles;
CREATE TEMPORARY TABLE keep_users AS SELECT * FROM users WHERE @ok = 1 AND LOWER(email) IN (@admin_email, @auditor_email);
CREATE TEMPORARY TABLE keep_roles AS
  SELECT r.* FROM user_module_roles r JOIN keep_users u ON u.biometric_id = r.biometric_id;
CREATE TEMPORARY TABLE keep_profiles AS
  SELECT p.* FROM employee_profiles p JOIN keep_users u ON u.biometric_id = p.biometric_id;
UPDATE keep_users SET id = IF(LOWER(email) = @admin_email, 1, 2);
UPDATE keep_profiles p JOIN keep_users u ON u.biometric_id = p.biometric_id SET p.id = u.id;
SELECT id, biometric_id, name, email FROM keep_users ORDER BY id;

-- Column lists (generated columns such as reporting_manager_id are filled by MySQL itself).
SET @user_cols = (SELECT GROUP_CONCAT(CONCAT('`', COLUMN_NAME, '`') ORDER BY ORDINAL_POSITION) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND EXTRA NOT LIKE '%GENERATED%');
SET @role_cols = (SELECT GROUP_CONCAT(CONCAT('`', COLUMN_NAME, '`') ORDER BY ORDINAL_POSITION) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_module_roles' AND COLUMN_NAME <> 'id' AND EXTRA NOT LIKE '%GENERATED%');
SET @profile_cols = (SELECT GROUP_CONCAT(CONCAT('`', COLUMN_NAME, '`') ORDER BY ORDINAL_POSITION) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND EXTRA NOT LIKE '%GENERATED%');

-- ---------------------------------------------------------------------------------------------
-- 2. Empty the tables (ids restart at 1)
-- ---------------------------------------------------------------------------------------------
SET @t = 'users';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'user_module_roles';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'employee_profiles';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Requests & logs
SET @t = 'leave_requests';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_certificates';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_joining_reports';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_joining_certificates';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_comp_off_uses';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_balances';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'outdoor_duty_requests';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'manual_attendance_requests';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'email_outbox';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'report_runs';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'user_account_audit_logs';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'employee_mapping_log';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'master_audit_logs';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'web_sessions';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Employees (all except Administrator and Auditor, handled below)
SET @t = 'employee_photos';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'user_histories';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Master data
SET @t = 'leave_types';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_type_quotas';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_groups';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'leave_group_types';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'holidays';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'shifts';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'biometric_machines';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'designations';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'organization_units';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'categories';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'projects';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'training_courses';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'trainee_batches';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'msc_streams';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'msc_batches';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'phd_enrollments';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'lookup_values';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Settings
SET @t = 'organization_settings';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'email_settings';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'notification_recipients';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'report_schedules';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'report_schedule_recipients';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @t = 'account_settings';
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1,
              CONCAT('TRUNCATE TABLE `', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------------------------
-- 3. Put the two accounts back (id 1 Administrator, id 2 Auditor) with their roles and profiles
-- ---------------------------------------------------------------------------------------------
SET @sql = IF(@ok = 1, CONCAT('INSERT INTO users (', @user_cols, ') SELECT ', @user_cols, ' FROM keep_users ORDER BY id'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@ok = 1, CONCAT('INSERT INTO user_module_roles (', @role_cols, ') SELECT ', @role_cols, ' FROM keep_roles ORDER BY id'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@ok = 1 AND (SELECT COUNT(*) FROM keep_profiles) > 0,
              CONCAT('INSERT INTO employee_profiles (', @profile_cols, ') SELECT ', @profile_cols, ' FROM keep_profiles ORDER BY id'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- The next new employee gets id 3.
SET @sql = IF(@ok = 1, 'ALTER TABLE users AUTO_INCREMENT = 3', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------------------------
-- 4. Starting lists for the employee form (same as migrations 20261029_master_settings / 20261030_institutes)
-- ---------------------------------------------------------------------------------------------
SET @sql = IF(@ok = 1, "INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata) VALUES
  ('salutation','Mr.','Mr.',10,NULL),('salutation','Mrs.','Mrs.',20,NULL),('salutation','Ms.','Ms.',30,NULL),
  ('salutation','Miss','Miss',40,NULL),('salutation','Dr.','Dr.',50,NULL),('salutation','Prof.','Prof.',60,NULL),
  ('gender','Male','Male',10,NULL),('gender','Female','Female',20,NULL),('gender','Other','Other',30,NULL),
  ('employee_type','permanent','Permanent',10,'{\"formLayout\":\"permanent\"}'),
  ('employee_type','contractual','Contractual',20,'{\"formLayout\":\"contractual\"}'),
  ('employee_type','researcher','Project Staff',30,'{\"formLayout\":\"researcher\"}'),
  ('employee_type','diploma_trainee','Trainee',40,'{\"formLayout\":\"diploma_trainee\"}'),
  ('employee_type','bsc_msc_student','M.Sc Student',50,'{\"formLayout\":\"bsc_msc_student\"}'),
  ('employee_type','phd_student','PhD Scholar',60,'{\"formLayout\":\"phd_student\"}'),
  ('employee_type','intern','Intern',70,'{\"formLayout\":\"intern\"}'),
  ('org_unit_type','Department','Department',10,NULL),('org_unit_type','Cell','Cell',20,NULL),
  ('org_unit_type','Division','Division',30,NULL),('org_unit_type','Unit','Unit',40,NULL),('org_unit_type','Section','Section',45,NULL),('org_unit_type','Office','Office',50,NULL),('org_unit_type','Labs & Repositories','Labs & Repositories',52,NULL),('org_unit_type','Library','Library',55,NULL),('org_unit_type','National Centers','National Centers',57,NULL),('org_unit_type','Other','Other',60,NULL),
  ('cadre_group','Cadre A','Cadre A (Administrative)',10,NULL),('cadre_group','Research Cadre','Research Cadre (Scientific)',20,NULL),
  ('cadre_group','Technical Staff','Technical Staff',30,NULL),('cadre_group','Faculty / Student','Faculty / Student (Academic)',40,NULL),
  ('cadre_group','Support Staff','Support Staff',50,NULL),
  ('funding_category','National Fellowship','National Fellowship (UGC/CSIR)',10,NULL),
  ('funding_category','Govt Grant','Govt Grant (DST/DBT)',20,NULL),('funding_category','Institutional','Institutional (WII Fellowship)',30,NULL),
  ('funding_category','Project Grant','Project Grant',40,NULL),('funding_category','Self / External','Self / External Sponsored',50,NULL),
  ('institute','WII','Wildlife Institute of India',10,NULL),('institute','SACON','WII - SACON',20,NULL)", 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
DROP TEMPORARY TABLE IF EXISTS keep_users, keep_roles, keep_profiles;

-- ---------------------------------------------------------------------------------------------
-- 5. Result: expect users 1 Administrator and 2 Auditor, and 0 rows in the emptied tables
-- ---------------------------------------------------------------------------------------------
SELECT id, biometric_id, name, email, status FROM users ORDER BY id;
SELECT biometric_id, module_id, role_id, status FROM user_module_roles ORDER BY id;
SELECT 'leave_requests' AS table_name, COUNT(*) AS rows_left FROM leave_requests
UNION ALL SELECT 'outdoor_duty_requests', COUNT(*) FROM outdoor_duty_requests
UNION ALL SELECT 'manual_attendance_requests', COUNT(*) FROM manual_attendance_requests
UNION ALL SELECT 'leave_types', COUNT(*) FROM leave_types
UNION ALL SELECT 'holidays', COUNT(*) FROM holidays
UNION ALL SELECT 'employee_profiles', COUNT(*) FROM employee_profiles
UNION ALL SELECT 'lookup_values (starting lists)', COUNT(*) FROM lookup_values
UNION ALL SELECT 'role_catalog (kept)', COUNT(*) FROM role_catalog
UNION ALL SELECT 'Attendance (kept)', COUNT(*) FROM `Attendance`;
