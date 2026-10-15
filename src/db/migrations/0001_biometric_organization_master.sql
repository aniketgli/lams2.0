-- Additive migration: creates only the two new Master Settings tables.
-- Existing tables and records are not modified or dropped.

CREATE TABLE IF NOT EXISTS `biometric_machines` (
  `id` varchar(64) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `short_name` varchar(80) NOT NULL,
  `serial_number` varchar(120) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `biometric_machines_short_name_unique` (`short_name`),
  UNIQUE KEY `biometric_machines_serial_number_unique` (`serial_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organization_settings` (
  `id` varchar(32) NOT NULL,
  `org_name` varchar(255) NOT NULL,
  `logo_data` longtext NULL,
  `address` text NULL,
  `copyright_text` varchar(500) NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
