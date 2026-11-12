-- Migration: Casual Leave quotas, half day for CL / CL20 / CL30, Unpaid Leave without any limit. Safe to re-run.
--
-- Casual Leave (CL):      8 days a year; 12 days for a person with disability (PwD).
-- Casual Leave 20 (CL20): 20 days a year.   Casual Leave 30 (CL30): 30 days a year.
-- All three can be taken as a half day (0.5): first half (before lunch) or second half (after lunch).
-- Which employees get which of them is set by their leave group (Master Settings → Leave Groups).
-- Unpaid Leave (UL): unpaid, no balance, no limit on days or times.
-- Still editable per type in Leave → Leave Types.

UPDATE leave_types SET default_quota = 8,  pwd_quota = 12,   half_day_allowed = 1 WHERE code = 'CL'   AND id > 0;
UPDATE leave_types SET default_quota = 20, pwd_quota = NULL, half_day_allowed = 1 WHERE code = 'CL20' AND id > 0;
UPDATE leave_types SET default_quota = 30, pwd_quota = NULL, half_day_allowed = 1 WHERE code = 'CL30' AND id > 0;

UPDATE leave_types
SET is_paid = 0,
    is_debited = 0,
    max_consecutive_days = 0,
    lifetime_max = 0,
    max_spells_per_year = 0,
    max_spells_per_month = 0,
    max_spells_lifetime = 0,
    min_days_per_application = 0
WHERE code = 'UL' AND id > 0;
