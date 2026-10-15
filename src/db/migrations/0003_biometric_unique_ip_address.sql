-- Add a database-level uniqueness constraint for biometric machine IP addresses.
-- Check for duplicate IPs before applying this migration; resolve duplicates first if any exist.
ALTER TABLE `biometric_machines`
  ADD UNIQUE KEY `biometric_machines_ip_address_unique` (`ip_address`);
