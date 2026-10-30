-- Migration: outdoor duty (OD) requests in the database (were browser storage).
-- Safe to re-run.
--
--   outdoor_duty_requests   one row per OD request.
--     user_id        the employee the OD is for (users.id)
--     applied_by     who typed it in (the employee, or an administrator on their behalf)
--     manager_id     the employee's reporting manager when the request was made
--     days_count     calendar days from start_date to end_date, worked out by the server
--     status         pending | approved | rejected
--     undo_count     how many times a decision was taken back (a reporting manager may do it once)
--
-- An approved OD shows as "OD" on the Attendance page for its working days.
-- Every create, change, approval, rejection, undo and delete is written to master_audit_logs
-- (master_key = 'outdoor_duty'), which the auditor reads as the activity log.

CREATE TABLE IF NOT EXISTS outdoor_duty_requests (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  start_time      VARCHAR(5)    NOT NULL,
  end_time        VARCHAR(5)    NOT NULL,
  days_count      SMALLINT UNSIGNED NOT NULL,
  od_type         VARCHAR(16)   NOT NULL,
  location        VARCHAR(200)  NOT NULL,
  estimated_funds DECIMAL(12,2) NOT NULL DEFAULT 0,
  funding_source  VARCHAR(100)  NULL,
  purpose         VARCHAR(1000) NOT NULL,
  status          VARCHAR(16)   NOT NULL DEFAULT 'pending',
  applied_by      BIGINT UNSIGNED NOT NULL,
  manager_id      BIGINT UNSIGNED NULL,
  action_by       BIGINT UNSIGNED NULL,
  action_at       DATETIME(3)   NULL,
  manager_comment VARCHAR(500)  NULL,
  undo_count      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_od_user (user_id, start_date),
  KEY idx_od_dates (start_date, end_date),
  KEY idx_od_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
