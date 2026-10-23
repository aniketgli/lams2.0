-- Adds the columns expected by the current Shift Master Drizzle schema.
-- Take a database backup first. Run only if these columns do not already exist.
USE lams2_db;

ALTER TABLE shifts
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN half_day_cutoff_time TIME NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN color VARCHAR(50) NULL,
  ADD COLUMN applicable_days JSON NULL;
