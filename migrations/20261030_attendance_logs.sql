-- Migration: biometric punch log (table `Atten`). Safe to re-run.
--
-- The biometric machine software (on its own server) exports every punch in
-- parallel into this table. The portal only READS it: daily attendance (first
-- punch = In, last punch = Out) is worked out from these rows. Only punches from
-- machines registered in Master Settings -> Biometric Machines (active, purpose
-- Attendance) are counted; DeviceSR is matched with the machine's serial number.
--
-- Column names follow the export format, so the software can write here without changes.

CREATE TABLE IF NOT EXISTS `Atten` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `EmployeeCode` VARCHAR(50)  NOT NULL,
  `LogDateTime`  DATETIME(6)  NOT NULL,
  `LogDate`      DATE         NOT NULL,
  `LogTime`      TIME(6)      NULL,
  `Direction`    VARCHAR(20)  NULL,
  `DeviceName`   VARCHAR(150) NULL,
  `DeviceSR`     VARCHAR(120) NULL,
  `DeviceId`     VARCHAR(50)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_atten_date_emp` (`LogDate`, `EmployeeCode`),
  KEY `idx_atten_emp_date` (`EmployeeCode`, `LogDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recommended: give the machine software its own MySQL account that can only add
-- rows to this one table (run as a MySQL admin; choose a strong password and the
-- software server's address instead of '%'):
--
--   CREATE USER 'biometric_export'@'%' IDENTIFIED BY '<strong password>';
--   GRANT SELECT, INSERT ON lams_db.`Atten` TO 'biometric_export'@'%';
--
-- Old punches from the previous server can be copied once, e.g.:
--   mysqldump --no-create-info old_db Atten > atten.sql   (on the old server)
--   mysql lams_db < atten.sql                             (here)
