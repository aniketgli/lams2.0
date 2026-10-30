-- Migration: track active/inactive module-role grants and the administrator who last changed them.
-- Run this once against the existing LAMS database before restarting the application.
ALTER TABLE user_module_roles
  ADD COLUMN last_updated_by CHAR(4) NULL AFTER last_updated,
  ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER last_updated_by;

-- Preserve every existing grant and mark it active as requested.
-- "id > 0" keeps MySQL Workbench's Safe Updates mode happy.
UPDATE user_module_roles
SET status = 'active'
WHERE id > 0 AND (status IS NULL OR status = '');

