-- Shift Master status and audit log.
-- Backup lams2_db before running this migration.
-- The current MySQL shifts.id column is expected to be numeric AUTO_INCREMENT.
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS shift_master_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT UNSIGNED NOT NULL,
  shift_code VARCHAR(50) NOT NULL,
  action VARCHAR(24) NOT NULL,
  changed_by_biometric_id VARCHAR(4) NULL,
  changed_by_name VARCHAR(255) NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NULL,
  before_data LONGTEXT NULL,
  after_data LONGTEXT NULL,
  INDEX idx_shift_audit_shift_id (shift_id),
  INDEX idx_shift_audit_changed_at (changed_at),
  INDEX idx_shift_audit_actor (changed_by_biometric_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
