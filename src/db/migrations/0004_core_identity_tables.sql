-- Core identity/profile/role table correction.
-- Apply after 0003_role_assignment_identity_and_hrms_key.sql.
-- This migration preserves users.id (string UUID) because sessions and API routes use it.
-- Before applying to a populated database, resolve duplicate mobile numbers and make sure
-- every existing employee profile has its real 4-digit biometric ID.

ALTER TABLE users
  ADD COLUMN phone VARCHAR(20) NULL;

-- Move any existing phone numbers to the canonical users row before removing the duplicate.
UPDATE users AS u
JOIN employee_profiles AS ep ON ep.user_id = u.id
SET u.phone = ep.phone
WHERE u.phone IS NULL
  AND ep.phone IS NOT NULL
  AND TRIM(ep.phone) <> '';

-- Unique index allows multiple NULLs while older accounts are completed, but prevents
-- duplicate non-empty mobile numbers. Application validation should require it for new users.
CREATE UNIQUE INDEX users_phone_unique ON users (phone);

-- Give profile rows a stable auto-increment surrogate key while retaining user_id as
-- the unique one-to-one link to users.
ALTER TABLE employee_profiles
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST,
  ADD COLUMN biometric_id VARCHAR(4) NULL AFTER user_id;

-- Do not fabricate biometric IDs: they must match the physical biometric system.
-- If this UPDATE would leave NULL biometric IDs, fill those rows with their actual
-- 4-digit device IDs before running the final ALTER below.
ALTER TABLE employee_profiles
  MODIFY COLUMN biometric_id VARCHAR(4) NOT NULL,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY employee_profiles_user_id_unique (user_id),
  ADD UNIQUE KEY employee_profiles_biometric_id_unique (biometric_id),
  ADD CONSTRAINT employee_profiles_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce role assignments only for real user records.
ALTER TABLE user_module_roles
  ADD CONSTRAINT user_module_roles_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE;
