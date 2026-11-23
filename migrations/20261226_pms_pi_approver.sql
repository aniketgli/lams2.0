-- =============================================================================================
-- PMS: the PI is the one approver
-- =============================================================================================
-- A PMS employee (project / contract types) has one approver, the PI, chosen on the employee form in the place of
-- the reporting manager. The PMS role "Principal Investigator (PI)" therefore acts as the reporting manager in PMS
-- (it acted as the HoD before; PMS has no HoD). Nobody's grants change. Safe to run again.
-- =============================================================================================

UPDATE role_catalog SET access_role = 'reporting_manager',
       description = 'Approves the leave, manual attendance and outdoor duty of the PMS employees who have them as PI.'
 WHERE module_id = 'pms' AND role_id = 'pms_pi';

SELECT CONCAT('PMS PI acts as: ', access_role) AS pi FROM role_catalog WHERE module_id = 'pms' AND role_id = 'pms_pi';
