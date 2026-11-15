-- Retire legacy tables that the application no longer reads or writes.
--
--   sessions                      replaced by web_sessions (express-session store)
--   shift_master_audit_logs       rows copied into master_audit_logs by 20261029_master_settings.sql
--   biometric_machine_audit_logs  rows copied into master_audit_logs by 20261029_master_settings.sql
--   organization_unit_audit_logs  rows copied into master_audit_logs by 20261029_master_settings.sql
--   profile_master_records        rows copied into the dedicated master tables by 0007_dedicated_profile_master_tables.sql
--   attendance (lower-case)       old empty punch table. NOT `Attendance` (capital A), which the vendor export
--                                 writes and the Attendance page reads; names are compared exactly (BINARY).
--   user_logs                     old activity log, empty; activity now goes to user_account_audit_logs
--   __drizzle_migrations          drizzle-kit's tracking table; migrations are run by hand from migrations/
--
-- Each of these is renamed ONLY if it is empty on the day you run this (row count checked first),
-- except the audit-log tables above, whose rows were copied forward.
--
-- NOTHING IS DELETED. Each table is only RENAMED to zz_retired_<name>, so it can be put back with
--   RENAME TABLE zz_retired_<name> TO <name>;
-- Drop the zz_retired_ tables yourself after a few weeks, once nothing has been missed.
--
-- Before running:
--   1. Take a backup:  mysqldump -u lams2_admin -p lams2_db > lams2_db_before_20261212.sql
--   2. Run the read-only audit:  npm run db:audit   (it lists these tables and their row counts)
--   3. Check below that every old audit row was copied (the "missing" counts must be 0).
-- Run once as lams2_admin (safe to run again):
--   mysql> source /full/path/to/migrations/20261212_retire_legacy_tables.sql

-- ---------------------------------------------------------------------------
-- Check: old audit rows not yet copied into master_audit_logs (expected 0 each).
-- If a table does not exist the statement errors; that table is simply skipped below.
-- ---------------------------------------------------------------------------
SELECT 'shift_master_audit_logs' AS legacy_table, COUNT(*) AS missing
  FROM shift_master_audit_logs l LEFT JOIN master_audit_logs m ON m.legacy_ref = CONCAT('shift:', l.id) WHERE m.id IS NULL;
SELECT 'biometric_machine_audit_logs' AS legacy_table, COUNT(*) AS missing
  FROM biometric_machine_audit_logs l LEFT JOIN master_audit_logs m ON m.legacy_ref = CONCAT('biometric:', l.id) WHERE m.id IS NULL;
SELECT 'organization_unit_audit_logs' AS legacy_table, COUNT(*) AS missing
  FROM organization_unit_audit_logs l LEFT JOIN master_audit_logs m ON m.legacy_ref = CONCAT('org_unit:', l.id) WHERE m.id IS NULL;

-- ---------------------------------------------------------------------------
-- Rename (only tables that exist and are not already retired).
-- ---------------------------------------------------------------------------
SET @t = 'sessions';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1
              AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t)) = 0,
              CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'shift_master_audit_logs';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1
              AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t)) = 0,
              CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'biometric_machine_audit_logs';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1
              AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t)) = 0,
              CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'organization_unit_audit_logs';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1
              AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t)) = 0,
              CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'profile_master_records';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t) = 1
              AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t)) = 0,
              CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Empty-only tables (kept if they hold any row).

SET @t = 'attendance';
SET @exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t);
SET @retired = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t));
SET @sql = IF(@exists = 1 AND @retired = 0, CONCAT('SELECT COUNT(*) INTO @rows FROM `', @t, '`'), 'SET @rows = -1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rows = 0, CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT @t AS legacy_table, @rows AS rows_found, IF(@rows = 0, 'renamed', 'kept') AS result;

SET @t = 'user_logs';
SET @exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t);
SET @retired = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t));
SET @sql = IF(@exists = 1 AND @retired = 0, CONCAT('SELECT COUNT(*) INTO @rows FROM `', @t, '`'), 'SET @rows = -1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rows = 0, CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT @t AS legacy_table, @rows AS rows_found, IF(@rows = 0, 'renamed', 'kept') AS result;

-- drizzle-kit tracking table (a row per migration it ran; never read by the app).

SET @t = '__drizzle_migrations';
SET @exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY @t);
SET @retired = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY CONCAT('zz_retired_', @t));
SET @sql = IF(@exists = 1 AND @retired = 0, CONCAT('SELECT COUNT(*) INTO @rows FROM `', @t, '`'), 'SET @rows = -1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rows >= 0, CONCAT('RENAME TABLE `', @t, '` TO `zz_retired_', @t, '`'), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT @t AS legacy_table, @rows AS rows_found, IF(@rows >= 0, 'renamed', 'kept') AS result;

SELECT TABLE_NAME AS retired_table FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'zz_retired_%';
