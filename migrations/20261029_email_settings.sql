-- Migration: email sender and SMTP server settings, managed in
-- Master Settings > Organization (previously only in .env). Safe to re-run.
-- The SMTP password is stored encrypted (AES-256-GCM); see server/masters/emailSettings.ts.
CREATE TABLE IF NOT EXISTS email_settings (
  id                 VARCHAR(32)  NOT NULL PRIMARY KEY,      -- always 'default'
  enabled            TINYINT(1)   NOT NULL DEFAULT 1,        -- 0 = do not send notification emails
  from_name          VARCHAR(255) NOT NULL,
  from_email         VARCHAR(254) NOT NULL,
  reply_to           VARCHAR(254) NULL,
  smtp_host          VARCHAR(255) NOT NULL,
  smtp_port          INT          NOT NULL DEFAULT 587,
  smtp_security      VARCHAR(10)  NOT NULL DEFAULT 'starttls', -- none | starttls | ssl
  smtp_user          VARCHAR(255) NULL,
  smtp_password_enc  TEXT         NULL,
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
