-- Migration: institutes (Wildlife Institute of India, WII - SACON).
-- Safe to re-run.
--
--   lookup_values 'institute'        the institutes; managed in Master Settings -> Profile Masters
--   organization_units.institute     which institute a department / cell belongs to (institute code)
--   employee_profiles.institute      which institute an employee belongs to (replaces "office location"
--                                    on the form; the old office_location column is kept untouched)

INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata) VALUES
  ('institute', 'WII',   'Wildlife Institute of India', 10, NULL),
  ('institute', 'SACON', 'WII - SACON',                 20, NULL);

-- organization_units.institute
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_units' AND COLUMN_NAME = 'institute'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE organization_units ADD COLUMN institute VARCHAR(50) NULL AFTER type',
  'SELECT ''organization_units.institute already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- employee_profiles.institute
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'institute'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE employee_profiles ADD COLUMN institute VARCHAR(50) NULL AFTER office_location',
  'SELECT ''employee_profiles.institute already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing units belong to WII until an administrator says otherwise.
UPDATE organization_units SET institute = 'WII' WHERE institute IS NULL OR institute = '';

-- Existing employees: SACON staff are recognised from their old office location; the rest are WII.
UPDATE employee_profiles SET institute = 'SACON'
 WHERE (institute IS NULL OR institute = '') AND (office_location LIKE '%SACON%' OR office_location LIKE '%Coimbatore%');
UPDATE employee_profiles SET institute = 'WII'
 WHERE institute IS NULL OR institute = '';
