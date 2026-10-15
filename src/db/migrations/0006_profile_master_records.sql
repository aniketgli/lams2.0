CREATE TABLE IF NOT EXISTS `profile_master_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `master_key` VARCHAR(40) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `metadata` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `profile_master_key_code_unique` (`master_key`, `code`),
  KEY `profile_master_key_name_idx` (`master_key`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
