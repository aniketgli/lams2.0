-- Leave groups (a lookup master, lookup_type 'leave_group') and the nature of each leave type.
-- Nothing is pre-filled: the administrator adds the groups.
ALTER TABLE leave_types
  ADD COLUMN nature      VARCHAR(10)  NOT NULL DEFAULT 'paid' AFTER is_paid,   -- paid | unpaid | special
  ADD COLUMN leave_group VARCHAR(100) NULL AFTER nature;                       -- lookup_values.code of the group
UPDATE leave_types SET nature = 'unpaid' WHERE is_paid = 0;
