-- Role catalog: every role that can be given in each module, kept in the database.
-- The server accepts a role assignment only when it names an active role of this table
-- (its role_id, its name or one of its aliases), and a stored grant gives access only
-- through the row it matches (access_role = what the server allows that role to do).
--
-- Run once (safe to run again):
--   mysql> source /full/path/to/migrations/20261203_role_catalog.sql
--
-- To stop a role being given or used: UPDATE role_catalog SET is_active = 0 WHERE module_id = ... AND role_id = ...;
-- access_role must be one of: administrator, audit, reviewing_manager, reporting_manager, general_staff, leave_balance_manager.

CREATE TABLE IF NOT EXISTS role_catalog (
  module_id    VARCHAR(20)  NOT NULL,                 -- hrms | pms | stock | facility | finance
  role_id      VARCHAR(50)  NOT NULL,
  name         VARCHAR(100) NOT NULL,                 -- stored in user_module_roles.role_id on a new grant
  access_role  VARCHAR(30)  NOT NULL,
  aliases      VARCHAR(500) NOT NULL DEFAULT '',      -- other spellings found in old grants, comma separated
  description  VARCHAR(255) NOT NULL DEFAULT '',
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (module_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO role_catalog (module_id, role_id, name, access_role, aliases, description, sort_order, is_active) VALUES
  ('hrms', 'administrator', 'Administrator', 'administrator', 'admin,hrms_admin', 'Full administrative control over HR policies, shifts, biometrics, regularization and leave quotas.', 10, 1),
  ('hrms', 'reporting_manager', 'Reporting Manager', 'reporting_manager', 'manager,hrms_reporting,rm', 'First-level approver for team leave, manual attendance and outdoor duty.', 20, 1),
  ('hrms', 'reviewing_manager', 'HoD', 'reviewing_manager', 'reviewing manager,hrms_reviewing', 'Head of Department: second-level approval.', 30, 1),
  ('hrms', 'general_staff', 'User', 'general_staff', 'general staff,staff,hrms_staff', 'Self-service attendance, leave, outdoor duty and profile.', 40, 1),
  ('hrms', 'leave_balance_manager', 'Leave Balance Manager', 'leave_balance_manager', 'hrms_leave_balance,leave balance', 'Sees and sets the leave balance of every employee, and nothing else.', 50, 1),
  ('hrms', 'audit', 'Auditor', 'audit', 'auditor,hrms_auditor', 'Read-only audit access to HRMS records and reports.', 60, 1),
  ('pms', 'pms_admin', 'PMS Administrator / Dean R&D', 'administrator', 'pms admin,administrator,admin,dean r&d', 'Full oversight of research projects, funding agencies and grant accounts.', 10, 1),
  ('pms', 'pms_pi', 'Principal Investigator (PI)', 'reviewing_manager', 'project pi,pi,principal investigator,hod', 'Lead researcher: milestones, budget and timesheet approvals.', 20, 1),
  ('pms', 'pms_co_pi', 'Co-Principal Investigator (Co-PI)', 'reporting_manager', 'co-pi,co pi,co-principal investigator,reporting manager', 'Project co-lead: task allocation and interim deliverables.', 30, 1),
  ('pms', 'pms_researcher', 'Research Fellow / Staff', 'general_staff', 'researcher,research fellow,research staff,user,staff', 'Timesheets, fieldwork deliverables and milestone progress.', 40, 1),
  ('pms', 'pms_reviewer', 'Project Reviewer / Auditor', 'audit', 'project reviewer,reviewer', 'Technical committee member with audit and evaluation access.', 50, 1),
  ('pms', 'auditor', 'Auditor', 'audit', 'audit', 'Read-only audit access to PMS records and reports.', 60, 1),
  ('stock', 'sims_admin', 'Store Administrator / Purchase Officer', 'administrator', 'store admin,administrator,admin,purchase officer', 'Item catalog, procurement, inventory thresholds and disposals.', 10, 1),
  ('stock', 'sims_store_keeper', 'Store Keeper / Custodian', 'reporting_manager', 'store keeper,custodian,reporting manager', 'Physical custody, goods inward, dispatch and returns.', 20, 1),
  ('stock', 'sims_approver', 'Department Indent Approver', 'reviewing_manager', 'indent approver,approver,hod', 'Approves departmental indents and requisitions.', 30, 1),
  ('stock', 'sims_indenter', 'Indenter / General Staff', 'general_staff', 'indenter,user,staff', 'Raises indents.', 40, 1),
  ('stock', 'auditor', 'Auditor', 'audit', 'audit', 'Read-only audit access to stock records and reports.', 50, 1),
  ('facility', 'fms_admin', 'Facility & Fleet Administrator', 'administrator', 'facility admin,administrator,admin', 'Facility and fleet administration.', 10, 1),
  ('facility', 'fms_officer', 'Estate / Transport Officer', 'reviewing_manager', 'estate officer,transport officer,hod', 'Approves bookings and estate requests.', 20, 1),
  ('facility', 'fms_supervisor', 'Driver / Facility Supervisor', 'reporting_manager', 'driver,facility supervisor,supervisor,reporting manager', 'Runs trips and facility jobs.', 30, 1),
  ('facility', 'fms_requester', 'Booking Requester / Staff', 'general_staff', 'booking requester,requester,user,staff', 'Requests bookings.', 40, 1),
  ('facility', 'auditor', 'Auditor', 'audit', 'audit', 'Read-only audit access to facility records and reports.', 50, 1),
  ('finance', 'fin_admin', 'Finance Comptroller / Finance Officer', 'administrator', 'finance admin,administrator,admin,comptroller,finance officer', 'Finance administration.', 10, 1),
  ('finance', 'fin_officer', 'Drawing & Disbursing Officer (DDO)', 'reviewing_manager', 'ddo,drawing and disbursing officer,hod', 'Approves and disburses.', 20, 1),
  ('finance', 'fin_accountant', 'Accountant / Cashier', 'reporting_manager', 'accountant,cashier,reporting manager', 'Accounts and cash.', 30, 1),
  ('finance', 'fin_claimant', 'Claimant / General Staff', 'general_staff', 'claimant,user,staff', 'Submits claims.', 40, 1),
  ('finance', 'auditor', 'Auditor', 'audit', 'audit', 'Read-only audit access to finance records and reports.', 50, 1);
