-- Migration: Casual Leave (and the leaves that follow its rules: SCL, CL20, CL30) can be taken as a half day (0.5).
-- Start / End day then appear in the apply form. Still editable per type in Master Settings > Leave types. Safe to re-run.
UPDATE leave_types SET half_day_allowed = 1 WHERE id > 0 AND code IN ('CL', 'SCL', 'CL20', 'CL30');
