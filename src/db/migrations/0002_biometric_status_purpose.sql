-- Add status and purpose to the existing biometric master without dropping records.
ALTER TABLE `biometric_machines`
  ADD COLUMN `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `purpose` varchar(24) NOT NULL DEFAULT 'ATTENDANCE';
