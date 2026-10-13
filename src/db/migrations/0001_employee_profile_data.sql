-- Add storage for the full HRMS profile without losing fields not represented by normalized columns.
-- Existing employee records are preserved; this column is nullable for backward compatibility.
ALTER TABLE `employee_profiles`
  ADD COLUMN `profile_data` text NULL;
