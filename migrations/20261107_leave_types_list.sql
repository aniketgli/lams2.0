-- The leave types of the institute: name and code only. Everything else (quota, rules, approval stages ...) is
-- set by the administrator in Leave > Leave Types. A leave type that already exists (same code or name) is left as it is.
-- Unpaid Leave (UL) is created as unpaid and not debited from any balance; the others as paid and debited.
-- Run it once; running it again adds nothing.
INSERT INTO leave_types (code, name, is_debited, is_paid, status)
SELECT v.code, v.name, v.debited, v.paid, 'active'
FROM (
  SELECT 'EL' AS code, 'Earned Leave (EL)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'HPL' AS code, 'Half Pay Leave (HPL)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'COMM' AS code, 'Commuted Leave' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'LND' AS code, 'Leave Not Due (LND)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'EOL' AS code, 'Extra Ordinary Leave (EOL / LWP)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'CL' AS code, 'Casual Leave (CL)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'RH' AS code, 'Restricted Holiday (RH)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'STN' AS code, 'Station Leave / HQ Permission' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'C-OFF' AS code, 'Compensatory Off (C-Off)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'MAT' AS code, 'Maternity Leave' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'PAT' AS code, 'Paternity Leave' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'CCL' AS code, 'Child Care Leave (CCL)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'STUDY' AS code, 'Study Leave' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'SCL' AS code, 'Special Casual Leave (SCL)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'CL20' AS code, 'Casual Leave 20 (CL20)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'CL30' AS code, 'Casual Leave 30 (CL30)' AS name, 1 AS debited, 1 AS paid
  UNION ALL SELECT 'UL' AS code, 'Unpaid Leave (UL)' AS name, 0 AS debited, 0 AS paid
) v
WHERE NOT EXISTS (SELECT 1 FROM leave_types t WHERE t.code = v.code OR t.name = v.name);
