-- =============================================================================================
-- Normalization, step 3 of 6: master fields in their own columns, with foreign keys
-- =============================================================================================
-- The extra fields of the profile masters were kept as JSON text in a `metadata` column. Each now has a column:
--   designations        employee_type_code → employee_types, cadre_code → cadres
--   categories          cadre_group_code → cadre_groups
--   projects            pi_name
--   trainee_batches     training_course_name → training_courses(name), validity
--   msc_batches         msc_stream_name → msc_streams(name), validity
--   phd_enrollments     funding_category_code → funding_categories
--   organization_units  type → org_unit_types(code), institute → institutes(code); the optional employee-type /
--                       cadre limits (comma lists in metadata) move to org_unit_employee_types / org_unit_cadres
-- Masters referred to by name refuse a rename or delete while used (as the screens already do); codes of
-- employee types follow a change (ON UPDATE CASCADE), as the screen already did by hand.
-- The metadata columns are removed once their values are copied. Safe to run again.
-- =============================================================================================

-- Text of a metadata key ('' when missing)
DROP FUNCTION IF EXISTS lams_meta;
DELIMITER $$
CREATE FUNCTION lams_meta(doc LONGTEXT, k VARCHAR(64)) RETURNS VARCHAR(500) DETERMINISTIC
BEGIN
  IF doc IS NULL OR NOT JSON_VALID(doc) THEN RETURN NULL; END IF;
  RETURN NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(doc, CONCAT('$.', k)))), 'null'), '');
END$$
DELIMITER ;

-- ---------------------------------------------------------------------------------------------
-- designations
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('designations', 'employee_type_code'), 'ALTER TABLE designations ADD COLUMN employee_type_code VARCHAR(50) NULL AFTER code');
CALL lams_exec_if(NOT lams_has_column('designations', 'cadre_code'), 'ALTER TABLE designations ADD COLUMN cadre_code VARCHAR(100) NULL AFTER employee_type_code');
CALL lams_exec_if(lams_has_column('designations', 'metadata'),
  'UPDATE designations SET employee_type_code = COALESCE(employee_type_code, lams_meta(metadata, ''empType'')), cadre_code = COALESCE(cadre_code, LEFT(lams_meta(metadata, ''cadre''), 100))');
CALL lams_assert((SELECT COUNT(*) FROM designations d LEFT JOIN employee_types t ON t.code = d.employee_type_code WHERE d.employee_type_code IS NOT NULL AND t.id IS NULL) = 0,
  'A designation names an employee type that is not in Employee Types. Fix it in Master Settings, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('designations', 'fk_designations_employee_type'),
  'ALTER TABLE designations ADD CONSTRAINT fk_designations_employee_type FOREIGN KEY (employee_type_code) REFERENCES employee_types (code) ON UPDATE CASCADE');
CALL lams_exec_if(NOT lams_has_fk('designations', 'fk_designations_cadre'),
  'ALTER TABLE designations ADD CONSTRAINT fk_designations_cadre FOREIGN KEY (cadre_code) REFERENCES cadres (code) ON UPDATE CASCADE');
CALL lams_exec_if(lams_has_column('designations', 'metadata'), 'ALTER TABLE designations DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('categories', 'cadre_group_code'), 'ALTER TABLE categories ADD COLUMN cadre_group_code VARCHAR(50) NULL AFTER code');
CALL lams_exec_if(lams_has_column('categories', 'metadata'),
  'UPDATE categories SET cadre_group_code = COALESCE(cadre_group_code, lams_meta(metadata, ''group''))');
CALL lams_assert((SELECT COUNT(*) FROM categories c LEFT JOIN cadre_groups g ON g.code = c.cadre_group_code WHERE c.cadre_group_code IS NOT NULL AND g.id IS NULL) = 0,
  'An employee category names a cadre group that is not in Cadre Groups. Fix it, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('categories', 'fk_categories_cadre_group'),
  'ALTER TABLE categories ADD CONSTRAINT fk_categories_cadre_group FOREIGN KEY (cadre_group_code) REFERENCES cadre_groups (code)');
CALL lams_exec_if(lams_has_column('categories', 'metadata'), 'ALTER TABLE categories DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- projects (PI)
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('projects', 'pi_name'), 'ALTER TABLE projects ADD COLUMN pi_name VARCHAR(255) NULL AFTER code');
CALL lams_exec_if(lams_has_column('projects', 'metadata'),
  'UPDATE projects SET pi_name = COALESCE(pi_name, LEFT(lams_meta(metadata, ''pi''), 255))');
CALL lams_exec_if(lams_has_column('projects', 'metadata'), 'ALTER TABLE projects DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- training courses / M.Sc streams (no extra fields)
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(lams_has_column('training_courses', 'metadata'), 'ALTER TABLE training_courses DROP COLUMN metadata');
CALL lams_exec_if(lams_has_column('msc_streams', 'metadata'), 'ALTER TABLE msc_streams DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- trainee batches → course; M.Sc batches → stream
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('trainee_batches', 'training_course_name'), 'ALTER TABLE trainee_batches ADD COLUMN training_course_name VARCHAR(255) NULL AFTER code');
CALL lams_exec_if(NOT lams_has_column('trainee_batches', 'validity'), 'ALTER TABLE trainee_batches ADD COLUMN validity VARCHAR(50) NULL AFTER training_course_name');
CALL lams_exec_if(lams_has_column('trainee_batches', 'metadata'),
  'UPDATE trainee_batches SET training_course_name = COALESCE(training_course_name, LEFT(lams_meta(metadata, ''parentCourse''), 255)), validity = COALESCE(validity, LEFT(lams_meta(metadata, ''validity''), 50))');
CALL lams_assert((SELECT COUNT(*) FROM trainee_batches b LEFT JOIN training_courses c ON c.name = b.training_course_name WHERE b.training_course_name IS NOT NULL AND c.id IS NULL) = 0,
  'A training batch names a course that is not in Training Courses. Fix it, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('trainee_batches', 'fk_trainee_batches_course'),
  'ALTER TABLE trainee_batches ADD CONSTRAINT fk_trainee_batches_course FOREIGN KEY (training_course_name) REFERENCES training_courses (name)');
CALL lams_exec_if(lams_has_column('trainee_batches', 'metadata'), 'ALTER TABLE trainee_batches DROP COLUMN metadata');

CALL lams_exec_if(NOT lams_has_column('msc_batches', 'msc_stream_name'), 'ALTER TABLE msc_batches ADD COLUMN msc_stream_name VARCHAR(255) NULL AFTER code');
CALL lams_exec_if(NOT lams_has_column('msc_batches', 'validity'), 'ALTER TABLE msc_batches ADD COLUMN validity VARCHAR(50) NULL AFTER msc_stream_name');
CALL lams_exec_if(lams_has_column('msc_batches', 'metadata'),
  'UPDATE msc_batches SET msc_stream_name = COALESCE(msc_stream_name, LEFT(lams_meta(metadata, ''parentStream''), 255)), validity = COALESCE(validity, LEFT(lams_meta(metadata, ''validity''), 50))');
CALL lams_assert((SELECT COUNT(*) FROM msc_batches b LEFT JOIN msc_streams s ON s.name = b.msc_stream_name WHERE b.msc_stream_name IS NOT NULL AND s.id IS NULL) = 0,
  'An M.Sc batch names a stream that is not in M.Sc Streams. Fix it, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('msc_batches', 'fk_msc_batches_stream'),
  'ALTER TABLE msc_batches ADD CONSTRAINT fk_msc_batches_stream FOREIGN KEY (msc_stream_name) REFERENCES msc_streams (name)');
CALL lams_exec_if(lams_has_column('msc_batches', 'metadata'), 'ALTER TABLE msc_batches DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- PhD enrollment → funding category
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('phd_enrollments', 'funding_category_code'), 'ALTER TABLE phd_enrollments ADD COLUMN funding_category_code VARCHAR(50) NULL AFTER code');
CALL lams_exec_if(lams_has_column('phd_enrollments', 'metadata'),
  'UPDATE phd_enrollments SET funding_category_code = COALESCE(funding_category_code, lams_meta(metadata, ''category''))');
CALL lams_assert((SELECT COUNT(*) FROM phd_enrollments e LEFT JOIN funding_categories f ON f.code = e.funding_category_code WHERE e.funding_category_code IS NOT NULL AND f.id IS NULL) = 0,
  'A PhD enrollment source names a funding category that is not in Funding Categories. Fix it, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('phd_enrollments', 'fk_phd_enrollments_funding'),
  'ALTER TABLE phd_enrollments ADD CONSTRAINT fk_phd_enrollments_funding FOREIGN KEY (funding_category_code) REFERENCES funding_categories (code)');
CALL lams_exec_if(lams_has_column('phd_enrollments', 'metadata'), 'ALTER TABLE phd_enrollments DROP COLUMN metadata');

-- ---------------------------------------------------------------------------------------------
-- organization units → type, institute; optional limits → junction tables
-- ---------------------------------------------------------------------------------------------
CALL lams_assert((SELECT COUNT(*) FROM organization_units u LEFT JOIN org_unit_types t ON t.code = u.type WHERE t.id IS NULL) = 0,
  'An institute unit has a type that is not in Organization Unit Types. Fix it in Master Settings, then run this file again.');
CALL lams_assert((SELECT COUNT(*) FROM organization_units u LEFT JOIN institutes i ON i.code = u.institute WHERE u.institute IS NOT NULL AND i.id IS NULL) = 0,
  'An institute unit belongs to an institute that is not in Institutes. Fix it in Master Settings, then run this file again.');
CALL lams_exec_if(lams_col_type('organization_units', 'type') <> 'varchar(50)' OR (SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_units' AND COLUMN_NAME = 'type') IS NOT NULL,
  'ALTER TABLE organization_units MODIFY COLUMN type VARCHAR(50) NOT NULL');
CALL lams_exec_if(NOT lams_has_fk('organization_units', 'fk_org_units_type'),
  'ALTER TABLE organization_units ADD CONSTRAINT fk_org_units_type FOREIGN KEY (type) REFERENCES org_unit_types (code)');
CALL lams_exec_if(NOT lams_has_fk('organization_units', 'fk_org_units_institute'),
  'ALTER TABLE organization_units ADD CONSTRAINT fk_org_units_institute FOREIGN KEY (institute) REFERENCES institutes (code)');

CREATE TABLE IF NOT EXISTS org_unit_employee_types (
  org_unit_id BIGINT UNSIGNED NOT NULL,
  employee_type_code VARCHAR(50) NOT NULL,
  PRIMARY KEY (org_unit_id, employee_type_code),
  KEY idx_org_unit_employee_types_type (employee_type_code),
  CONSTRAINT fk_org_unit_employee_types_unit FOREIGN KEY (org_unit_id) REFERENCES organization_units (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_unit_employee_types_type FOREIGN KEY (employee_type_code) REFERENCES employee_types (code) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS org_unit_cadres (
  org_unit_id BIGINT UNSIGNED NOT NULL,
  cadre_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (org_unit_id, cadre_code),
  KEY idx_org_unit_cadres_cadre (cadre_code),
  CONSTRAINT fk_org_unit_cadres_unit FOREIGN KEY (org_unit_id) REFERENCES organization_units (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_unit_cadres_cadre FOREIGN KEY (cadre_code) REFERENCES cadres (code) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Split "a,b,c" (up to 20 values) into rows
CALL lams_exec_if(lams_has_column('organization_units', 'metadata'),
  'INSERT IGNORE INTO org_unit_employee_types (org_unit_id, employee_type_code)
   SELECT u.id, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(lams_meta(u.metadata, ''empTypes''), '','', n.n), '','', -1))
     FROM organization_units u
     JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
           UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20) n
       ON n.n <= 1 + CHAR_LENGTH(lams_meta(u.metadata, ''empTypes'')) - CHAR_LENGTH(REPLACE(lams_meta(u.metadata, ''empTypes''), '','', ''''))
     JOIN employee_types t ON t.code = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(lams_meta(u.metadata, ''empTypes''), '','', n.n), '','', -1))
    WHERE lams_meta(u.metadata, ''empTypes'') IS NOT NULL');
CALL lams_exec_if(lams_has_column('organization_units', 'metadata'),
  'INSERT IGNORE INTO org_unit_cadres (org_unit_id, cadre_code)
   SELECT u.id, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(lams_meta(u.metadata, ''cadres''), '','', n.n), '','', -1))
     FROM organization_units u
     JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
           UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20) n
       ON n.n <= 1 + CHAR_LENGTH(lams_meta(u.metadata, ''cadres'')) - CHAR_LENGTH(REPLACE(lams_meta(u.metadata, ''cadres''), '','', ''''))
     JOIN cadres c ON c.code = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(lams_meta(u.metadata, ''cadres''), '','', n.n), '','', -1))
    WHERE lams_meta(u.metadata, ''cadres'') IS NOT NULL');
CALL lams_exec_if(lams_has_column('organization_units', 'metadata'), 'ALTER TABLE organization_units DROP COLUMN metadata');

SELECT 'step 3 of 6 done: master fields in columns' AS normalization;
