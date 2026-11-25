-- =============================================================================================
-- PMS designations (35), all for the employee type "Project Staff"
-- =============================================================================================
-- Adds the designations below to the designations master with employment type Project Staff, so they appear in
-- PMS → Master Settings → Profile Masters → Designations and on the PMS employee form.
--   * Only adds rows (INSERT … WHERE NOT EXISTS): no row is changed or deleted.
--   * A name that already exists (e.g. an HRMS designation with the same name) is NOT changed: it is listed at the end
--     so it can be decided by hand. Designation names are unique.
--   * Codes: PMS-<NAME>, e.g. PMS-PROJECT-SCIENTIST-I.
-- Safe to run again. Run after a backup.
-- =============================================================================================

SET @project_staff := (SELECT code FROM employee_types WHERE LOWER(name) = 'project staff' LIMIT 1);
SELECT IF(@project_staff IS NULL, 'STOP: no employee type named "Project Staff" — nothing will be added.', CONCAT('Project Staff type code: ', @project_staff)) AS check_type;

DROP TEMPORARY TABLE IF EXISTS tmp_pms_designations;
-- Same column types and collation as the designations table, so names compare without collation errors.
CREATE TEMPORARY TABLE tmp_pms_designations AS SELECT name, code FROM designations WHERE 1 = 0;
INSERT INTO tmp_pms_designations (name, code) VALUES
  ('Administrative Assistant', 'PMS-ADMINISTRATIVE-ASSISTANT'),
  ('Consultant-A', 'PMS-CONSULTANT-A'),
  ('Consultant-B', 'PMS-CONSULTANT-B'),
  ('Consultant-C', 'PMS-CONSULTANT-C'),
  ('Data Entry Operator-I', 'PMS-DATA-ENTRY-OPERATOR-I'),
  ('Data Entry Operator-II', 'PMS-DATA-ENTRY-OPERATOR-II'),
  ('Field Assistant', 'PMS-FIELD-ASSISTANT'),
  ('Field Worker', 'PMS-FIELD-WORKER'),
  ('GIS Engineer', 'PMS-GIS-ENGINEER'),
  ('Information Officer', 'PMS-INFORMATION-OFFICER'),
  ('IT Officer', 'PMS-IT-OFFICER'),
  ('Junior Analyst', 'PMS-JUNIOR-ANALYST'),
  ('Junior Veterinary Consultant', 'PMS-JUNIOR-VETERINARY-CONSULTANT'),
  ('Laboratory Assistant', 'PMS-LABORATORY-ASSISTANT'),
  ('Multi Tasking Staff', 'PMS-MULTI-TASKING-STAFF'),
  ('Office Assistant', 'PMS-OFFICE-ASSISTANT'),
  ('PhD Student', 'PMS-PHD-STUDENT'),
  ('Principal Project Associate', 'PMS-PRINCIPAL-PROJECT-ASSOCIATE'),
  ('Programme Officer', 'PMS-PROGRAMME-OFFICER'),
  ('Project Assistant', 'PMS-PROJECT-ASSISTANT'),
  ('Project Associate-I', 'PMS-PROJECT-ASSOCIATE-I'),
  ('Project Associate-II', 'PMS-PROJECT-ASSOCIATE-II'),
  ('Project Manager', 'PMS-PROJECT-MANAGER'),
  ('Project Scientist-I', 'PMS-PROJECT-SCIENTIST-I'),
  ('Project Scientist-II', 'PMS-PROJECT-SCIENTIST-II'),
  ('Project Scientist-III', 'PMS-PROJECT-SCIENTIST-III'),
  ('Project Technical Support-II', 'PMS-PROJECT-TECHNICAL-SUPPORT-II'),
  ('Project Veterinarian', 'PMS-PROJECT-VETERINARIAN'),
  ('Research Scientist-II', 'PMS-RESEARCH-SCIENTIST-II'),
  ('Research Scientist-III', 'PMS-RESEARCH-SCIENTIST-III'),
  ('Senior Project Associate', 'PMS-SENIOR-PROJECT-ASSOCIATE'),
  ('Senior Research Fellow', 'PMS-SENIOR-RESEARCH-FELLOW'),
  ('Subject Matter Specialist (SMS)', 'PMS-SUBJECT-MATTER-SPECIALIST-SMS'),
  ('Technical Assistant', 'PMS-TECHNICAL-ASSISTANT'),
  ('Web Designer', 'PMS-WEB-DESIGNER');

INSERT INTO designations (name, code, employee_type_code, status)
SELECT t.name, t.code, @project_staff, 'ACTIVE'
  FROM tmp_pms_designations t
 WHERE @project_staff IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM designations d WHERE LOWER(d.name) = LOWER(t.name))
   AND NOT EXISTS (SELECT 1 FROM designations d WHERE d.code = t.code);

SELECT CONCAT('Project Staff designations now: ', COUNT(*), ' (of the 35: ',
       (SELECT COUNT(*) FROM designations d JOIN tmp_pms_designations t ON LOWER(d.name) = LOWER(t.name) WHERE d.employee_type_code = @project_staff), ')') AS added
  FROM designations WHERE employee_type_code = @project_staff;

-- Names that already existed with another employment type (left as they were):
SELECT d.name, d.code, COALESCE(d.employee_type_code, '(none: shared)') AS employment_type
  FROM designations d JOIN tmp_pms_designations t ON LOWER(d.name) = LOWER(t.name)
 WHERE NOT (d.employee_type_code <=> @project_staff);

DROP TEMPORARY TABLE tmp_pms_designations;
