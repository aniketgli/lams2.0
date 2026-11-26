-- =============================================================================================
-- PMS projects: fix the codes "WII-PRJ-1.0" … "WII-PRJ-80.0" to "WII-PRJ-0001" … "WII-PRJ-0080"
-- =============================================================================================
-- scripts/sql/data/pms_projects_initial.sql (first version) gave the 80 projects codes with ".0" at the end.
-- This changes only the code of those projects (WII-PRJ-<number>.0 → WII-PRJ-<4 digits>); nothing else changes,
-- nothing is deleted. If a fixed code would clash with a code that already exists, nothing is changed and the
-- clashes are listed. Safe to run again (the second run finds nothing to fix). Run after a backup.
-- =============================================================================================

DROP TEMPORARY TABLE IF EXISTS tmp_pms_code_fix;
CREATE TEMPORARY TABLE tmp_pms_code_fix AS
  SELECT id, code AS old_code, CONCAT('WII-PRJ-', LPAD(SUBSTRING_INDEX(SUBSTRING(code, 9), '.', 1), 4, '0')) AS new_code
    FROM projects WHERE code REGEXP '^WII-PRJ-[0-9]{1,4}[.]0+$';

SET @clashes := (SELECT COUNT(*) FROM tmp_pms_code_fix f JOIN projects p ON p.code = f.new_code AND p.id <> f.id);
SELECT CONCAT('Codes to fix: ', (SELECT COUNT(*) FROM tmp_pms_code_fix),
              IF(@clashes > 0, CONCAT(' — STOP: ', @clashes, ' would clash with an existing code, nothing changed (see the list below).'), '')) AS check_codes;
SELECT f.old_code, f.new_code, p.name AS already_used_by
  FROM tmp_pms_code_fix f JOIN projects p ON p.code = f.new_code AND p.id <> f.id;

UPDATE projects p JOIN tmp_pms_code_fix f ON f.id = p.id
   SET p.code = f.new_code
 WHERE @clashes = 0;

SELECT CONCAT('Projects with a ".0" code now: ', COUNT(*)) AS result FROM projects WHERE code REGEXP '^WII-PRJ-[0-9]{1,4}[.]0+$';
SELECT MIN(code) AS first_code, MAX(code) AS last_code FROM projects WHERE code REGEXP '^WII-PRJ-[0-9]{4}$';

DROP TEMPORARY TABLE tmp_pms_code_fix;
