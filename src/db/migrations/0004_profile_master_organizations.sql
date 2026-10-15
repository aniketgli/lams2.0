-- Database-backed HRMS Profile Master > Organizations.
CREATE TABLE IF NOT EXISTS `organization_units` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(80) NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'Department',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_units_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the eight existing starter records shown in the current UI.
-- ON DUPLICATE KEY UPDATE makes this migration safe to re-run if these codes already exist.
INSERT INTO `organization_units` (`id`, `name`, `code`, `type`, `status`) VALUES
('1', 'Wildlife Institute of India', 'WII', 'Department', 'ACTIVE'),
('2', 'RS/GIS & AV Cell', 'RSGIS', 'Cell', 'ACTIVE'),
('3', 'IT Cell', 'IT', 'Cell', 'ACTIVE'),
('4', 'Project Tiger', 'PT', 'Project', 'ACTIVE'),
('5', 'Research Laboratories Division', 'RLD', 'Department', 'ACTIVE'),
('6', 'National Tiger Conservation Project', 'NTCP', 'Project', 'ACTIVE'),
('7', 'Wildlife Ecology & Management', 'WEM', 'Department', 'ACTIVE'),
('8', 'Habitat Ecology', 'HE', 'Department', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `type` = VALUES(`type`),
  `status` = VALUES(`status`);
