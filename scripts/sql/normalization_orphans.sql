-- =============================================================================================
-- Rows that point at something that no longer exists (run before / when step 6 stops)
-- =============================================================================================
-- Part 1 only lists them. Part 2 removes them; it runs only after:  SET @confirm_orphans = 'YES';
--   mysql -u root -p lams2_db < scripts/sql/normalization_orphans.sql
-- Take a backup first. A row here belongs to an account / leave type / request that was already deleted,
-- so no screen shows it today.
-- =============================================================================================

SELECT 'leave_requests.user_id' AS link, COUNT(*) AS orphans FROM leave_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_requests.leave_type_id' AS link, COUNT(*) AS orphans FROM leave_requests x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_requests.manager_id' AS link, COUNT(*) AS orphans FROM leave_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_requests.reviewer_id' AS link, COUNT(*) AS orphans FROM leave_requests x LEFT JOIN users r ON r.id = x.reviewer_id WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_requests.linked_to' AS link, COUNT(*) AS orphans FROM leave_requests x LEFT JOIN leave_requests r ON r.id = x.linked_to WHERE x.linked_to IS NOT NULL AND r.id IS NULL;
SELECT 'leave_balances.user_id' AS link, COUNT(*) AS orphans FROM leave_balances x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_balances.leave_type_id' AS link, COUNT(*) AS orphans FROM leave_balances x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_certificates.request_id' AS link, COUNT(*) AS orphans FROM leave_certificates x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_comp_off_uses.request_id' AS link, COUNT(*) AS orphans FROM leave_comp_off_uses x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_comp_off_uses.user_id' AS link, COUNT(*) AS orphans FROM leave_comp_off_uses x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_joining_reports.request_id' AS link, COUNT(*) AS orphans FROM leave_joining_reports x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_joining_reports.user_id' AS link, COUNT(*) AS orphans FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_joining_reports.manager_id' AS link, COUNT(*) AS orphans FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_joining_reports.reviewer_id' AS link, COUNT(*) AS orphans FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.reviewer_id WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_joining_certificates.report_id' AS link, COUNT(*) AS orphans FROM leave_joining_certificates x LEFT JOIN leave_joining_reports r ON r.id = x.report_id WHERE x.report_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_types.after_exhausted_type_id' AS link, COUNT(*) AS orphans FROM leave_types x LEFT JOIN leave_types r ON r.id = x.after_exhausted_type_id WHERE x.after_exhausted_type_id IS NOT NULL AND r.id IS NULL;
SELECT 'leave_types.debit_from_type_id' AS link, COUNT(*) AS orphans FROM leave_types x LEFT JOIN leave_types r ON r.id = x.debit_from_type_id WHERE x.debit_from_type_id IS NOT NULL AND r.id IS NULL;
SELECT 'manual_attendance_requests.user_id' AS link, COUNT(*) AS orphans FROM manual_attendance_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'manual_attendance_requests.manager_id' AS link, COUNT(*) AS orphans FROM manual_attendance_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL;
SELECT 'outdoor_duty_requests.user_id' AS link, COUNT(*) AS orphans FROM outdoor_duty_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'outdoor_duty_requests.manager_id' AS link, COUNT(*) AS orphans FROM outdoor_duty_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL;
SELECT 'report_runs.schedule_id' AS link, COUNT(*) AS orphans FROM report_runs x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL;
SELECT 'report_schedule_recipients.schedule_id' AS link, COUNT(*) AS orphans FROM report_schedule_recipients x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL;
SELECT 'report_schedule_recipients.user_id' AS link, COUNT(*) AS orphans FROM report_schedule_recipients x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;
SELECT 'user_module_roles.biometric_id' AS link, COUNT(*) AS orphans FROM user_module_roles x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL;
SELECT 'employee_photos.biometric_id' AS link, COUNT(*) AS orphans FROM employee_photos x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL;
SELECT 'user_histories.biometric_id' AS link, COUNT(*) AS orphans FROM user_histories x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL;
SELECT 'web_sessions.user_id' AS link, COUNT(*) AS orphans FROM web_sessions x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL;

-- Part 2 (only with @confirm_orphans = 'YES')
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_requests x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_requests x LEFT JOIN users r ON r.id = x.manager_id SET x.manager_id = NULL WHERE x.manager_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_requests x LEFT JOIN users r ON r.id = x.reviewer_id SET x.reviewer_id = NULL WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_requests x LEFT JOIN leave_requests r ON r.id = x.linked_to SET x.linked_to = NULL WHERE x.linked_to IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_balances x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_balances x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_certificates x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_comp_off_uses x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_comp_off_uses x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_joining_reports x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_joining_reports x LEFT JOIN users r ON r.id = x.manager_id SET x.manager_id = NULL WHERE x.manager_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_joining_reports x LEFT JOIN users r ON r.id = x.reviewer_id SET x.reviewer_id = NULL WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM leave_joining_certificates x LEFT JOIN leave_joining_reports r ON r.id = x.report_id WHERE x.report_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_types x LEFT JOIN leave_types r ON r.id = x.after_exhausted_type_id SET x.after_exhausted_type_id = NULL WHERE x.after_exhausted_type_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE leave_types x LEFT JOIN leave_types r ON r.id = x.debit_from_type_id SET x.debit_from_type_id = NULL WHERE x.debit_from_type_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM manual_attendance_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE manual_attendance_requests x LEFT JOIN users r ON r.id = x.manager_id SET x.manager_id = NULL WHERE x.manager_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM outdoor_duty_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'UPDATE outdoor_duty_requests x LEFT JOIN users r ON r.id = x.manager_id SET x.manager_id = NULL WHERE x.manager_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM report_runs x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM report_schedule_recipients x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM report_schedule_recipients x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM user_module_roles x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM employee_photos x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM user_histories x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF(@confirm_orphans = 'YES', 'DELETE x FROM web_sessions x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL', 'DO 0'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
