-- =====================================================================================================
-- Remove the attendance tables the application does NOT use.                 !!! CANNOT BE UNDONE !!!
-- =====================================================================================================
-- The portal uses exactly two attendance tables, which are KEPT:
--   Attendance                   biometric punches written by the vendor export (capital A)
--   manual_attendance_requests   manual attendance applications
-- Every other table whose name contains "atten" (any case) is dropped, e.g. the old lower-case
-- `attendance` or its renamed copy `zz_retired_attendance`. Names are compared exactly, so
-- `Attendance` can never be matched by `attendance`.
--
-- How to run (as lams2_admin), after a backup:
--   mysqldump -u lams2_admin -p lams2_db > ~/lams2_db_before_attendance_cleanup_$(date +%F).sql
--   mysql -u lams2_admin -p lams2_db
--   mysql> source /erp_wii/applications/lams2.0/scripts/sql/drop_unused_attendance_tables.sql
--        -> only LISTS what would be dropped (nothing is changed)
--   mysql> SET @confirm_drop = 'YES';
--   mysql> source /erp_wii/applications/lams2.0/scripts/sql/drop_unused_attendance_tables.sql
--        -> drops the listed tables
-- =====================================================================================================

SET @confirm_drop = IFNULL(@confirm_drop, 'NO');

SELECT TABLE_NAME AS table_to_drop, TABLE_ROWS AS approx_rows, CREATE_TIME AS created
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
   AND LOWER(TABLE_NAME) LIKE '%atten%'
   AND BINARY TABLE_NAME NOT IN (BINARY 'Attendance', BINARY 'manual_attendance_requests');

SET @list = (SELECT GROUP_CONCAT(CONCAT('`', TABLE_NAME, '`') SEPARATOR ', ')
               FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
                AND LOWER(TABLE_NAME) LIKE '%atten%'
                AND BINARY TABLE_NAME NOT IN (BINARY 'Attendance', BINARY 'manual_attendance_requests'));

SET @sql = IF(@confirm_drop = 'YES' AND @list IS NOT NULL, CONCAT('DROP TABLE ', @list), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT CASE
         WHEN @list IS NULL THEN 'Nothing to drop: only Attendance and manual_attendance_requests exist.'
         WHEN @confirm_drop = 'YES' THEN CONCAT('Dropped: ', @list)
         ELSE CONCAT('Nothing dropped yet. To drop ', @list, ' run: SET @confirm_drop = ''YES''; and source this file again.')
       END AS result;
SET @confirm_drop = 'NO';

SELECT TABLE_NAME AS attendance_tables_now FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) LIKE '%atten%' ORDER BY TABLE_NAME;
