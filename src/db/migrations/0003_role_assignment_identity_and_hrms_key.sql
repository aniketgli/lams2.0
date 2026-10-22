-- LAMS 2.0 schema correction: role assignment identity and canonical module key.
-- Apply after 0002_user_module_roles.sql. This migration does not drop user data.
-- Existing users.id remains the account key until every API/session/profile reference
-- has been migrated together; do not change its type independently.

-- Give each assignment row its own auto-increment primary key.
ALTER TABLE user_module_roles
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

-- The Lobby's canonical module key is "hrms", not the legacy "lams".
UPDATE user_module_roles
SET module_id = 'hrms'
WHERE LOWER(module_id) = 'lams';

-- The UPDATE above can merge legacy rows with existing HRMS rows. Remove only
-- duplicate user/module/role assignments, keeping the lowest generated id.
DELETE newer
FROM user_module_roles AS newer
JOIN user_module_roles AS older
  ON older.user_id = newer.user_id
 AND older.module_id = newer.module_id
 AND older.role_id = newer.role_id
 AND older.id < newer.id;
