CREATE TABLE IF NOT EXISTS user_account_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_user_id VARCHAR(36) NOT NULL,
  target_biometric_id CHAR(4) NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  target_email VARCHAR(255) NOT NULL,
  action VARCHAR(32) NOT NULL,
  reason TEXT NULL,
  reference VARCHAR(255) NULL,
  deleted_by CHAR(4) NOT NULL,
  deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_account_audit_target_biometric (target_biometric_id),
  KEY idx_user_account_audit_deleted_at (deleted_at),
  KEY idx_user_account_audit_deleted_by (deleted_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
