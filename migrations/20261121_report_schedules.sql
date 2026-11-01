-- Scheduled reports: the administrator chooses which report goes to whom, how often and at what time (IST).
-- The portal sends it by email (To = each person's registered email; CC / BCC = the organization's list from Master Settings).
CREATE TABLE IF NOT EXISTS report_schedules (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)    NOT NULL,
  report_key    VARCHAR(40)     NOT NULL,
  frequency     VARCHAR(10)     NOT NULL,                 -- daily | weekly | monthly
  weekday       TINYINT UNSIGNED NULL,                    -- weekly: 1 = Monday ... 7 = Sunday
  month_day     TINYINT UNSIGNED NULL,                    -- monthly: 1 to 28
  send_time     CHAR(5)         NOT NULL,                 -- HH:MM, Indian time
  formats       VARCHAR(10)     NOT NULL DEFAULT 'pdf',   -- csv, pdf or csv,pdf
  status        VARCHAR(10)     NOT NULL DEFAULT 'active',-- active | paused
  last_slot     VARCHAR(10)     NULL,                     -- date of the last occurrence that was handled (YYYY-MM-DD)
  last_run_at   DATETIME(3)     NULL,
  last_status   VARCHAR(16)     NULL,                     -- sent | partial | failed | no_recipients
  last_message  VARCHAR(500)    NULL,
  created_by    VARCHAR(20)     NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_report_schedules_status (status)
);

CREATE TABLE IF NOT EXISTS report_schedule_recipients (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schedule_id  BIGINT UNSIGNED NOT NULL,
  kind         VARCHAR(6)      NOT NULL,                  -- user | role
  user_id      BIGINT UNSIGNED NULL,
  role_id      VARCHAR(30)     NULL,                      -- administrator | audit | reviewing_manager | reporting_manager | general_staff
  KEY idx_report_recipients_schedule (schedule_id)
);

CREATE TABLE IF NOT EXISTS report_runs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schedule_id  BIGINT UNSIGNED NOT NULL,
  ran_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  trigger_type VARCHAR(10)     NOT NULL,                  -- schedule | manual
  period_from  DATE            NULL,
  period_to    DATE            NULL,
  status       VARCHAR(16)     NOT NULL,
  sent_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  message      VARCHAR(500)    NULL,
  KEY idx_report_runs_schedule (schedule_id, ran_at)
);
