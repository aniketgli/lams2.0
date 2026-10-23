-- Biometric Machine Master row ID + audit log migration.
-- BACK UP lams2_db before running.
-- Existing biometric_machines.id values are preserved as machine_id.
ALTER TABLE biometric_machines
  CHANGE COLUMN id machine_id VARCHAR(64) NOT NULL,
  ADD COLUMN row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (row_id),
  ADD UNIQUE KEY uq_biometric_machines_machine_id (machine_id);

CREATE TABLE IF NOT EXISTS biometric_machine_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  machine_id VARCHAR(64) NOT NULL,
  action ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  changed_by_biometric_id VARCHAR(4) NULL,
  changed_by_name VARCHAR(255) NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NULL,
  before_data LONGTEXT NULL,
  after_data LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY idx_biometric_machine_audit_machine (machine_id),
  KEY idx_biometric_machine_audit_changed_at (changed_at),
  KEY idx_biometric_machine_audit_actor (changed_by_biometric_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify after migration:
-- SHOW COLUMNS FROM biometric_machines;
-- SELECT row_id, machine_id, full_name FROM biometric_machines;
-- SHOW COLUMNS FROM biometric_machine_audit_logs;
