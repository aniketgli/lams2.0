-- Back up the database and run the duplicate preflight queries in the PR notes first.
-- The unique indexes intentionally fail if existing non-empty identifiers are duplicated.
ALTER TABLE `employee_profiles`
  ADD COLUMN `biometric_id` varchar(100) NULL;

-- Backfill existing biometric IDs from the JSON profile where present and valid.
UPDATE `employee_profiles`
SET `biometric_id` = NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(`profile_data`, '$.biometricId'))), '')
WHERE `profile_data` IS NOT NULL
  AND JSON_VALID(`profile_data`)
  AND JSON_EXTRACT(`profile_data`, '$.biometricId') IS NOT NULL;

CREATE UNIQUE INDEX `uq_employee_profiles_phone`
  ON `employee_profiles` (`phone`);

CREATE UNIQUE INDEX `uq_employee_profiles_biometric_id`
  ON `employee_profiles` (`biometric_id`);
