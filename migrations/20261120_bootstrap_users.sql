-- Two fixed accounts, created once (safe to re-run; existing rows are left as they are):
--   erp@wii.gov.in         Administrator   (HRMS module, role Administrator)
--   erpauditor@wii.gov.in  Auditor         (HRMS module, role Auditor only)
-- Both start with the default password 123456, stored only as a bcrypt hash, and must choose their own at first sign-in.
-- Biometric IDs 9001 / 9002 are only the account keys these two need; they are not punch IDs of any employee.
INSERT INTO users (biometric_id, name, email, password_hash, must_change_password, status, last_updated_by, last_updated_at, last_update_summary)
SELECT '9001', 'Administrator', 'erp@wii.gov.in', '$2b$12$UV7.6drMPhwysRz5gKNAYOYYHGfn5RleHNHIp784xrNFtL.Q2DUQy', 1, 'active', '9001', NOW(), 'Account created by migration'
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'erp@wii.gov.in' OR biometric_id = '9001');

INSERT INTO users (biometric_id, name, email, password_hash, must_change_password, status, last_updated_by, last_updated_at, last_update_summary)
SELECT '9002', 'Auditor', 'erpauditor@wii.gov.in', '$2b$12$UV7.6drMPhwysRz5gKNAYOYYHGfn5RleHNHIp784xrNFtL.Q2DUQy', 1, 'active', '9001', NOW(), 'Account created by migration'
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'erpauditor@wii.gov.in' OR biometric_id = '9002');

INSERT INTO user_module_roles (biometric_id, module_id, role_id, status, last_updated_by)
SELECT u.biometric_id, 'hrms', 'hrms_admin', 'active', '9001' FROM users u
 WHERE u.email = 'erp@wii.gov.in'
   AND NOT EXISTS (SELECT 1 FROM user_module_roles r WHERE r.biometric_id = u.biometric_id AND r.module_id = 'hrms' AND r.role_id = 'hrms_admin');

INSERT INTO user_module_roles (biometric_id, module_id, role_id, status, last_updated_by)
SELECT u.biometric_id, 'hrms', 'hrms_auditor', 'active', '9001' FROM users u
 WHERE u.email = 'erpauditor@wii.gov.in'
   AND NOT EXISTS (SELECT 1 FROM user_module_roles r WHERE r.biometric_id = u.biometric_id AND r.module_id = 'hrms' AND r.role_id = 'hrms_auditor');
