-- Leave balances are kept year by year; this records whether each year row is a calendar year (CY) or a
-- financial year (FY, the year it starts is cycle_year), so the history shows which cycle every grant belongs to.
-- Rows written before get the cycle the employee follows today.
ALTER TABLE leave_balances
  ADD COLUMN cycle_type VARCHAR(2) NOT NULL DEFAULT 'CY' AFTER cycle_year;

UPDATE leave_balances b
  JOIN users u ON u.id = b.user_id
  JOIN employee_profiles p ON p.biometric_id = u.biometric_id
   SET b.cycle_type = IF(JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, '$.leaveCycle')) = 'FY', 'FY', 'CY');
