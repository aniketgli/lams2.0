-- Dedicated Profile Master tables. Run once against the same lams2_db used by the app.
-- Existing shared-table data is copied forward; the legacy table is intentionally retained as a backup.
CREATE TABLE IF NOT EXISTS `designations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `designations_code_unique` (`code`),
  KEY `designations_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `msc_streams` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `msc_streams_code_unique` (`code`),
  KEY `msc_streams_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `msc_batches` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `msc_batches_code_unique` (`code`),
  KEY `msc_batches_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `training_courses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `training_courses_code_unique` (`code`),
  KEY `training_courses_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trainee_batches` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trainee_batches_code_unique` (`code`),
  KEY `trainee_batches_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `projects_code_unique` (`code`),
  KEY `projects_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_code_unique` (`code`),
  KEY `categories_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phd_enrollments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phd_enrollments_code_unique` (`code`),
  KEY `phd_enrollments_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `designations` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'designations';

INSERT IGNORE INTO `msc_streams` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'mscStreams';

INSERT IGNORE INTO `msc_batches` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'mscBatches';

INSERT IGNORE INTO `training_courses` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'courses';

INSERT IGNORE INTO `trainee_batches` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'traineeBatches';

INSERT IGNORE INTO `projects` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'projects';

INSERT IGNORE INTO `categories` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'categories';

INSERT IGNORE INTO `phd_enrollments` (`id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `name`, `code`, `status`, `metadata`, `created_at`, `updated_at`
FROM `profile_master_records` WHERE `master_key` = 'phdEnrollment';

