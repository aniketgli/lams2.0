-- Shift Master schema alignment
-- BACK UP lams2_db before applying. This migration assumes shifts is empty or its id
-- values are numeric and can be converted safely to an unsigned integer.
-- The UI uses status (active/inactive) as the single source of truth.
ALTER TABLE shifts
  MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  DROP COLUMN is_active,
  DROP COLUMN color;

ALTER TABLE shift_master_audit_logs
  MODIFY COLUMN shift_id BIGINT UNSIGNED NOT NULL;

-- Ensure audit history can retain the full shift snapshot and actor metadata.
-- Existing audit columns are retained; no audit rows are deleted.
