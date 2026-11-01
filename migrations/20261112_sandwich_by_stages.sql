-- Holidays and weekly offs inside a leave count for a 2-stage leave (EL, HPL, Commuted) and do not count for a 1-stage leave (CL, RH, Comp off ...).
-- The server now decides this from the approval stages; the column is kept in step for reports.
UPDATE leave_types SET sandwich_rule = IF(approval_stages = 2, 'included', 'excluded') WHERE id > 0;
