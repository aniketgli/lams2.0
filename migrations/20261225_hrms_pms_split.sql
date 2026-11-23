-- =============================================================================================
-- HRMS / PMS split of employee types, and two roles
-- =============================================================================================
-- * employee_types.module: 'HRMS' or 'PMS'. HRMS has the Permanent and Trainee types; every other type
--   (Contractual, Project staff, M.Sc, PhD, Intern) belongs to PMS. Change it in Master Settings → Employee Types.
--   The HRMS employee form and bulk import offer only the HRMS types.
-- * New roles in the role catalog (role_catalog + role_aliases):
--     hrms / employee_manager      Employee Manager       — adds, edits and imports HRMS employees
--     pms  / pms_employee_manager  Employee Manager       — adds, edits and imports PMS employees
--     pms  / pms_leave_balance     Leave Balance Manager  — the leave balances of PMS employees
--   Nobody is given these roles here: the administrator gives them in User Controls.
-- No row is deleted and no employee, role grant or leave record is changed. Safe to run again.
-- Run after a backup, with the app stopped.
-- =============================================================================================

DROP PROCEDURE IF EXISTS lams_hrms_pms_split;
DELIMITER $$
CREATE PROCEDURE lams_hrms_pms_split()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_types' AND COLUMN_NAME = 'module') THEN
    ALTER TABLE employee_types ADD COLUMN module VARCHAR(4) NOT NULL DEFAULT 'HRMS',
      ADD CONSTRAINT chk_employee_types_module CHECK (module IN ('HRMS', 'PMS'));
    -- Only when the column is first added: later choices made in Master Settings are kept on a re-run.
    UPDATE employee_types SET module = 'PMS' WHERE form_layout NOT IN ('permanent', 'diploma_trainee');
  END IF;
END$$
DELIMITER ;
CALL lams_hrms_pms_split();
DROP PROCEDURE lams_hrms_pms_split;

INSERT IGNORE INTO role_catalog (module_id, role_id, name, access_role, description, sort_order, is_active) VALUES
  ('hrms', 'employee_manager', 'Employee Manager', 'employee_manager', 'Adds, edits and imports HRMS employees (Permanent, Trainee). No roles, passwords or deactivation.', 55, 1),
  ('pms', 'pms_leave_balance', 'Leave Balance Manager', 'leave_balance_manager', 'Sees and sets the leave balance of every PMS employee, and nothing else.', 52, 1),
  ('pms', 'pms_employee_manager', 'Employee Manager', 'employee_manager', 'Adds, edits and imports PMS employees (project staff, contractual, scholars, interns).', 55, 1);

INSERT IGNORE INTO role_aliases (module_id, role_id, alias) VALUES
  ('hrms', 'employee_manager', 'hrms_employee_manager'),
  ('hrms', 'employee_manager', 'employee manager'),
  ('pms', 'pms_leave_balance', 'pms_leave_balance_manager'),
  ('pms', 'pms_leave_balance', 'leave balance manager'),
  ('pms', 'pms_employee_manager', 'employee manager');

SELECT CONCAT('employee types: ', SUM(module = 'HRMS'), ' HRMS, ', SUM(module = 'PMS'), ' PMS') AS split FROM employee_types;
SELECT CONCAT('new roles in the catalog: ', COUNT(*)) AS roles FROM role_catalog
 WHERE (module_id, role_id) IN (('hrms', 'employee_manager'), ('pms', 'pms_leave_balance'), ('pms', 'pms_employee_manager'));
