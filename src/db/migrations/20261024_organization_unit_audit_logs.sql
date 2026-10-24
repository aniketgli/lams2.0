-- Organization Profile Master audit log.
-- Run once against lams2_db after taking a database backup.
CREATE TABLE IF NOT EXISTS organization_unit_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  organization_code VARCHAR(80) NULL,
  action ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  changed_by_biometric_id VARCHAR(4) NULL,
  changed_by_name VARCHAR(255) NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before_data LONGTEXT NULL,
  after_data LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY idx_org_unit_audit_org_id (organization_id),
  KEY idx_org_unit_audit_changed_at (changed_at),
  KEY idx_org_unit_audit_actor (changed_by_biometric_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify:
-- SHOW COLUMNS FROM organization_unit_audit_logs;
-- SELECT * FROM organization_unit_audit_logs ORDER BY changed_at DESC;
