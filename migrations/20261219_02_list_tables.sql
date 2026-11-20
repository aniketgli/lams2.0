-- =============================================================================================
-- Normalization, step 2 of 6: one table per list
-- =============================================================================================
-- The lists of the employee form were kept together in lookup_values (one row per value, a lookup_type column
-- saying which list). Each list now has its own table, so other tables can point at its codes with a foreign key:
--   salutations, genders, institutes, employee_types (with form_layout, was metadata JSON), org_unit_types,
--   cadre_groups, funding_categories
-- and a new cadres table holds the cadre list (Scientific, Technical, …) that was fixed in the code.
-- Ids are kept, so the audit trail still points at the same records. lookup_values is renamed
-- zz_retired_lookup_values (kept, not deleted). Safe to run again.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS salutations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_salutations_code (code),
  KEY idx_salutations_order (status, sort_order),
  CONSTRAINT chk_salutations_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO salutations (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''salutation'' ON DUPLICATE KEY UPDATE salutations.code = salutations.code');

CREATE TABLE IF NOT EXISTS genders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_genders_code (code),
  KEY idx_genders_order (status, sort_order),
  CONSTRAINT chk_genders_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO genders (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''gender'' ON DUPLICATE KEY UPDATE genders.code = genders.code');

CREATE TABLE IF NOT EXISTS institutes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_institutes_code (code),
  KEY idx_institutes_order (status, sort_order),
  CONSTRAINT chk_institutes_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO institutes (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''institute'' ON DUPLICATE KEY UPDATE institutes.code = institutes.code');

CREATE TABLE IF NOT EXISTS employee_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  form_layout VARCHAR(32) NOT NULL DEFAULT 'permanent',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_types_code (code),
  KEY idx_employee_types_order (status, sort_order),
  CONSTRAINT chk_employee_types_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO employee_types (id, code, name, sort_order, status, created_at, updated_at, form_layout) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at, COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(metadata), metadata, ''{}''), ''$.formLayout'')), ''null''), ''permanent'') FROM lookup_values WHERE lookup_type = ''employee_type'' ON DUPLICATE KEY UPDATE employee_types.code = employee_types.code');

CREATE TABLE IF NOT EXISTS org_unit_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_unit_types_code (code),
  KEY idx_org_unit_types_order (status, sort_order),
  CONSTRAINT chk_org_unit_types_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO org_unit_types (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''org_unit_type'' ON DUPLICATE KEY UPDATE org_unit_types.code = org_unit_types.code');

CREATE TABLE IF NOT EXISTS cadre_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cadre_groups_code (code),
  KEY idx_cadre_groups_order (status, sort_order),
  CONSTRAINT chk_cadre_groups_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO cadre_groups (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''cadre_group'' ON DUPLICATE KEY UPDATE cadre_groups.code = cadre_groups.code');

CREATE TABLE IF NOT EXISTS funding_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_funding_categories_code (code),
  KEY idx_funding_categories_order (status, sort_order),
  CONSTRAINT chk_funding_categories_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL lams_exec_if(lams_has_table('lookup_values'),
  'INSERT INTO funding_categories (id, code, name, sort_order, status, created_at, updated_at) SELECT id, code, name, sort_order, UPPER(status), created_at, updated_at FROM lookup_values WHERE lookup_type = ''funding_category'' ON DUPLICATE KEY UPDATE funding_categories.code = funding_categories.code');

-- Form layouts are a fixed set chosen per employee type
CALL lams_exec_if(NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_employee_types_layout'),
  'ALTER TABLE employee_types ADD CONSTRAINT chk_employee_types_layout CHECK (form_layout IN (''permanent'', ''contractual'', ''researcher'', ''diploma_trainee'', ''bsc_msc_student'', ''phd_student'', ''intern''))');

-- Cadres (were a fixed list in the code); values already used on profiles / designations are added too
CREATE TABLE IF NOT EXISTS cadres (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cadres_code (code),
  CONSTRAINT chk_cadres_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO cadres (code, name, sort_order) VALUES
  ('Scientific', 'Scientific', 10), ('Technical', 'Technical', 20), ('Support', 'Support', 30), ('Administrative', 'Administrative', 40),
  ('Finance', 'Finance', 50), ('Stenographer', 'Stenographer', 60), ('Driver', 'Driver', 70), ('Cook', 'Cook', 75),
  ('Multi Tasking Staff', 'Multi Tasking Staff', 80)
ON DUPLICATE KEY UPDATE code = code;
CALL lams_exec_if(lams_has_column('employee_profiles', 'profile_data'),
  'INSERT INTO cadres (code, name, sort_order) SELECT DISTINCT v, v, 900 FROM (SELECT LEFT(TRIM(JSON_UNQUOTE(JSON_EXTRACT(profile_data, ''$.employeeCategory''))), 100) AS v FROM employee_profiles WHERE profile_data IS NOT NULL AND JSON_VALID(profile_data)) x WHERE v IS NOT NULL AND v <> '''' AND v <> ''null'' ON DUPLICATE KEY UPDATE cadres.code = cadres.code');
CALL lams_exec_if(lams_has_column('designations', 'metadata'),
  'INSERT INTO cadres (code, name, sort_order) SELECT DISTINCT v, v, 900 FROM (SELECT LEFT(TRIM(JSON_UNQUOTE(JSON_EXTRACT(metadata, ''$.cadre''))), 100) AS v FROM designations WHERE metadata IS NOT NULL AND JSON_VALID(metadata)) x WHERE v IS NOT NULL AND v <> '''' AND v <> ''null'' ON DUPLICATE KEY UPDATE cadres.code = cadres.code');

-- The old shared table is kept under a retired name
CALL lams_exec_if(lams_has_table('lookup_values'), 'RENAME TABLE lookup_values TO zz_retired_lookup_values');

SELECT 'step 2 of 6 done: one table per list' AS normalization;
