-- =============================================================================================
-- PMS roles follow the HRMS rules
-- =============================================================================================
-- PMS works exactly as HRMS: the same role names and the same approvals (Reporting Manager first, HoD where the
-- employee has one). The PMS catalog roles get the HRMS names and access (this replaces 20261226, where the PI was
-- the one approver):
--     pms_admin       PMS Administrator / Dean R&D        -> Administrator      (administrator)
--     pms_pi          Principal Investigator (PI)         -> HoD                (reviewing_manager)
--     pms_co_pi       Co-Principal Investigator (Co-PI)   -> Reporting Manager  (reporting_manager)
--     pms_researcher  Research Fellow / Staff             -> User               (general_staff)
-- The old names stay as aliases, so every existing grant keeps working. Nobody's grants change. Safe to run again.
-- =============================================================================================

UPDATE role_catalog SET name = 'Administrator', access_role = 'administrator',
       description = 'Full administrative control over PMS employees, attendance, leave and projects.'
 WHERE module_id = 'pms' AND role_id = 'pms_admin';
UPDATE role_catalog SET name = 'HoD', access_role = 'reviewing_manager',
       description = 'Head of Department: second-level approval.'
 WHERE module_id = 'pms' AND role_id = 'pms_pi';
UPDATE role_catalog SET name = 'Reporting Manager', access_role = 'reporting_manager',
       description = 'First-level approver for team leave, manual attendance and outdoor duty.'
 WHERE module_id = 'pms' AND role_id = 'pms_co_pi';
UPDATE role_catalog SET name = 'User', access_role = 'general_staff',
       description = 'Self-service attendance, leave, outdoor duty and profile.'
 WHERE module_id = 'pms' AND role_id = 'pms_researcher';

INSERT IGNORE INTO role_aliases (module_id, role_id, alias) VALUES
  ('pms', 'pms_admin', 'pms administrator / dean r&d'),
  ('pms', 'pms_pi', 'principal investigator (pi)'),
  ('pms', 'pms_pi', 'reviewing manager'),
  ('pms', 'pms_co_pi', 'co-principal investigator (co-pi)'),
  ('pms', 'pms_co_pi', 'rm'),
  ('pms', 'pms_researcher', 'research fellow / staff');

SELECT CONCAT(role_id, ' = ', name, ' (', access_role, ')') AS pms_roles FROM role_catalog
 WHERE module_id = 'pms' AND role_id IN ('pms_admin', 'pms_pi', 'pms_co_pi', 'pms_researcher') ORDER BY sort_order;
