-- =============================================================================================
-- Normalization, step 1 of 6: one collation, correct column types, keys
-- =============================================================================================
-- * Every table (except the zz_retired_* ones) uses utf8mb4 / utf8mb4_0900_ai_ci, so text keys can be joined and
--   referenced by foreign keys across tables.
-- * Dates and times get DATE / TIME columns: employee_profiles.joining_date, shift times, manual-attendance and
--   outdoor-duty times, report send time. employee_profiles.shift_id becomes a number like shifts.id.
-- * Biometric IDs are CHAR(4) everywhere they identify an employee.
-- * Duplicate unique keys on users.id and organization_units.id are removed (the primary key already is one).
-- * shifts.code and the names of the profile masters become UNIQUE (the screens already refuse duplicates).
--
-- Order: run the six 20261219_0*.sql files one after another, as root, app stopped, after a backup:
--   mysqldump --no-tablespaces --skip-lock-tables -u root -p lams2_db > ~/backup_before_normalization.sql
--   for f in migrations/20261219_0*.sql; do mysql -u root -p lams2_db < "$f" || break; done
-- (scripts/run-normalization.sh does exactly this and stops at the first problem.)
-- Each file is safe to run again. If a check fails, nothing after it runs; the message says what to fix.
-- =============================================================================================

DROP PROCEDURE IF EXISTS lams_assert;
DELIMITER $$
CREATE PROCEDURE lams_assert(IN ok BOOLEAN, IN message VARCHAR(500))
BEGIN
  IF NOT ok THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = message;
  END IF;
END$$

-- Converts every application table that is not yet utf8mb4_0900_ai_ci (table default or any column).
DROP PROCEDURE IF EXISTS lams_convert_collation$$
CREATE PROCEDURE lams_convert_collation()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE t VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT DISTINCT x.TABLE_NAME FROM (
      SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
      UNION
      SELECT TABLE_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> 'utf8mb4_0900_ai_ci'
    ) x
    JOIN information_schema.TABLES bt ON bt.TABLE_SCHEMA = DATABASE() AND bt.TABLE_NAME = x.TABLE_NAME AND bt.TABLE_TYPE = 'BASE TABLE'
    WHERE x.TABLE_NAME NOT LIKE 'zz\_retired%';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  next_table: LOOP
    FETCH cur INTO t;
    IF done THEN LEAVE next_table; END IF;
    SET @ddl = CONCAT('ALTER TABLE `', t, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
    PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
  END LOOP;
  CLOSE cur;
END$$

-- Runs a statement only when a condition holds (keeps every step re-runnable).
DROP PROCEDURE IF EXISTS lams_exec_if$$
CREATE PROCEDURE lams_exec_if(IN cond BOOLEAN, IN stmt TEXT)
BEGIN
  IF cond THEN
    SET @ddl = stmt;
    PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END$$
DELIMITER ;

-- Helpers used below and by the next files
DROP FUNCTION IF EXISTS lams_col_type;
DELIMITER $$
CREATE FUNCTION lams_col_type(t VARCHAR(64), c VARCHAR(64)) RETURNS VARCHAR(200) READS SQL DATA
BEGIN
  RETURN (SELECT LOWER(COLUMN_TYPE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND COLUMN_NAME = c);
END$$
DROP FUNCTION IF EXISTS lams_has_index$$
CREATE FUNCTION lams_has_index(t VARCHAR(64), i VARCHAR(64)) RETURNS BOOLEAN READS SQL DATA
BEGIN
  RETURN (SELECT COUNT(*) > 0 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND INDEX_NAME = i);
END$$
DROP FUNCTION IF EXISTS lams_has_table$$
CREATE FUNCTION lams_has_table(t VARCHAR(64)) RETURNS BOOLEAN READS SQL DATA
BEGIN
  RETURN (SELECT COUNT(*) > 0 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY t);
END$$
DROP FUNCTION IF EXISTS lams_has_column$$
CREATE FUNCTION lams_has_column(t VARCHAR(64), c VARCHAR(64)) RETURNS BOOLEAN READS SQL DATA
BEGIN
  RETURN (SELECT COUNT(*) > 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND COLUMN_NAME = c);
END$$
DROP FUNCTION IF EXISTS lams_has_fk$$
CREATE FUNCTION lams_has_fk(t VARCHAR(64), f VARCHAR(64)) RETURNS BOOLEAN READS SQL DATA
BEGIN
  RETURN (SELECT COUNT(*) > 0 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND CONSTRAINT_NAME = f AND CONSTRAINT_TYPE = 'FOREIGN KEY');
END$$
DELIMITER ;

-- ---------------------------------------------------------------------------------------------
-- 0. Checks first (nothing is changed if one fails)
-- ---------------------------------------------------------------------------------------------
CALL lams_assert(
  lams_col_type('employee_profiles', 'joining_date') = 'date'
  OR (SELECT COUNT(*) FROM employee_profiles WHERE joining_date NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR STR_TO_DATE(joining_date, '%Y-%m-%d') IS NULL) = 0,
  'employee_profiles.joining_date has values that are not dates (YYYY-MM-DD). Fix them, then run this file again.');
CALL lams_assert(
  lams_col_type('employee_profiles', 'shift_id') LIKE 'bigint%'
  OR (SELECT COUNT(*) FROM employee_profiles WHERE shift_id IS NOT NULL AND shift_id <> '' AND shift_id NOT REGEXP '^[0-9]{1,18}$') = 0,
  'employee_profiles.shift_id has values that are not shift numbers. Fix them, then run this file again.');
CALL lams_assert(
  (SELECT COUNT(*) FROM (SELECT code FROM shifts GROUP BY code HAVING COUNT(*) > 1) d) = 0,
  'Two shifts have the same code. Give each shift its own code, then run this file again.');
CALL lams_assert(
  lams_col_type('shifts', 'start_time') = 'time'
  OR (SELECT COUNT(*) FROM shifts WHERE start_time NOT REGEXP '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$' OR end_time NOT REGEXP '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$') = 0,
  'shifts.start_time / end_time have values that are not times (HH:MM). Fix them, then run this file again.');

-- ---------------------------------------------------------------------------------------------
-- 1. One collation everywhere
-- ---------------------------------------------------------------------------------------------
CALL lams_convert_collation();

-- ---------------------------------------------------------------------------------------------
-- 2. Column types
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(lams_col_type('employee_profiles', 'joining_date') <> 'date',
  'ALTER TABLE employee_profiles MODIFY COLUMN joining_date DATE NOT NULL');

UPDATE employee_profiles SET shift_id = NULL WHERE shift_id = '';
CALL lams_exec_if(lams_col_type('employee_profiles', 'shift_id') NOT LIKE 'bigint%',
  'ALTER TABLE employee_profiles MODIFY COLUMN shift_id BIGINT UNSIGNED NULL');

CALL lams_exec_if(lams_col_type('shifts', 'start_time') <> 'time',
  'ALTER TABLE shifts MODIFY COLUMN start_time TIME NOT NULL, MODIFY COLUMN end_time TIME NOT NULL');

UPDATE manual_attendance_requests SET original_in = NULL WHERE original_in = '';
UPDATE manual_attendance_requests SET original_out = NULL WHERE original_out = '';
CALL lams_exec_if(lams_col_type('manual_attendance_requests', 'in_time') <> 'time',
  'ALTER TABLE manual_attendance_requests MODIFY COLUMN in_time TIME NOT NULL, MODIFY COLUMN out_time TIME NOT NULL, MODIFY COLUMN original_in TIME NULL, MODIFY COLUMN original_out TIME NULL');

CALL lams_exec_if(lams_col_type('outdoor_duty_requests', 'start_time') <> 'time',
  'ALTER TABLE outdoor_duty_requests MODIFY COLUMN start_time TIME NOT NULL, MODIFY COLUMN end_time TIME NOT NULL');

CALL lams_exec_if(lams_col_type('report_schedules', 'send_time') <> 'time',
  'ALTER TABLE report_schedules MODIFY COLUMN send_time TIME NOT NULL');

-- (20261224 widens biometric IDs to VARCHAR(10); that is left as it is.)
CALL lams_exec_if(lams_col_type('employee_photos', 'biometric_id') NOT IN ('char(4)', 'varchar(10)'),
  'ALTER TABLE employee_photos MODIFY COLUMN biometric_id CHAR(4) NOT NULL');
-- (20261224 widens biometric IDs to VARCHAR(10); that is left as it is.)
CALL lams_exec_if(lams_col_type('user_histories', 'biometric_id') NOT IN ('char(4)', 'varchar(10)'),
  'ALTER TABLE user_histories MODIFY COLUMN biometric_id CHAR(4) NOT NULL');

-- ---------------------------------------------------------------------------------------------
-- 3. Keys
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(lams_has_index('users', 'new_id'), 'ALTER TABLE users DROP INDEX new_id');
CALL lams_exec_if(lams_has_index('organization_units', 'id_new'), 'ALTER TABLE organization_units DROP INDEX id_new');
CALL lams_exec_if(NOT lams_has_index('shifts', 'uq_shifts_code'), 'ALTER TABLE shifts ADD UNIQUE KEY uq_shifts_code (code)');

-- Profile masters are referred to by name; the screens already keep names unique (any letter case).
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM organization_units GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two institute units have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM designations GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two designations have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM categories GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two employee categories have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM projects GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two projects have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM training_courses GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two training courses have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM trainee_batches GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two training batches have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM msc_streams GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two M.Sc streams have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM msc_batches GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two M.Sc batches have the same name. Rename one, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM (SELECT name FROM phd_enrollments GROUP BY name HAVING COUNT(*) > 1) d) = 0, 'Two PhD enrollment sources have the same name. Rename one, then run this file again.');
CALL lams_exec_if(NOT lams_has_index('organization_units', 'uq_organization_units_name'), 'ALTER TABLE organization_units ADD UNIQUE KEY uq_organization_units_name (name)');
CALL lams_exec_if(NOT lams_has_index('designations', 'uq_designations_name'), 'ALTER TABLE designations ADD UNIQUE KEY uq_designations_name (name)');
CALL lams_exec_if(NOT lams_has_index('categories', 'uq_categories_name'), 'ALTER TABLE categories ADD UNIQUE KEY uq_categories_name (name)');
CALL lams_exec_if(NOT lams_has_index('projects', 'uq_projects_name'), 'ALTER TABLE projects ADD UNIQUE KEY uq_projects_name (name)');
CALL lams_exec_if(NOT lams_has_index('training_courses', 'uq_training_courses_name'), 'ALTER TABLE training_courses ADD UNIQUE KEY uq_training_courses_name (name)');
CALL lams_exec_if(NOT lams_has_index('trainee_batches', 'uq_trainee_batches_name'), 'ALTER TABLE trainee_batches ADD UNIQUE KEY uq_trainee_batches_name (name)');
CALL lams_exec_if(NOT lams_has_index('msc_streams', 'uq_msc_streams_name'), 'ALTER TABLE msc_streams ADD UNIQUE KEY uq_msc_streams_name (name)');
CALL lams_exec_if(NOT lams_has_index('msc_batches', 'uq_msc_batches_name'), 'ALTER TABLE msc_batches ADD UNIQUE KEY uq_msc_batches_name (name)');
CALL lams_exec_if(NOT lams_has_index('phd_enrollments', 'uq_phd_enrollments_name'), 'ALTER TABLE phd_enrollments ADD UNIQUE KEY uq_phd_enrollments_name (name)');

SELECT 'step 1 of 6 done: collation, types, keys' AS normalization;
