#!/usr/bin/env bash
# CI only: runs scripts/sql/data/pms_projects_initial.sql twice on the test database, with a few test employees
# named like the PIs, and checks the projects, the PI links and that the second run adds nothing.
set -euo pipefail
DB="${1:-lams2_test}"
M="mysql -h127.0.0.1 -uroot -proot -N -B $DB"
$M -e "INSERT IGNORE INTO users (biometric_id, name, email, password_hash, status, valid_upto) VALUES
  ('9101', 'Dr. Bilal Habib', 'ci.pi1@wii.gov.in', 'x', 'active', '2099-12-31'),
  ('9102', 'G.V. Gopi', 'ci.pi2@wii.gov.in', 'x', 'active', '2099-12-31'),
  ('9103', 'K. Ramesh', 'ci.pi3@wii.gov.in', 'x', 'active', '2099-12-31'),
  ('9104', 'C. Ramesh', 'ci.pi4@wii.gov.in', 'x', 'active', '2099-12-31'),
  ('9105', 'Jeyaraj Antony Johnson', 'ci.pi5@wii.gov.in', 'x', 'active', '2099-12-31');" 2>/dev/null
before=$($M -e "SELECT COUNT(*) FROM projects" 2>/dev/null)
mysql -h127.0.0.1 -uroot -proot "$DB" < scripts/sql/data/pms_projects_initial.sql 2>&1 | grep -v "Using a password"
first=$($M -e "SELECT COUNT(*) FROM projects" 2>/dev/null)
mysql -h127.0.0.1 -uroot -proot "$DB" < scripts/sql/data/pms_projects_initial.sql > /dev/null 2>&1
second=$($M -e "SELECT COUNT(*) FROM projects" 2>/dev/null)
q() { $M -e "$1" 2>/dev/null; }
fail=0
ok() { if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 — got [$2], expected [$3]"; fail=1; fi; }
ok "80 projects added" "$((first - before))" "80"
ok "the second run adds nothing" "$second" "$first"
ok "every code is WII-PRJ-NNNN (4 digits, no \".0\") and unique" "$(q "SELECT COUNT(DISTINCT code) FROM projects WHERE code REGEXP '^WII-PRJ-[0-9]{4}\$'")" "$(q "SELECT COUNT(*) FROM projects WHERE code LIKE 'WII-PRJ-%'")"
ok "the 80 projects have WII-PRJ-NNNN codes" "$(q "SELECT COUNT(*) FROM projects WHERE name IN ('CoE-HWC', 'Tiger Cell', 'Elephant Cell') AND code REGEXP '^WII-PRJ-[0-9]{4}\$'")" "3"
ok "Bilal Habib linked by the same words; the employee's name is kept" "$(q "SELECT CONCAT(COUNT(*), '/', SUM(p.pi_name = 'Dr. Bilal Habib')) FROM projects p JOIN users u ON u.id = p.pi_user_id WHERE u.biometric_id = '9101'")" "19/19"
ok "Gopi linked by the short form (G.V. Gopi)" "$(q "SELECT COUNT(*) FROM projects p JOIN users u ON u.id = p.pi_user_id WHERE u.biometric_id = '9102'")" "6"
ok "Krishnamurthy Ramesh -> K. Ramesh, Ramesh Chinnasamy -> C. Ramesh" "$(q "SELECT CONCAT((SELECT COUNT(*) FROM projects p JOIN users u ON u.id = p.pi_user_id WHERE u.biometric_id = '9103'), '/', (SELECT COUNT(*) FROM projects p JOIN users u ON u.id = p.pi_user_id WHERE u.biometric_id = '9104'))")" "4/2"
ok "Ramesh T matches no one: the name from the list is kept, not linked" "$(q "SELECT CONCAT(COUNT(*), '/', SUM(pi_user_id IS NULL)) FROM projects WHERE name = 'CoE-HWC'")" "1/1"
ok "a title that came twice: the second PI is the Co-PI" "$(q "SELECT COUNT(*) FROM project_co_pis c JOIN projects p ON p.id = c.project_id JOIN users u ON u.id = c.user_id WHERE u.biometric_id = '9105' AND p.name LIKE 'Cumulative Impact Assessment Study on Wildlife%'")" "1"
# The code fix: projects with ".0" codes (as the first version gave) become WII-PRJ-NNNN; a clash stops it.
$M -e "INSERT INTO projects (name, code, stage, status) VALUES ('CI Code Fix A', 'WII-PRJ-901.0', 'ongoing', 'ACTIVE'), ('CI Code Fix B', 'WII-PRJ-902.0', 'ongoing', 'ACTIVE')" 2>/dev/null
mysql -h127.0.0.1 -uroot -proot "$DB" < scripts/sql/data/pms_projects_fix_codes.sql 2>&1 | grep -v "Using a password"
ok "code fix: WII-PRJ-901.0 -> WII-PRJ-0901" "$(q "SELECT GROUP_CONCAT(code ORDER BY code) FROM projects WHERE name LIKE 'CI Code Fix %'")" "WII-PRJ-0901,WII-PRJ-0902"
$M -e "INSERT INTO projects (name, code, stage, status) VALUES ('CI Code Fix C', 'WII-PRJ-901.0', 'ongoing', 'ACTIVE')" 2>/dev/null
mysql -h127.0.0.1 -uroot -proot "$DB" < scripts/sql/data/pms_projects_fix_codes.sql > /dev/null 2>&1
ok "code fix: a clash changes nothing" "$(q "SELECT code FROM projects WHERE name = 'CI Code Fix C'")" "WII-PRJ-901.0"
exit $fail
