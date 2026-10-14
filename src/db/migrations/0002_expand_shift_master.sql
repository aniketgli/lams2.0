-- Expand Shift Master so the database can persist all editable fields.
-- Existing shift rows and IDs are preserved; new fields are nullable/defaulted for safe migration.
ALTER TABLE shifts
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN half_day_cutoff_time VARCHAR(10) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN color VARCHAR(30) NULL,
  ADD COLUMN applicable_days TEXT NULL;
