-- Migration: register of employee transfers and reporting-manager / HoD changes (Employees Mapping).
-- One row per employee per order; rows of one order share batch_id. Names are copied so the register stays readable
-- after an employee is renamed. Safe to re-run.
CREATE TABLE IF NOT EXISTS employee_mapping_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id VARCHAR(36) NOT NULL,
  kind ENUM('transfer','manager_change') NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  biometric_id VARCHAR(20) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  prev_department VARCHAR(255) NULL,
  new_department VARCHAR(255) NULL,
  prev_reporting_manager_id VARCHAR(20) NULL,
  prev_reporting_manager_name VARCHAR(255) NULL,
  new_reporting_manager_id VARCHAR(20) NULL,
  new_reporting_manager_name VARCHAR(255) NULL,
  prev_hod_id VARCHAR(20) NULL,
  prev_hod_name VARCHAR(255) NULL,
  new_hod_id VARCHAR(20) NULL,
  new_hod_name VARCHAR(255) NULL,
  effective_date DATE NOT NULL,
  notes VARCHAR(500) NULL,
  done_by_biometric_id VARCHAR(20) NULL,
  done_by_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mapping_user (user_id),
  KEY idx_mapping_batch (batch_id),
  KEY idx_mapping_effective (effective_date, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
