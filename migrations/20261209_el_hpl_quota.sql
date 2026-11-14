-- Migration: show the real quota of Earned Leave and Half Pay Leave in Leave Types. Safe to re-run.
--
-- Earned Leave (EL):    30 days a year, credited 15 + 15 every half-year (CCS Leave Rules).
-- Half Pay Leave (HPL): 20 days a year, credited 10 + 10 every half-year.
-- This is the entitlement shown on the page. Each employee's balance is still set by the
-- Leave Balance Manager / Administrator; nothing is credited automatically.

UPDATE leave_types SET default_quota = 30, accrual = 'half_yearly' WHERE code = 'EL'  AND id > 0;
UPDATE leave_types SET default_quota = 20, accrual = 'half_yearly' WHERE code = 'HPL' AND id > 0;
