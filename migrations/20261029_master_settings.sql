-- Migration: Master Settings — unified audit trail and database-driven dropdown lists.
-- Run once before deploying the Master Settings rebuild. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. One audit trail for every master (create / update / status / delete).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_audit_logs (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  master_key       VARCHAR(40)  NOT NULL,             -- e.g. shift, biometric_machine, designation, lookup:gender
  record_id        VARCHAR(64)  NOT NULL,
  record_label     VARCHAR(255) NULL,                 -- name/code at the time of the change
  action           VARCHAR(16)  NOT NULL,             -- CREATE | UPDATE | STATUS | DELETE
  changed_fields   TEXT         NULL,                 -- comma-separated field names for UPDATE
  before_data      LONGTEXT     NULL,                 -- JSON
  after_data       LONGTEXT     NULL,                 -- JSON
  reason           VARCHAR(500) NULL,
  actor_biometric_id VARCHAR(4) NULL,
  actor_name       VARCHAR(255) NULL,
  actor_role       VARCHAR(32)  NULL,
  ip_address       VARCHAR(45)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  legacy_ref       VARCHAR(64)  NULL,                 -- set only for rows copied from the old audit tables
  UNIQUE KEY uq_master_audit_legacy (legacy_ref),
  KEY idx_master_audit_master (master_key, created_at),
  KEY idx_master_audit_record (master_key, record_id),
  KEY idx_master_audit_created (created_at),
  KEY idx_master_audit_actor (actor_biometric_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copy the history already recorded in the three old audit tables.
-- INSERT IGNORE + legacy_ref keeps this idempotent.
INSERT IGNORE INTO master_audit_logs
  (master_key, record_id, record_label, action, before_data, after_data, reason, actor_biometric_id, actor_name, created_at, legacy_ref)
SELECT 'shift', CAST(shift_id AS CHAR), shift_code,
       CASE WHEN action = 'STATUS_CHANGE' THEN 'STATUS' ELSE action END,
       before_data, after_data, reason, changed_by_biometric_id, changed_by_name,
       COALESCE(changed_at, CURRENT_TIMESTAMP(3)), CONCAT('shift:', id)
FROM shift_master_audit_logs;

INSERT IGNORE INTO master_audit_logs
  (master_key, record_id, record_label, action, before_data, after_data, reason, actor_biometric_id, actor_name, created_at, legacy_ref)
SELECT 'biometric_machine', machine_id, machine_id, action, before_data, after_data, reason,
       changed_by_biometric_id, changed_by_name, changed_at, CONCAT('biometric:', id)
FROM biometric_machine_audit_logs;

INSERT IGNORE INTO master_audit_logs
  (master_key, record_id, record_label, action, before_data, after_data, actor_biometric_id, actor_name, created_at, legacy_ref)
SELECT 'organization_unit', CAST(organization_id AS CHAR), CONCAT(organization_name, COALESCE(CONCAT(' (', organization_code, ')'), '')),
       action, before_data, after_data, changed_by_biometric_id, changed_by_name, changed_at, CONCAT('org_unit:', id)
FROM organization_unit_audit_logs;

-- ---------------------------------------------------------------------------
-- 2. Short dropdown lists that used to be hard-coded in the UI.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lookup_values (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lookup_type VARCHAR(40)  NOT NULL,   -- salutation | gender | employee_type | org_unit_type | cadre_group | funding_category
  code        VARCHAR(50)  NOT NULL,   -- stable value stored on records (never shown alone)
  name        VARCHAR(255) NOT NULL,   -- label shown in dropdowns
  sort_order  INT          NOT NULL DEFAULT 0,
  status      VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
  metadata    LONGTEXT     NULL,       -- JSON; employee_type uses {"formLayout": "..."}
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_lookup_type_code (lookup_type, code),
  KEY idx_lookup_type (lookup_type, status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Starting values = what the UI offered until now. Existing rows are never overwritten.
INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata) VALUES
  ('salutation', 'Mr.',   'Mr.',   10, NULL),
  ('salutation', 'Mrs.',  'Mrs.',  20, NULL),
  ('salutation', 'Ms.',   'Ms.',   30, NULL),
  ('salutation', 'Miss',  'Miss',  40, NULL),
  ('salutation', 'Dr.',   'Dr.',   50, NULL),
  ('salutation', 'Prof.', 'Prof.', 60, NULL),

  ('gender', 'Male',   'Male',   10, NULL),
  ('gender', 'Female', 'Female', 20, NULL),
  ('gender', 'Other',  'Other',  30, NULL),

  -- Codes match the values already stored on employee profiles.
  ('employee_type', 'permanent',       'Permanent',     10, '{"formLayout":"permanent"}'),
  ('employee_type', 'contractual',     'Contractual',   20, '{"formLayout":"contractual"}'),
  ('employee_type', 'researcher',      'Project Staff', 30, '{"formLayout":"researcher"}'),
  ('employee_type', 'diploma_trainee', 'Trainee',       40, '{"formLayout":"diploma_trainee"}'),
  ('employee_type', 'bsc_msc_student', 'M.Sc Student',  50, '{"formLayout":"bsc_msc_student"}'),
  ('employee_type', 'phd_student',     'PhD Scholar',   60, '{"formLayout":"phd_student"}'),
  ('employee_type', 'intern',          'Intern',        70, '{"formLayout":"intern"}'),

  ('org_unit_type', 'Department', 'Department', 10, NULL),
  ('org_unit_type', 'Cell',       'Cell',       20, NULL),
  ('org_unit_type', 'Division',   'Division',   30, NULL),
  ('org_unit_type', 'Unit',       'Unit',       40, NULL),
  ('org_unit_type', 'Project',    'Project',    50, NULL),
  ('org_unit_type', 'Other',      'Other',      60, NULL),

  ('cadre_group', 'Cadre A',           'Cadre A (Administrative)',  10, NULL),
  ('cadre_group', 'Research Cadre',    'Research Cadre (Scientific)', 20, NULL),
  ('cadre_group', 'Technical Staff',   'Technical Staff',           30, NULL),
  ('cadre_group', 'Faculty / Student', 'Faculty / Student (Academic)', 40, NULL),
  ('cadre_group', 'Support Staff',     'Support Staff',             50, NULL),

  ('funding_category', 'National Fellowship', 'National Fellowship (UGC/CSIR)', 10, NULL),
  ('funding_category', 'Govt Grant',          'Govt Grant (DST/DBT)',           20, NULL),
  ('funding_category', 'Institutional',       'Institutional (WII Fellowship)', 30, NULL),
  ('funding_category', 'Project Grant',       'Project Grant',                  40, NULL),
  ('funding_category', 'Self / External',     'Self / External Sponsored',      50, NULL);
