-- Leave groups: a named set of leave types plus the leave year they follow. An employee belongs to one
-- group (Add Employee form), and takes leave only from the leave types of that group.
-- Nothing is pre-filled: the administrator creates the groups.
CREATE TABLE IF NOT EXISTS leave_groups (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  leave_year  VARCHAR(2)   NOT NULL,                  -- CY (1 Jan - 31 Dec) | FY (1 Apr - 31 Mar)
  status      VARCHAR(10)  NOT NULL DEFAULT 'active',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_leave_groups_code (code),
  UNIQUE KEY uq_leave_groups_name (name)
);

CREATE TABLE IF NOT EXISTS leave_group_types (
  group_id      BIGINT UNSIGNED NOT NULL,
  leave_type_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (group_id, leave_type_id),
  CONSTRAINT fk_leave_group_types_group FOREIGN KEY (group_id) REFERENCES leave_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_group_types_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id)
);

-- Clean-up of an earlier draft of this feature (only does something if that draft was installed).
DROP TABLE IF EXISTS leave_policy_items;
DROP TABLE IF EXISTS leave_policies;
DELETE FROM lookup_values WHERE lookup_type = 'leave_group';
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_types' AND COLUMN_NAME = 'leave_group');
SET @sql := IF(@has > 0, 'ALTER TABLE leave_types DROP COLUMN leave_group', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_types' AND COLUMN_NAME = 'nature');
SET @sql := IF(@has > 0, 'ALTER TABLE leave_types DROP COLUMN nature', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
