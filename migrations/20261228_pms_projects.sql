-- =============================================================================================
-- PMS: projects (RC office) and funding agencies
-- =============================================================================================
-- The existing `projects` master (name, code, pi_name, status; linked to employee_profiles.project_name)
-- becomes the PMS project record. New columns hold what the RC office keeps for each project; existing rows
-- and links are kept as they are (their new fields stay empty, stage 'ongoing').
--
--   funding_agencies      the list of funding agencies (PMS → Projects → Funding Agencies)
--   projects (+ columns)  short name, category, agency, scheme, sanction order no. / date, sanctioned amount,
--                         start / end date, PI (an employee), department, site(s), objectives, remarks, stage
--   project_co_pis        the Co-PIs of a project (employees)
--   project_files         the proposal and the sanction order (PDF), on the upload disk when UPLOAD_DIR is set
--
-- Stages: proposed → under_review → approved / rejected → ongoing → extended → completed → closed.
-- No row is deleted or changed except that existing projects get stage 'ongoing'. Safe to run again.
-- Run after a backup, with the app stopped.
-- =============================================================================================

CREATE TABLE IF NOT EXISTS funding_agencies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_funding_agencies_name (name),
  UNIQUE KEY uq_funding_agencies_code (code),
  CONSTRAINT chk_funding_agencies_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS lams_pms_projects;
DELIMITER $$
CREATE PROCEDURE lams_pms_projects()
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLSTATE '42S21' BEGIN END; -- column exists (a re-run)
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'stage') THEN
    ALTER TABLE projects
      ADD COLUMN short_name VARCHAR(100) NULL,
      ADD COLUMN category VARCHAR(30) NULL,
      ADD COLUMN funding_agency_id BIGINT UNSIGNED NULL,
      ADD COLUMN scheme VARCHAR(255) NULL,
      ADD COLUMN sanction_order_no VARCHAR(120) NULL,
      ADD COLUMN sanction_date DATE NULL,
      ADD COLUMN sanctioned_amount DECIMAL(15,2) NULL,
      ADD COLUMN start_date DATE NULL,
      ADD COLUMN end_date DATE NULL,
      ADD COLUMN pi_user_id BIGINT UNSIGNED NULL,
      ADD COLUMN department VARCHAR(255) NULL,
      ADD COLUMN sites VARCHAR(500) NULL,
      ADD COLUMN objectives TEXT NULL,
      ADD COLUMN remarks TEXT NULL,
      ADD COLUMN stage VARCHAR(20) NOT NULL DEFAULT 'ongoing',
      ADD COLUMN created_by VARCHAR(20) NULL,
      ADD COLUMN updated_by VARCHAR(20) NULL,
      ADD KEY idx_projects_stage (stage),
      ADD KEY idx_projects_pi (pi_user_id),
      ADD CONSTRAINT fk_projects_agency FOREIGN KEY (funding_agency_id) REFERENCES funding_agencies (id),
      ADD CONSTRAINT fk_projects_pi FOREIGN KEY (pi_user_id) REFERENCES users (id),
      ADD CONSTRAINT chk_projects_stage CHECK (stage IN ('proposed', 'under_review', 'approved', 'rejected', 'ongoing', 'extended', 'completed', 'closed')),
      ADD CONSTRAINT chk_projects_category CHECK (category IS NULL OR category IN ('external', 'grant_in_aid', 'consultancy', 'in_house')),
      ADD CONSTRAINT chk_projects_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
      ADD CONSTRAINT chk_projects_amount CHECK (sanctioned_amount IS NULL OR sanctioned_amount >= 0);
  END IF;
END$$
DELIMITER ;
CALL lams_pms_projects();
DROP PROCEDURE lams_pms_projects;

CREATE TABLE IF NOT EXISTS project_co_pis (
  project_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (project_id, user_id),
  KEY idx_project_co_pis_user (user_id),
  CONSTRAINT fk_project_co_pis_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_co_pis_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS project_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL,
  file_name VARCHAR(160) NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  data LONGBLOB NULL,
  storage_path VARCHAR(200) NULL,
  uploaded_by VARCHAR(20) NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_files_kind (project_id, kind),
  CONSTRAINT fk_project_files_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT chk_project_files_kind CHECK (kind IN ('proposal', 'sanction'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SELECT CONCAT('projects: ', COUNT(*), ' (stage column ', IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'stage'), 'added', 'MISSING'), ')') AS projects FROM projects;
SELECT CONCAT('funding agencies: ', COUNT(*)) AS agencies FROM funding_agencies;
