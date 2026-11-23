-- =============================================================================================
-- Biometric IDs with letters (SACON: SAC1001) next to 4-digit WII IDs
-- =============================================================================================
-- * institutes.biometric_id_format: '4 digits' (default, every existing institute) or 'Letters and digits'
--   (up to 10 letters / digits). Set it for SACON in Master Settings → Institutes.
-- * Every column that holds a biometric ID grows from 4 to 10 characters (CHAR(4)/VARCHAR(4) → VARCHAR(10)),
--   keeping NULL / NOT NULL and defaults. Values are not changed. The eSSL Attendance table is not touched.
-- Safe to run again. Run as root after a backup, with the app stopped.
-- =============================================================================================

DROP PROCEDURE IF EXISTS lams_bio_format;
DELIMITER $$
CREATE PROCEDURE lams_bio_format()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE t VARCHAR(64); DECLARE c VARCHAR(64); DECLARE n VARCHAR(3); DECLARE d TEXT;
  DECLARE cols CURSOR FOR
    SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE IN ('char', 'varchar') AND CHARACTER_MAXIMUM_LENGTH = 4
       AND TABLE_NAME NOT LIKE 'zz\_%' AND TABLE_NAME <> 'Attendance'
       AND COLUMN_NAME IN ('biometric_id', 'target_biometric_id', 'actor_biometric_id', 'changed_by_biometric_id',
                           'created_by', 'updated_by', 'deleted_by', 'last_updated_by', 'status_changed_by');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'institutes' AND COLUMN_NAME = 'biometric_id_format') THEN
    ALTER TABLE institutes ADD COLUMN biometric_id_format VARCHAR(20) NOT NULL DEFAULT '4 digits',
      ADD CONSTRAINT chk_institutes_bio_format CHECK (biometric_id_format IN ('4 digits', 'Letters and digits'));
  END IF;

  -- Foreign keys link these columns (user_module_roles, employee_photos, … → users.biometric_id); with the check
  -- off each column can be widened in turn. Every value stays as it is, so no link is broken.
  SET @old_fkc = @@FOREIGN_KEY_CHECKS;
  SET FOREIGN_KEY_CHECKS = 0;
  OPEN cols;
  read_loop: LOOP
    FETCH cols INTO t, c, n, d;
    IF done = 1 THEN LEAVE read_loop; END IF;
    SET @sql = CONCAT('ALTER TABLE `', t, '` MODIFY COLUMN `', c, '` VARCHAR(10) ',
                      IF(n = 'NO', 'NOT NULL', 'NULL'), IF(d IS NULL, '', CONCAT(' DEFAULT ', QUOTE(d))));
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END LOOP;
  CLOSE cols;
  SET FOREIGN_KEY_CHECKS = @old_fkc;
END$$
DELIMITER ;
CALL lams_bio_format();
DROP PROCEDURE lams_bio_format;

SELECT CONCAT('biometric IDs: ', (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
         AND COLUMN_NAME = 'biometric_id' AND CHARACTER_MAXIMUM_LENGTH = 10), ' column(s) now hold up to 10 characters') AS biometric_ids;
