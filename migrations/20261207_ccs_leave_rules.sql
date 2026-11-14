-- Migration: leave types matched with the CCS (Leave) Rules, 1972 (Leave_Rules.pdf). Safe to re-run.
-- Quotas are not touched: the Leave Balance Manager / Administrator sets every balance.
-- Which employee gets which leave is set by the leave groups (Master Settings → Leave Groups).

-- Earned Leave: at most 180 days at one time; at most 300 + 15 days held; carried forward (up to 300).
UPDATE leave_types SET max_consecutive_days = 180, max_accumulation = 315, carry_forward = 1, max_carry_forward = 300 WHERE code = 'EL' AND id > 0;

-- Half Pay Leave: carried forward, no limit (0 = no limit).
UPDATE leave_types SET carry_forward = 1, max_carry_forward = 0 WHERE code = 'HPL' AND id > 0;

-- Leave Not Due: debited to the Half Pay Leave account (may go below zero; earned back later).
UPDATE leave_types l JOIN leave_types h ON h.code = 'HPL'
   SET l.debit_from_type_id = h.id, l.debit_factor = 1, l.is_debited = 0
 WHERE l.code = 'LND' AND l.id > 0;

-- Casual Leave (CL, CL20, CL30): joined only with 1-stage leaves (SCL, RH, compensatory off), never with regular leave.
UPDATE leave_types SET combine_with = 'single' WHERE code IN ('CL', 'CL20', 'CL30') AND id > 0;

-- Restricted Holiday: at most 2 in a year, no balance.
UPDATE leave_types SET is_debited = 0, max_spells_per_year = 2 WHERE code = 'RH' AND id > 0;

-- Compensatory off: no monthly limit within a month of the day worked; after that 2 a month (checked in code).
UPDATE leave_types SET max_spells_per_month = 0 WHERE code = 'C-OFF' AND id > 0;

-- Study Leave: not debited; after 5 years of service; at most 12 months at one time and 24 months in the service.
UPDATE leave_types SET is_debited = 0, lifetime_max = 730, max_consecutive_days = 365, min_service_months = 60 WHERE code = 'STUDY' AND id > 0;
