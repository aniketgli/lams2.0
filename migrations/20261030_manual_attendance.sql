-- Migration: manual attendance requests in the database (were browser storage).
-- Safe to re-run.
--
--   manual_attendance_requests   one row per request for a missed / wrong punch.
--     user_id           the employee the request is for (users.id)
--     applied_by        who typed it in (the employee, or an administrator on their behalf)
--     manager_id        the employee's reporting manager when the request was made
--     in_time/out_time  requested times (HH:mm); original_* are the biometric punches found for that day
--     status            pending | approved | rejected
--
-- An approved request counts as In / Out on the Attendance page (shown as device "Manual").
-- Every create, change, approval, rejection and delete is written to master_audit_logs
-- (master_key = 'manual_attendance'), which the auditor reads as the activity log.

CREATE TABLE IF NOT EXISTS manual_attendance_requests (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  att_date        DATE         NOT NULL,
  in_time         VARCHAR(5)   NOT NULL,
  out_time        VARCHAR(5)   NOT NULL,
  original_in     VARCHAR(5)   NULL,
  original_out    VARCHAR(5)   NULL,
  category        VARCHAR(40)  NOT NULL,
  reason          VARCHAR(500) NOT NULL,
  status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
  applied_by      BIGINT UNSIGNED NOT NULL,
  manager_id      BIGINT UNSIGNED NULL,
  action_by       BIGINT UNSIGNED NULL,
  action_at       DATETIME(3)  NULL,
  manager_comment VARCHAR(500) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_manual_user_date (user_id, att_date),
  KEY idx_manual_date (att_date),
  KEY idx_manual_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
