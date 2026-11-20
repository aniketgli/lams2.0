-- =============================================================================================
-- Normalization, step 5 of 6: lists kept in one column become tables
-- =============================================================================================
--   leave_types.employee_types ("permanent,contractual")  → leave_type_employee_types
--   leave_types.purposes (one per line)                    → leave_type_purposes
--   shifts.applicable_days (JSON array)                    → shift_days
--   role_catalog.aliases ("admin,hrms_admin")              → role_aliases
--   report_schedules.formats ("csv,pdf")                   → send_csv / send_pdf
--   leave_type_quotas.employee_type                        → foreign key to employee_types
-- Values are copied, then the old columns are removed. Safe to run again.
-- =============================================================================================

-- Numbers 1..50 for splitting lists
DROP TEMPORARY TABLE IF EXISTS lams_n;
CREATE TEMPORARY TABLE lams_n (n INT PRIMARY KEY);
INSERT INTO lams_n (n) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
  (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
  (41),(42),(43),(44),(45),(46),(47),(48),(49),(50);

-- ---------------------------------------------------------------------------------------------
-- Leave types: employee types they are for (none listed = every type)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_type_employee_types (
  leave_type_id BIGINT UNSIGNED NOT NULL,
  employee_type_code VARCHAR(50) NOT NULL,
  PRIMARY KEY (leave_type_id, employee_type_code),
  KEY idx_leave_type_employee_types_type (employee_type_code),
  CONSTRAINT fk_ltet_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE,
  CONSTRAINT fk_ltet_employee_type FOREIGN KEY (employee_type_code) REFERENCES employee_types (code) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CALL lams_exec_if(lams_has_column('leave_types', 'employee_types'),
  'INSERT IGNORE INTO leave_type_employee_types (leave_type_id, employee_type_code)
   SELECT l.id, t.code FROM leave_types l
     JOIN lams_n n ON n.n <= 1 + CHAR_LENGTH(l.employee_types) - CHAR_LENGTH(REPLACE(l.employee_types, '','', ''''))
     JOIN employee_types t ON t.code = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(l.employee_types, '','', n.n), '','', -1))
    WHERE TRIM(l.employee_types) <> ''''');
CALL lams_exec_if(lams_has_column('leave_types', 'employee_types'), 'ALTER TABLE leave_types DROP COLUMN employee_types');

-- ---------------------------------------------------------------------------------------------
-- Leave types: purposes (Special Casual Leave …)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_type_purposes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  purpose VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_type_purpose (leave_type_id, purpose),
  KEY idx_leave_type_purposes_order (leave_type_id, sort_order),
  CONSTRAINT fk_leave_type_purposes_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CALL lams_exec_if(lams_has_column('leave_types', 'purposes'),
  'INSERT IGNORE INTO leave_type_purposes (leave_type_id, sort_order, purpose)
   SELECT l.id, n.n, LEFT(TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(l.purposes, CHAR(13), ''''), CHAR(10), n.n), CHAR(10), -1), ''  '', '' '')), 150)
     FROM leave_types l
     JOIN lams_n n ON n.n <= 1 + CHAR_LENGTH(REPLACE(l.purposes, CHAR(13), '''')) - CHAR_LENGTH(REPLACE(REPLACE(l.purposes, CHAR(13), ''''), CHAR(10), ''''))
    WHERE l.purposes IS NOT NULL AND TRIM(l.purposes) <> ''''
      AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(l.purposes, CHAR(13), ''''), CHAR(10), n.n), CHAR(10), -1)) <> ''''');
CALL lams_exec_if(lams_has_column('leave_types', 'purposes'), 'ALTER TABLE leave_types DROP COLUMN purposes');

-- ---------------------------------------------------------------------------------------------
-- Leave quotas → employee types
-- ---------------------------------------------------------------------------------------------
DELETE q FROM leave_type_quotas q LEFT JOIN employee_types t ON t.code = q.employee_type WHERE t.id IS NULL;
CALL lams_exec_if(NOT lams_has_fk('leave_type_quotas', 'fk_leave_type_quotas_employee_type'),
  'ALTER TABLE leave_type_quotas ADD CONSTRAINT fk_leave_type_quotas_employee_type FOREIGN KEY (employee_type) REFERENCES employee_types (code) ON UPDATE CASCADE');

-- ---------------------------------------------------------------------------------------------
-- Shifts: working days
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_days (
  shift_id BIGINT UNSIGNED NOT NULL,
  day CHAR(3) NOT NULL,
  PRIMARY KEY (shift_id, day),
  CONSTRAINT fk_shift_days_shift FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE,
  CONSTRAINT chk_shift_days_day CHECK (day IN ('Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CALL lams_exec_if(lams_has_column('shifts', 'applicable_days'),
  'INSERT IGNORE INTO shift_days (shift_id, day)
   SELECT s.id, JSON_UNQUOTE(JSON_EXTRACT(s.applicable_days, CONCAT(''$['', n.n - 1, '']'')))
     FROM shifts s JOIN lams_n n ON n.n <= JSON_LENGTH(s.applicable_days)
    WHERE s.applicable_days IS NOT NULL AND JSON_TYPE(s.applicable_days) = ''ARRAY''
      AND JSON_UNQUOTE(JSON_EXTRACT(s.applicable_days, CONCAT(''$['', n.n - 1, '']''))) IN (''Sun'', ''Mon'', ''Tue'', ''Wed'', ''Thu'', ''Fri'', ''Sat'')');
-- A shift without a list worked Monday to Friday (the default the code used)
CALL lams_exec_if(lams_has_column('shifts', 'applicable_days'),
  'INSERT IGNORE INTO shift_days (shift_id, day)
   SELECT s.id, d.day FROM shifts s JOIN (SELECT ''Mon'' day UNION SELECT ''Tue'' UNION SELECT ''Wed'' UNION SELECT ''Thu'' UNION SELECT ''Fri'') d
    WHERE s.applicable_days IS NULL OR JSON_TYPE(s.applicable_days) <> ''ARRAY'' OR JSON_LENGTH(s.applicable_days) = 0');
CALL lams_exec_if(lams_has_column('shifts', 'applicable_days'), 'ALTER TABLE shifts DROP COLUMN applicable_days');

-- ---------------------------------------------------------------------------------------------
-- Role catalog: aliases
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_aliases (
  module_id VARCHAR(20) NOT NULL,
  role_id VARCHAR(50) NOT NULL,
  alias VARCHAR(100) NOT NULL,
  PRIMARY KEY (module_id, role_id, alias),
  CONSTRAINT fk_role_aliases_role FOREIGN KEY (module_id, role_id) REFERENCES role_catalog (module_id, role_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CALL lams_exec_if(lams_has_column('role_catalog', 'aliases'),
  'INSERT IGNORE INTO role_aliases (module_id, role_id, alias)
   SELECT r.module_id, r.role_id, LEFT(LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.aliases, '','', n.n), '','', -1))), 100)
     FROM role_catalog r JOIN lams_n n ON n.n <= 1 + CHAR_LENGTH(r.aliases) - CHAR_LENGTH(REPLACE(r.aliases, '','', ''''))
    WHERE TRIM(r.aliases) <> '''' AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.aliases, '','', n.n), '','', -1)) <> ''''');
CALL lams_exec_if(lams_has_column('role_catalog', 'aliases'), 'ALTER TABLE role_catalog DROP COLUMN aliases');

-- ---------------------------------------------------------------------------------------------
-- Report schedules: formats
-- ---------------------------------------------------------------------------------------------
CALL lams_exec_if(NOT lams_has_column('report_schedules', 'send_pdf'), 'ALTER TABLE report_schedules ADD COLUMN send_pdf TINYINT(1) NOT NULL DEFAULT 1 AFTER send_time');
CALL lams_exec_if(NOT lams_has_column('report_schedules', 'send_csv'), 'ALTER TABLE report_schedules ADD COLUMN send_csv TINYINT(1) NOT NULL DEFAULT 0 AFTER send_pdf');
CALL lams_exec_if(lams_has_column('report_schedules', 'formats'),
  'UPDATE report_schedules SET send_pdf = FIND_IN_SET(''pdf'', formats) > 0, send_csv = FIND_IN_SET(''csv'', formats) > 0');
CALL lams_exec_if(lams_has_column('report_schedules', 'formats'), 'ALTER TABLE report_schedules DROP COLUMN formats');
CALL lams_exec_if(NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_report_schedules_format'),
  'ALTER TABLE report_schedules ADD CONSTRAINT chk_report_schedules_format CHECK (send_pdf = 1 OR send_csv = 1)');

DROP TEMPORARY TABLE IF EXISTS lams_n;
SELECT 'step 5 of 6 done: lists as tables' AS normalization;
