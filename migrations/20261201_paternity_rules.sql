-- Migration: Paternity Leave (PAT) rules. Safe to re-run; only changes the PAT leave type.
--   2 stages (Reporting Manager, then HoD); holidays inside it count, so it is 15 days in one go (the form and the
--   server set To = From + 14 days); at most 2 times in the whole service; no balance; no half day; joinable with any
--   leave. Male employees only. The birth / adoption checks are in server/leave/specialLeave.ts.
UPDATE leave_types
SET approval_stages = 2,
    sandwich_rule = 'included',
    hod_after_days = 0,
    max_consecutive_days = 15,
    max_spells_lifetime = 2,
    gender = 'male_only',
    pwd_only = 0,
    half_day_allowed = 0,
    is_debited = 0,
    combine_with = 'both'
WHERE code = 'PAT' AND id > 0;
