-- Leave types: whether the employee must submit a joining form when the leave ends.
-- 0 = not needed (default for all existing leave types), 1 = needed.
ALTER TABLE leave_types
  ADD COLUMN joining_required TINYINT(1) NOT NULL DEFAULT 0 AFTER is_paid;
