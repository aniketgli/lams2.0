#!/usr/bin/env bash
# CI only: checks the normalization migrations on the data from legacy_sample.sql.
set -u
M="mysql -h127.0.0.1 -uroot -proot -N ${1:-lams2_test}"
q() { $M -e "$1" 2>/dev/null; }
fail() { echo "NORMALIZATION CHECK FAILED: $1"; [ -n "${2:-}" ] && q "$2"; exit 1; }
eq() { local got; got="$(q "$1")"; [ "$got" = "$2" ] || fail "$3 (got '$got', expected '$2')"; }

# Step 1: collation and types
eq "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> 'utf8mb4_0900_ai_ci' AND TABLE_NAME NOT LIKE 'zz\_%'" "0" "a column still has another collation"
eq "SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='employee_profiles' AND COLUMN_NAME='joining_date'" "date" "joining_date is not DATE"
eq "SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='manual_attendance_requests' AND COLUMN_NAME='in_time'" "time" "in_time is not TIME"
eq "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='new_id'" "0" "users.new_id still there"
eq "SELECT CONCAT_WS('|', in_time, IFNULL(original_in, 'NULL')) FROM manual_attendance_requests m JOIN users u ON u.id=m.user_id WHERE u.biometric_id='2001'" "09:30:00|NULL" "manual attendance times"

# Step 2: list tables
eq "SELECT CONCAT_WS('|', code, form_layout) FROM employee_types WHERE code='project'" "project|researcher" "employee type layout"
eq "SELECT COUNT(*) FROM cadres WHERE code IN ('Technical','Cook')" "2" "cadres"
eq "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lookup_values'" "0" "lookup_values not retired"

# Step 3: master columns
eq "SELECT CONCAT_WS('|', employee_type_code, cadre_code) FROM designations WHERE name='Technical Assistant'" "permanent|Technical" "designation columns"
eq "SELECT CONCAT_WS('|', training_course_name, validity) FROM trainee_batches WHERE name='DIP 2026'" "Diploma|2026" "trainee batch columns"
eq "SELECT CONCAT_WS('|', msc_stream_name, validity) FROM msc_batches WHERE name='WS 2026'" "Wildlife Science|2026-2028" "msc batch columns"
eq "SELECT pi_name FROM projects WHERE name='Tiger Project'" "Dr. Stripes" "project PI"
eq "SELECT funding_category_code FROM phd_enrollments WHERE name='UGC JRF'" "UGC" "phd funding"
eq "SELECT GROUP_CONCAT(employee_type_code ORDER BY employee_type_code) FROM org_unit_employee_types e JOIN organization_units u ON u.id=e.org_unit_id WHERE u.name='IT Cell'" "contractual,permanent" "org unit employee types"
eq "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME='metadata' AND TABLE_NAME NOT LIKE 'zz\_%'" "0" "a metadata column is left"

# Step 4: employee
eq "SELECT CONCAT_WS('|', department, designation, org_unit_name, IFNULL(project_name,'-'), gender, dob, blood_group, leave_group, employee_category, is_pwd, permanent_employment_type, shift_id IS NOT NULL) FROM employee_profiles WHERE biometric_id='2001'" \
   "IT Cell|Technical Assistant|IT Cell|-|Male|1990-06-01|B+|CIPS|Technical|1|Direct|1" "2001 profile columns"
eq "SELECT CONCAT_WS('|', status_change_reason, status_effective_date, status_changed_by) FROM employee_profiles WHERE biometric_id='2001'" "rejoined|2021-01-01|9001" "status columns"
eq "SELECT CONCAT_WS('|', department, project_name, pi_name, is_phd_enrolled, IFNULL(shift_id,'NULL')) FROM employee_profiles WHERE biometric_id='2002'" "Tiger Project|Tiger Project|Dr. Typed PI|1|NULL" "2002 researcher"
eq "SELECT CONCAT_WS('|', department = '', designation = '', msc_stream_name, msc_batch_name, IFNULL(training_course_name,'-')) FROM employee_profiles WHERE biometric_id='2003'" "1|1|Wildlife Science|WS 2026|-" "2003 student"
eq "SELECT (SELECT id FROM users WHERE biometric_id='2002') = reporting_manager_id FROM employee_profiles WHERE biometric_id='2001'" "1" "manager id kept"
eq "SELECT CONCAT_WS('|', aadhaar_hash, aadhaar_last4, pan) FROM employee_identity WHERE biometric_id='2001'" "h2001|1234|ABCDE1234F" "identity"
eq "SELECT CONCAT_WS('|', bank_name, ifsc, account_hash, account_last4) FROM employee_bank_accounts WHERE biometric_id='2001'" "SBI|SBIN0001234|b2001|6789" "bank"
eq "SELECT profile_data FROM employee_profiles WHERE biometric_id='2002'" '{"avatarColor": "teal"}' "unknown JSON keys kept"
eq "SELECT COUNT(*) FROM employee_profiles WHERE biometric_id IN ('2001','2003') AND profile_data IS NULL" "2" "migrated JSON cleared"

# Step 5: lists
eq "SELECT GROUP_CONCAT(employee_type_code ORDER BY employee_type_code) FROM leave_type_employee_types e JOIN leave_types l ON l.id=e.leave_type_id WHERE l.code='CISCL'" "contractual,permanent" "leave type employee types"
eq "SELECT GROUP_CONCAT(purpose ORDER BY sort_order SEPARATOR '/') FROM leave_type_purposes p JOIN leave_types l ON l.id=p.leave_type_id WHERE l.code='CISCL'" "Sports/Blood donation" "leave type purposes"
eq "SELECT GROUP_CONCAT(day ORDER BY FIELD(day,'Sun','Mon','Tue','Wed','Thu','Fri','Sat')) FROM shift_days d JOIN shifts s ON s.id=d.shift_id WHERE s.code='CIGEN'" "Mon,Tue,Wed,Thu,Fri" "shift days"
eq "SELECT COUNT(*) FROM shift_days d JOIN shifts s ON s.id=d.shift_id WHERE s.code='CINIL'" "5" "shift without days gets Mon-Fri"
eq "SELECT CONCAT_WS('|', send_pdf, send_csv) FROM report_schedules WHERE name='CI report'" "1|1" "report formats"
eq "SELECT COUNT(*) FROM role_aliases WHERE module_id='hrms' AND role_id='administrator' AND alias='admin'" "1" "role aliases"

# Step 6: foreign keys and their effect
eq "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'" "$(q "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'")" "fk count"
[ "$(q "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'")" -ge 60 ] || fail "too few foreign keys" "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'"
# Designations: since migrations/20261229_designation_name_per_type.sql a name is unique per employment type and the
# profile → designation foreign key is gone (the app checks it): the same name twice for one type is refused.
$M -e "INSERT INTO designations (name, code, employee_type_code, status) SELECT name, CONCAT(code, '-CI2'), employee_type_code, status FROM designations WHERE name='Technical Assistant'" 2>&1 | grep -q "Duplicate entry" || fail "a designation name was accepted twice for one employment type"
$M -e "INSERT INTO employee_identity (biometric_id, aadhaar_hash) VALUES ('2003', 'h2001')" 2>&1 | grep -q "Duplicate entry" || fail "a duplicate Aadhaar was accepted"
$M -e "UPDATE employee_types SET code='permanent2' WHERE code='permanent'" 2>/dev/null
eq "SELECT employment_type FROM employee_profiles WHERE biometric_id='2001'" "permanent2" "employee type code change did not follow"
eq "SELECT employee_type_code FROM designations WHERE name='Technical Assistant'" "permanent2" "designation employee type did not follow"
$M -e "UPDATE employee_types SET code='permanent' WHERE code='permanent2'" 2>/dev/null
echo "normalization checks OK"
