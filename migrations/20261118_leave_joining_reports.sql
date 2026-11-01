-- Joining report: filled on the first working day after a 2-stage leave. The leave's details are copied from the application,
-- the biometric In / Out of the joining day is read from the punch log, and the report goes Reporting Manager -> HoD.
-- A fitness medical certificate (PDF) can be attached for leave types marked "Fitness certificate on joining" (HPL / Commuted).
CREATE TABLE IF NOT EXISTS leave_joining_reports (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id    BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  joining_date  DATE            NOT NULL,
  punch_in      TIME            NULL,
  punch_out     TIME            NULL,
  status        VARCHAR(12)     NOT NULL DEFAULT 'pending_l1',
  manager_id    BIGINT UNSIGNED NULL,
  reviewer_id   BIGINT UNSIGNED NULL,
  submitted_by  BIGINT UNSIGNED NOT NULL,
  submitted_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  l1_by         BIGINT UNSIGNED NULL,
  l1_at         DATETIME(3)     NULL,
  l1_comment    VARCHAR(500)    NULL,
  decided_stage TINYINT UNSIGNED NULL,
  action_by     BIGINT UNSIGNED NULL,
  action_at     DATETIME(3)     NULL,
  manager_comment VARCHAR(500)  NULL,
  UNIQUE KEY uq_leave_joining_request (request_id),
  KEY idx_leave_joining_user (user_id),
  KEY idx_leave_joining_status (status)
);

CREATE TABLE IF NOT EXISTS leave_joining_certificates (
  report_id    BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  file_name    VARCHAR(200)    NOT NULL,
  mime_type    VARCHAR(40)     NOT NULL,
  size_bytes   INT UNSIGNED    NOT NULL,
  data         MEDIUMBLOB      NOT NULL,
  uploaded_by  BIGINT UNSIGNED NOT NULL,
  uploaded_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

ALTER TABLE leave_types ADD COLUMN fitness_certificate TINYINT(1) NOT NULL DEFAULT 0;

-- Every 2-stage leave needs a joining report; the 1-stage leaves do not.
UPDATE leave_types SET joining_required = IF(approval_stages = 2, 1, 0) WHERE id > 0;
UPDATE leave_types SET fitness_certificate = 1 WHERE id > 0 AND code IN ('HPL', 'COMM');
