-- =============================================================================================
-- PMS: the PI role, and the project workspace (documents, funds, activities)
-- =============================================================================================
-- 1. PI role. The PMS role pms_pi (switched off as "HoD" by 20261230) comes back as "PI" with its own access
--    (project_pi): a PI opens Projects and manages the projects where they are the PI (employees, funds,
--    activities, details and documents). Leave / attendance approvals stay with the Reporting Manager.
--    Given in HRMS → User Controls → PMS column → PI. Grants already stored for this role (e.g. "Principal
--    Investigator (PI)") give the PI access again. No grant row is changed.
-- 2. New tables for the project workspace (nothing existing is changed):
--      project_documents      other documents of a project (PDF), next to the proposal / sanction order
--      project_budget_heads   the sanctioned budget by head (Manpower, Equipment, Travel …)
--      project_fund_receipts  instalments received from the funding agency
--      project_expenditures   what was spent, by head
--      project_activities     activities / milestones with dates, status and progress
-- No row is deleted. Safe to run again. Run after a backup.
-- =============================================================================================

UPDATE role_catalog
   SET name = 'PI', access_role = 'project_pi', is_active = 1, sort_order = 25,
       description = 'Principal Investigator: manages the projects where they are the PI (employees, funds, activities, documents).'
 WHERE module_id = 'pms' AND role_id = 'pms_pi';
INSERT IGNORE INTO role_aliases (module_id, role_id, alias) VALUES
  ('pms', 'pms_pi', 'pi'),
  ('pms', 'pms_pi', 'project pi'),
  ('pms', 'pms_pi', 'principal investigator'),
  ('pms', 'pms_pi', 'principal investigator (pi)');

CREATE TABLE IF NOT EXISTS project_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  file_name VARCHAR(160) NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  data LONGBLOB NULL,
  storage_path VARCHAR(200) NULL,
  uploaded_by VARCHAR(20) NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_project_documents_project (project_id),
  CONSTRAINT fk_project_documents_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_budget_heads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  sanctioned_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  created_by VARCHAR(20) NULL,
  updated_by VARCHAR(20) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_budget_heads_name (project_id, name),
  CONSTRAINT fk_project_budget_heads_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT chk_project_budget_heads_amount CHECK (sanctioned_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_fund_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  received_on DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(120) NULL,
  remarks VARCHAR(255) NULL,
  created_by VARCHAR(20) NULL,
  updated_by VARCHAR(20) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_project_fund_receipts_project (project_id, received_on),
  CONSTRAINT fk_project_fund_receipts_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT chk_project_fund_receipts_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_expenditures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  head_id BIGINT UNSIGNED NULL,
  spent_on DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  voucher_no VARCHAR(60) NULL,
  created_by VARCHAR(20) NULL,
  updated_by VARCHAR(20) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_project_expenditures_project (project_id, spent_on),
  KEY idx_project_expenditures_head (head_id),
  CONSTRAINT fk_project_expenditures_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_expenditures_head FOREIGN KEY (head_id) REFERENCES project_budget_heads (id),
  CONSTRAINT chk_project_expenditures_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_by VARCHAR(20) NULL,
  updated_by VARCHAR(20) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_project_activities_project (project_id),
  CONSTRAINT fk_project_activities_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT chk_project_activities_status CHECK (status IN ('planned', 'in_progress', 'on_hold', 'done')),
  CONSTRAINT chk_project_activities_progress CHECK (progress <= 100),
  CONSTRAINT chk_project_activities_dates CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SELECT CONCAT(role_id, ' = ', name, ' (', access_role, ', active: ', is_active, ')') AS pms_pi FROM role_catalog
 WHERE module_id = 'pms' AND role_id = 'pms_pi';
SELECT CONCAT('PI grants: ', COUNT(*)) AS pi_holders FROM user_module_roles
 WHERE module_id = 'pms' AND LOWER(status) = 'active'
   AND LOWER(role_id) IN ('pms_pi', 'pi', 'project pi', 'principal investigator', 'principal investigator (pi)', 'hod', 'reviewing manager');
