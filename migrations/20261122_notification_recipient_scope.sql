-- Migration: CC / BCC copies per transaction.
-- A copy address now applies to ALL notification mails or to one kind of transaction
-- (LEAVE, OD, MANUAL, JOINING, EMPLOYEE, REPORT). The same address can be listed once per scope.
-- Managed in Master Settings > Organization. Safe to re-run.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_recipients' AND COLUMN_NAME = 'scope'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE notification_recipients ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT ''ALL'' AFTER recipient_type',
  'SELECT ''notification_recipients.scope already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- One row per (email, scope) instead of one per email.
SET @has_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_recipients' AND INDEX_NAME = 'uq_notification_recipient_email'
);
SET @ddl := IF(@has_old > 0,
  'ALTER TABLE notification_recipients DROP INDEX uq_notification_recipient_email',
  'SELECT ''old unique key already dropped''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_recipients' AND INDEX_NAME = 'uq_notification_recipient_email_scope'
);
SET @ddl := IF(@has_new = 0,
  'ALTER TABLE notification_recipients ADD UNIQUE KEY uq_notification_recipient_email_scope (email, scope)',
  'SELECT ''new unique key already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
