-- =============================================================================================
-- PMS has no HoD role
-- =============================================================================================
-- The PMS HoD role (pms_pi) is switched off in the role catalog, so it is no longer shown or given in
-- HRMS → User Controls (PMS column). The row is kept (is_active = 0), nothing is deleted, and no grant row is
-- changed; a grant of this role simply stops giving any access. PMS employees have no HoD on their profile, so
-- their approvals (Reporting Manager) are not affected.
--
-- Before running: the first SELECT lists who holds the PMS HoD role now. Safe to run again.
-- To switch it back on: UPDATE role_catalog SET is_active = 1 WHERE module_id = 'pms' AND role_id = 'pms_pi';
-- =============================================================================================

SELECT g.biometric_id, u.name, g.role_id, g.status AS grant_status
  FROM user_module_roles g LEFT JOIN users u ON u.biometric_id = g.biometric_id
 WHERE g.module_id = 'pms'
   AND LOWER(g.role_id) IN ('pms_pi', 'hod', 'reviewing manager', 'pi', 'project pi', 'principal investigator', 'principal investigator (pi)');

UPDATE role_catalog SET is_active = 0 WHERE module_id = 'pms' AND role_id = 'pms_pi';

SELECT CONCAT(role_id, ' = ', name, ' (active: ', is_active, ')') AS pms_hod FROM role_catalog
 WHERE module_id = 'pms' AND role_id = 'pms_pi';
