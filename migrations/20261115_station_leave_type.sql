-- Station Leave / HQ Permission: taken only on weekly offs and gazetted holidays, in one continuous stretch, and it takes nothing from a balance.
-- When an employee adds a prefix / suffix to a leave, a station leave for those days is applied automatically, linked to that leave.
ALTER TABLE leave_types
  ADD COLUMN off_days_only TINYINT(1) NOT NULL DEFAULT 0;  -- only weekly offs and gazetted holidays can be chosen

ALTER TABLE leave_requests
  ADD COLUMN linked_to BIGINT UNSIGNED NULL,               -- station leave applied automatically for the prefix / suffix of this leave request
  ADD KEY idx_leave_requests_linked_to (linked_to);

UPDATE leave_types SET off_days_only = 1, is_debited = 0 WHERE id > 0 AND code = 'STN';
