-- Migration: organization-wide CC / BCC recipients for notification emails.
-- Managed in Master Settings > Organization. Safe to re-run.
CREATE TABLE IF NOT EXISTS notification_recipients (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_type VARCHAR(3)   NOT NULL,              -- CC | BCC
  email          VARCHAR(254) NOT NULL,
  name           VARCHAR(255) NULL,
  status         VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_notification_recipient_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
