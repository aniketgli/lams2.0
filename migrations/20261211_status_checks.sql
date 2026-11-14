-- Migration: every status column accepts only its known values, so a typo such as 'aproved' is refused by the database.
-- Safe to re-run. For each column it:
--   1. writes existing values in the column's one case (users / requests: lower case; lookup values / recipients: UPPER case),
--   2. lists any row whose status is still unknown (fix those, then run this file again),
--   3. adds the CHECK constraint only when every row fits and the constraint is not there yet.
-- CHECK constraints are enforced from MySQL 8.0.16; older servers accept the statement and ignore it.
-- The application reads these columns case-insensitively, so step 1 changes nothing on screen.
-- (The comparison in step 1 is binary, so 'Active' is rewritten even where the collation ignores case.)

-- users.status: active, inactive, expired
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users');
SET @ddl := IF(@tbl = 1, 'UPDATE users SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''users'' AS table_name, id, status AS unknown_status FROM users WHERE NOT (status IN (''active'', ''inactive'', ''expired''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM users WHERE NOT (status IN (''active'', ''inactive'', ''expired''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'chk_users_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE users ADD CONSTRAINT chk_users_status CHECK (status IN (''active'', ''inactive'', ''expired''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leave_requests.status: pending_l1, pending_l2, approved, rejected
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests');
SET @ddl := IF(@tbl = 1, 'UPDATE leave_requests SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''leave_requests'' AS table_name, id, status AS unknown_status FROM leave_requests WHERE NOT (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM leave_requests WHERE NOT (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND CONSTRAINT_NAME = 'chk_leave_requests_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_requests_status CHECK (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leave_joining_reports.status: pending_l1, pending_l2, approved, rejected
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_joining_reports');
SET @ddl := IF(@tbl = 1, 'UPDATE leave_joining_reports SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''leave_joining_reports'' AS table_name, id, status AS unknown_status FROM leave_joining_reports WHERE NOT (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM leave_joining_reports WHERE NOT (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_joining_reports' AND CONSTRAINT_NAME = 'chk_leave_joining_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE leave_joining_reports ADD CONSTRAINT chk_leave_joining_status CHECK (status IN (''pending_l1'', ''pending_l2'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- manual_attendance_requests.status: pending, approved, rejected
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'manual_attendance_requests');
SET @ddl := IF(@tbl = 1, 'UPDATE manual_attendance_requests SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''manual_attendance_requests'' AS table_name, id, status AS unknown_status FROM manual_attendance_requests WHERE NOT (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM manual_attendance_requests WHERE NOT (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'manual_attendance_requests' AND CONSTRAINT_NAME = 'chk_manual_attendance_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE manual_attendance_requests ADD CONSTRAINT chk_manual_attendance_status CHECK (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outdoor_duty_requests.status: pending, approved, rejected
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'outdoor_duty_requests');
SET @ddl := IF(@tbl = 1, 'UPDATE outdoor_duty_requests SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''outdoor_duty_requests'' AS table_name, id, status AS unknown_status FROM outdoor_duty_requests WHERE NOT (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM outdoor_duty_requests WHERE NOT (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'outdoor_duty_requests' AND CONSTRAINT_NAME = 'chk_outdoor_duty_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE outdoor_duty_requests ADD CONSTRAINT chk_outdoor_duty_status CHECK (status IN (''pending'', ''approved'', ''rejected''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email_outbox.status: pending, sending, sent, failed, not_sent
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_outbox');
SET @ddl := IF(@tbl = 1, 'UPDATE email_outbox SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''email_outbox'' AS table_name, id, status AS unknown_status FROM email_outbox WHERE NOT (status IN (''pending'', ''sending'', ''sent'', ''failed'', ''not_sent''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM email_outbox WHERE NOT (status IN (''pending'', ''sending'', ''sent'', ''failed'', ''not_sent''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_outbox' AND CONSTRAINT_NAME = 'chk_email_outbox_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE email_outbox ADD CONSTRAINT chk_email_outbox_status CHECK (status IN (''pending'', ''sending'', ''sent'', ''failed'', ''not_sent''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- report_schedules.status: active, paused
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_schedules');
SET @ddl := IF(@tbl = 1, 'UPDATE report_schedules SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''report_schedules'' AS table_name, id, status AS unknown_status FROM report_schedules WHERE NOT (status IN (''active'', ''paused''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM report_schedules WHERE NOT (status IN (''active'', ''paused''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_schedules' AND CONSTRAINT_NAME = 'chk_report_schedules_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE report_schedules ADD CONSTRAINT chk_report_schedules_status CHECK (status IN (''active'', ''paused''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- report_schedules.last_status: sent, partial, failed, no_recipients (or empty)
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_schedules');
SET @ddl := IF(@tbl = 1, 'UPDATE report_schedules SET last_status = LOWER(TRIM(last_status)) WHERE CAST(last_status AS BINARY) <> CAST(LOWER(TRIM(last_status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''report_schedules'' AS table_name, id, last_status AS unknown_status FROM report_schedules WHERE NOT (last_status IN (''sent'', ''partial'', ''failed'', ''no_recipients'') OR last_status IS NULL)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM report_schedules WHERE NOT (last_status IN (''sent'', ''partial'', ''failed'', ''no_recipients'') OR last_status IS NULL)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_schedules' AND CONSTRAINT_NAME = 'chk_report_schedules_last');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE report_schedules ADD CONSTRAINT chk_report_schedules_last CHECK (last_status IN (''sent'', ''partial'', ''failed'', ''no_recipients'') OR last_status IS NULL)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- report_runs.status: sent, partial, failed, no_recipients
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_runs');
SET @ddl := IF(@tbl = 1, 'UPDATE report_runs SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''report_runs'' AS table_name, id, status AS unknown_status FROM report_runs WHERE NOT (status IN (''sent'', ''partial'', ''failed'', ''no_recipients''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM report_runs WHERE NOT (status IN (''sent'', ''partial'', ''failed'', ''no_recipients''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_runs' AND CONSTRAINT_NAME = 'chk_report_runs_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE report_runs ADD CONSTRAINT chk_report_runs_status CHECK (status IN (''sent'', ''partial'', ''failed'', ''no_recipients''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leave_types.status: active, inactive
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_types');
SET @ddl := IF(@tbl = 1, 'UPDATE leave_types SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''leave_types'' AS table_name, id, status AS unknown_status FROM leave_types WHERE NOT (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM leave_types WHERE NOT (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_types' AND CONSTRAINT_NAME = 'chk_leave_types_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE leave_types ADD CONSTRAINT chk_leave_types_status CHECK (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- leave_groups.status: active, inactive
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_groups');
SET @ddl := IF(@tbl = 1, 'UPDATE leave_groups SET status = LOWER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(LOWER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''leave_groups'' AS table_name, id, status AS unknown_status FROM leave_groups WHERE NOT (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM leave_groups WHERE NOT (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_groups' AND CONSTRAINT_NAME = 'chk_leave_groups_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE leave_groups ADD CONSTRAINT chk_leave_groups_status CHECK (status IN (''active'', ''inactive''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lookup_values.status: ACTIVE, INACTIVE
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lookup_values');
SET @ddl := IF(@tbl = 1, 'UPDATE lookup_values SET status = UPPER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(UPPER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''lookup_values'' AS table_name, id, status AS unknown_status FROM lookup_values WHERE NOT (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM lookup_values WHERE NOT (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lookup_values' AND CONSTRAINT_NAME = 'chk_lookup_values_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE lookup_values ADD CONSTRAINT chk_lookup_values_status CHECK (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notification_recipients.status: ACTIVE, INACTIVE
SET @tbl := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_recipients');
SET @ddl := IF(@tbl = 1, 'UPDATE notification_recipients SET status = UPPER(TRIM(status)) WHERE CAST(status AS BINARY) <> CAST(UPPER(TRIM(status)) AS BINARY) AND id > 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@tbl = 1, 'SELECT ''notification_recipients'' AS table_name, id, status AS unknown_status FROM notification_recipients WHERE NOT (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @bad := 0;
SET @ddl := IF(@tbl = 1, 'SELECT COUNT(*) INTO @bad FROM notification_recipients WHERE NOT (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_recipients' AND CONSTRAINT_NAME = 'chk_notification_recipients_status');
SET @ddl := IF(@tbl = 1 AND @bad = 0 AND @has = 0, 'ALTER TABLE notification_recipients ADD CONSTRAINT chk_notification_recipients_status CHECK (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
