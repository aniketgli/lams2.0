-- =============================================================================================
-- Normalization, step 6 of 6: foreign keys on every link
-- =============================================================================================
-- Requests, balances, certificates, roles, photos, histories, report schedules and sessions now point at their
-- employee / leave type / request / schedule with a foreign key, so the database refuses a link to something
-- that does not exist.
--   * an employee's own records go with the account when it is deleted (ON DELETE CASCADE) — the same records the
--     screens already stopped showing once the account was gone;
--   * a deleted manager / HoD is cleared from pending routing (ON DELETE SET NULL);
--   * a leave type in use cannot be deleted.
-- Who-did-what columns (applied_by, action_by, uploaded_by, created_by, …) and the logs keep their value as
-- history and get no foreign key, so a log entry survives when the person's account is deleted.
-- If a table already holds a row pointing at something that no longer exists, the file stops and names it:
-- see scripts/sql/normalization_orphans.sql. Safe to run again.
-- =============================================================================================

CALL lams_assert(lams_has_fk('leave_requests', 'fk_leave_requests_user') OR (SELECT COUNT(*) FROM leave_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_requests.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_requests', 'fk_leave_requests_user'), 'ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_requests', 'fk_leave_requests_type') OR (SELECT COUNT(*) FROM leave_requests x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_requests.leave_type_id has rows pointing at a leave_types row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_requests', 'fk_leave_requests_type'), 'ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id)');

CALL lams_assert(lams_has_fk('leave_requests', 'fk_leave_requests_manager') OR (SELECT COUNT(*) FROM leave_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_requests.manager_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_requests', 'fk_leave_requests_manager'), 'ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_requests', 'fk_leave_requests_reviewer') OR (SELECT COUNT(*) FROM leave_requests x LEFT JOIN users r ON r.id = x.reviewer_id WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_requests.reviewer_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_requests', 'fk_leave_requests_reviewer'), 'ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_requests', 'fk_leave_requests_linked') OR (SELECT COUNT(*) FROM leave_requests x LEFT JOIN leave_requests r ON r.id = x.linked_to WHERE x.linked_to IS NOT NULL AND r.id IS NULL) = 0,
  'leave_requests.linked_to has rows pointing at a leave_requests row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_requests', 'fk_leave_requests_linked'), 'ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_linked FOREIGN KEY (linked_to) REFERENCES leave_requests (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_balances', 'fk_leave_balances_user') OR (SELECT COUNT(*) FROM leave_balances x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_balances.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_balances', 'fk_leave_balances_user'), 'ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_balances', 'fk_leave_balances_type') OR (SELECT COUNT(*) FROM leave_balances x LEFT JOIN leave_types r ON r.id = x.leave_type_id WHERE x.leave_type_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_balances.leave_type_id has rows pointing at a leave_types row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_balances', 'fk_leave_balances_type'), 'ALTER TABLE leave_balances ADD CONSTRAINT fk_leave_balances_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id)');

CALL lams_assert(lams_has_fk('leave_certificates', 'fk_leave_certificates_request') OR (SELECT COUNT(*) FROM leave_certificates x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_certificates.request_id has rows pointing at a leave_requests row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_certificates', 'fk_leave_certificates_request'), 'ALTER TABLE leave_certificates ADD CONSTRAINT fk_leave_certificates_request FOREIGN KEY (request_id) REFERENCES leave_requests (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_comp_off_uses', 'fk_comp_off_request') OR (SELECT COUNT(*) FROM leave_comp_off_uses x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_comp_off_uses.request_id has rows pointing at a leave_requests row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_comp_off_uses', 'fk_comp_off_request'), 'ALTER TABLE leave_comp_off_uses ADD CONSTRAINT fk_comp_off_request FOREIGN KEY (request_id) REFERENCES leave_requests (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_comp_off_uses', 'fk_comp_off_user') OR (SELECT COUNT(*) FROM leave_comp_off_uses x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_comp_off_uses.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_comp_off_uses', 'fk_comp_off_user'), 'ALTER TABLE leave_comp_off_uses ADD CONSTRAINT fk_comp_off_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_joining_reports', 'fk_joining_request') OR (SELECT COUNT(*) FROM leave_joining_reports x LEFT JOIN leave_requests r ON r.id = x.request_id WHERE x.request_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_joining_reports.request_id has rows pointing at a leave_requests row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_joining_reports', 'fk_joining_request'), 'ALTER TABLE leave_joining_reports ADD CONSTRAINT fk_joining_request FOREIGN KEY (request_id) REFERENCES leave_requests (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_joining_reports', 'fk_joining_user') OR (SELECT COUNT(*) FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_joining_reports.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_joining_reports', 'fk_joining_user'), 'ALTER TABLE leave_joining_reports ADD CONSTRAINT fk_joining_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_joining_reports', 'fk_joining_manager') OR (SELECT COUNT(*) FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_joining_reports.manager_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_joining_reports', 'fk_joining_manager'), 'ALTER TABLE leave_joining_reports ADD CONSTRAINT fk_joining_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_joining_reports', 'fk_joining_reviewer') OR (SELECT COUNT(*) FROM leave_joining_reports x LEFT JOIN users r ON r.id = x.reviewer_id WHERE x.reviewer_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_joining_reports.reviewer_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_joining_reports', 'fk_joining_reviewer'), 'ALTER TABLE leave_joining_reports ADD CONSTRAINT fk_joining_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_joining_certificates', 'fk_joining_certificates_report') OR (SELECT COUNT(*) FROM leave_joining_certificates x LEFT JOIN leave_joining_reports r ON r.id = x.report_id WHERE x.report_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_joining_certificates.report_id has rows pointing at a leave_joining_reports row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_joining_certificates', 'fk_joining_certificates_report'), 'ALTER TABLE leave_joining_certificates ADD CONSTRAINT fk_joining_certificates_report FOREIGN KEY (report_id) REFERENCES leave_joining_reports (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('leave_types', 'fk_leave_types_after_exhausted') OR (SELECT COUNT(*) FROM leave_types x LEFT JOIN leave_types r ON r.id = x.after_exhausted_type_id WHERE x.after_exhausted_type_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_types.after_exhausted_type_id has rows pointing at a leave_types row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_types', 'fk_leave_types_after_exhausted'), 'ALTER TABLE leave_types ADD CONSTRAINT fk_leave_types_after_exhausted FOREIGN KEY (after_exhausted_type_id) REFERENCES leave_types (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('leave_types', 'fk_leave_types_debit_from') OR (SELECT COUNT(*) FROM leave_types x LEFT JOIN leave_types r ON r.id = x.debit_from_type_id WHERE x.debit_from_type_id IS NOT NULL AND r.id IS NULL) = 0,
  'leave_types.debit_from_type_id has rows pointing at a leave_types row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('leave_types', 'fk_leave_types_debit_from'), 'ALTER TABLE leave_types ADD CONSTRAINT fk_leave_types_debit_from FOREIGN KEY (debit_from_type_id) REFERENCES leave_types (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('manual_attendance_requests', 'fk_manual_attendance_user') OR (SELECT COUNT(*) FROM manual_attendance_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'manual_attendance_requests.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('manual_attendance_requests', 'fk_manual_attendance_user'), 'ALTER TABLE manual_attendance_requests ADD CONSTRAINT fk_manual_attendance_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('manual_attendance_requests', 'fk_manual_attendance_manager') OR (SELECT COUNT(*) FROM manual_attendance_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL) = 0,
  'manual_attendance_requests.manager_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('manual_attendance_requests', 'fk_manual_attendance_manager'), 'ALTER TABLE manual_attendance_requests ADD CONSTRAINT fk_manual_attendance_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('outdoor_duty_requests', 'fk_outdoor_duty_user') OR (SELECT COUNT(*) FROM outdoor_duty_requests x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'outdoor_duty_requests.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('outdoor_duty_requests', 'fk_outdoor_duty_user'), 'ALTER TABLE outdoor_duty_requests ADD CONSTRAINT fk_outdoor_duty_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('outdoor_duty_requests', 'fk_outdoor_duty_manager') OR (SELECT COUNT(*) FROM outdoor_duty_requests x LEFT JOIN users r ON r.id = x.manager_id WHERE x.manager_id IS NOT NULL AND r.id IS NULL) = 0,
  'outdoor_duty_requests.manager_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('outdoor_duty_requests', 'fk_outdoor_duty_manager'), 'ALTER TABLE outdoor_duty_requests ADD CONSTRAINT fk_outdoor_duty_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL');

CALL lams_assert(lams_has_fk('report_runs', 'fk_report_runs_schedule') OR (SELECT COUNT(*) FROM report_runs x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL) = 0,
  'report_runs.schedule_id has rows pointing at a report_schedules row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('report_runs', 'fk_report_runs_schedule'), 'ALTER TABLE report_runs ADD CONSTRAINT fk_report_runs_schedule FOREIGN KEY (schedule_id) REFERENCES report_schedules (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('report_schedule_recipients', 'fk_report_recipients_schedule') OR (SELECT COUNT(*) FROM report_schedule_recipients x LEFT JOIN report_schedules r ON r.id = x.schedule_id WHERE x.schedule_id IS NOT NULL AND r.id IS NULL) = 0,
  'report_schedule_recipients.schedule_id has rows pointing at a report_schedules row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('report_schedule_recipients', 'fk_report_recipients_schedule'), 'ALTER TABLE report_schedule_recipients ADD CONSTRAINT fk_report_recipients_schedule FOREIGN KEY (schedule_id) REFERENCES report_schedules (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('report_schedule_recipients', 'fk_report_recipients_user') OR (SELECT COUNT(*) FROM report_schedule_recipients x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'report_schedule_recipients.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('report_schedule_recipients', 'fk_report_recipients_user'), 'ALTER TABLE report_schedule_recipients ADD CONSTRAINT fk_report_recipients_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

CALL lams_assert(lams_has_fk('user_module_roles', 'fk_user_module_roles_user') OR (SELECT COUNT(*) FROM user_module_roles x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL) = 0,
  'user_module_roles.biometric_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('user_module_roles', 'fk_user_module_roles_user'), 'ALTER TABLE user_module_roles ADD CONSTRAINT fk_user_module_roles_user FOREIGN KEY (biometric_id) REFERENCES users (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE');

CALL lams_assert(lams_has_fk('employee_photos', 'fk_employee_photos_user') OR (SELECT COUNT(*) FROM employee_photos x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL) = 0,
  'employee_photos.biometric_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('employee_photos', 'fk_employee_photos_user'), 'ALTER TABLE employee_photos ADD CONSTRAINT fk_employee_photos_user FOREIGN KEY (biometric_id) REFERENCES users (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE');

CALL lams_assert(lams_has_fk('user_histories', 'fk_user_histories_user') OR (SELECT COUNT(*) FROM user_histories x LEFT JOIN users r ON r.biometric_id = x.biometric_id WHERE x.biometric_id IS NOT NULL AND r.biometric_id IS NULL) = 0,
  'user_histories.biometric_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('user_histories', 'fk_user_histories_user'), 'ALTER TABLE user_histories ADD CONSTRAINT fk_user_histories_user FOREIGN KEY (biometric_id) REFERENCES users (biometric_id) ON DELETE CASCADE ON UPDATE CASCADE');

CALL lams_assert(lams_has_fk('web_sessions', 'fk_web_sessions_user') OR (SELECT COUNT(*) FROM web_sessions x LEFT JOIN users r ON r.id = x.user_id WHERE x.user_id IS NOT NULL AND r.id IS NULL) = 0,
  'web_sessions.user_id has rows pointing at a users row that does not exist. See scripts/sql/normalization_orphans.sql, then run this file again.');
CALL lams_exec_if(NOT lams_has_fk('web_sessions', 'fk_web_sessions_user'), 'ALTER TABLE web_sessions ADD CONSTRAINT fk_web_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

-- Role grants → role catalog, when every grant names a catalog role (older grants may use an alias; then the
-- grant check in "npm run db:check" lists them and the key is added on the next run)
CALL lams_exec_if(NOT lams_has_fk('user_module_roles', 'fk_user_module_roles_role')
  AND (SELECT COUNT(*) FROM user_module_roles g LEFT JOIN role_catalog r ON r.module_id = g.module_id AND r.role_id = g.role_id WHERE r.role_id IS NULL) = 0,
  'ALTER TABLE user_module_roles ADD CONSTRAINT fk_user_module_roles_role FOREIGN KEY (module_id, role_id) REFERENCES role_catalog (module_id, role_id) ON UPDATE CASCADE');
SELECT IF(lams_has_fk('user_module_roles', 'fk_user_module_roles_role'), 'role grants: foreign key added',
          'role grants: some grants use a role id that is not in the role catalog; the foreign key will be added once they are fixed') AS role_grants;

-- Helpers are no longer needed
DROP PROCEDURE IF EXISTS lams_convert_collation;
SELECT 'step 6 of 6 done: foreign keys. Normalization complete.' AS normalization;
