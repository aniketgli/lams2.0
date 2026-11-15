-- Uploaded files can live on the upload disk (UPLOAD_DIR in .env, the RAID 5 data disk) instead of inside
-- the database. Each upload table gets `storage_path` (the file's path under UPLOAD_DIR), and `data`
-- becomes optional: new uploads fill one or the other; existing rows keep their `data` and still work.
-- No data is changed or moved. Safe to run again.
--
-- Run as lams2_admin:  mysql> source /full/path/to/migrations/20261214_upload_storage.sql

SET @t = 'employee_photos';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = 'storage_path') = 0,
  'ALTER TABLE employee_photos MODIFY data MEDIUMBLOB NULL, ADD COLUMN storage_path VARCHAR(200) NULL AFTER data', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'leave_certificates';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = 'storage_path') = 0,
  'ALTER TABLE leave_certificates MODIFY data MEDIUMBLOB NULL, ADD COLUMN storage_path VARCHAR(200) NULL AFTER data', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'leave_joining_certificates';
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = 'storage_path') = 0,
  'ALTER TABLE leave_joining_certificates MODIFY data MEDIUMBLOB NULL, ADD COLUMN storage_path VARCHAR(200) NULL AFTER data', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('employee_photos', 'leave_certificates', 'leave_joining_certificates')
   AND COLUMN_NAME IN ('data', 'storage_path') ORDER BY TABLE_NAME, COLUMN_NAME;
