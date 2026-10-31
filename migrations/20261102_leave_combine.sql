-- Leave types: which other leaves may be taken straight before / after this one.
--   none   = no other leave type may touch it
--   single = only 1-stage leaves (approved by the Reporting Manager)
--   double = only 2-stage leaves (forwarded to and approved by the HoD)
--   both   = any leave
-- Two leaves are "straight" when no working day with a biometric punch lies between them.
-- Existing leave types default to 'both', so nothing that worked yesterday stops working.
ALTER TABLE leave_types
  ADD COLUMN combine_with VARCHAR(8) NOT NULL DEFAULT 'both' AFTER sandwich_rule;
