-- =============================================================================================
-- Designations: the same name once per employment type
-- =============================================================================================
-- One designations table for HRMS and PMS. A name may now be used once per employment type, so PMS can have
-- "Technical Assistant" for Project Staff while HRMS keeps "Technical Assistant" for Permanent staff.
--   * unique key on name  →  unique key on (name, employee_type_code); a plain index on name stays for lookups;
--   * the foreign key employee_profiles.designation_name → designations(name) is dropped (a foreign key needs a
--     unique name). The app keeps checking that a profile's designation exists and fits the employee's type
--     (server/employees/references.ts, server/masters/store.ts).
-- No row is changed or deleted. Safe to run again. Run after a backup, with the app stopped.
-- =============================================================================================

DROP PROCEDURE IF EXISTS lams_designation_per_type;
DELIMITER $$
CREATE PROCEDURE lams_designation_per_type()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles'
              AND CONSTRAINT_NAME = 'fk_profiles_designation' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
    ALTER TABLE employee_profiles DROP FOREIGN KEY fk_profiles_designation;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'designations' AND INDEX_NAME = 'uq_designations_name_type') THEN
    ALTER TABLE designations ADD UNIQUE KEY uq_designations_name_type (name, employee_type_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'designations' AND INDEX_NAME = 'designations_name_idx') THEN
    ALTER TABLE designations ADD KEY designations_name_idx (name);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'designations' AND INDEX_NAME = 'uq_designations_name') THEN
    ALTER TABLE designations DROP INDEX uq_designations_name;
  END IF;
END$$
DELIMITER ;
CALL lams_designation_per_type();
DROP PROCEDURE lams_designation_per_type;

SELECT GROUP_CONCAT(DISTINCT INDEX_NAME ORDER BY INDEX_NAME) AS designation_indexes
  FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'designations';
