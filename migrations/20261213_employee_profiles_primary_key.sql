-- employee_profiles has no PRIMARY KEY on the live database: `id` carries only a UNIQUE key named `id`.
-- (schema.ts declares id as the primary key; biometric_id is already UNIQUE and has no duplicates.)
-- InnoDB then uses a hidden row id for the clustered index, and tools that need a primary key
-- (replication, some backup / diff tools) treat the table as keyless.
--
-- This turns the existing unique `id` into the PRIMARY KEY in one statement. No data changes,
-- no row is touched. Safe to run again (it does nothing once the primary key exists).
--
-- Before running: mysqldump -u lams2_admin -p lams2_db employee_profiles > employee_profiles_before_pk.sql
-- Run as lams2_admin:  mysql> source /full/path/to/migrations/20261213_employee_profiles_primary_key.sql

-- Must return no rows (no duplicate or empty ids); otherwise stop and report.
SELECT id, COUNT(*) AS copies FROM employee_profiles GROUP BY id HAVING COUNT(*) > 1 OR id IS NULL;

SET @has_pk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND CONSTRAINT_TYPE = 'PRIMARY KEY');
SET @has_id_key = (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND INDEX_NAME = 'id');
SET @sql = CASE
  WHEN @has_pk = 1 THEN 'DO 0'
  WHEN @has_id_key > 0 THEN 'ALTER TABLE employee_profiles DROP INDEX `id`, ADD PRIMARY KEY (`id`)'
  ELSE 'ALTER TABLE employee_profiles ADD PRIMARY KEY (`id`)'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Expect: one PRIMARY row on `id`, plus employee_profiles_biometric_id_unique.
SHOW INDEX FROM employee_profiles WHERE Key_name IN ('PRIMARY', 'employee_profiles_biometric_id_unique');
