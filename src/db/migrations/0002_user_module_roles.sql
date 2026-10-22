-- Apply once to lams2_db. This table is the source of truth for module role assignments.
CREATE TABLE IF NOT EXISTS user_module_roles (
  user_id VARCHAR(36) NOT NULL,
  module_id VARCHAR(80) NOT NULL,
  role_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_module_role_unique (user_id, module_id, role_id),
  KEY user_module_roles_user_module_idx (user_id, module_id)
);

-- Assign the four HRMS roles only to Aniket. Does not modify any other user's assignments.
INSERT IGNORE INTO user_module_roles (user_id, module_id, role_id)
SELECT u.id, 'lams', r.role_id
FROM users u
JOIN (
  SELECT 'hrms_admin' AS role_id
  UNION ALL SELECT 'hrms_reviewing'
  UNION ALL SELECT 'hrms_reporting'
  UNION ALL SELECT 'hrms_staff'
) r
WHERE LOWER(u.email) = 'aniket@wii.gov.in';
