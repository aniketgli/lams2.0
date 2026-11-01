-- Whether the employee will leave the headquarters (station) during the leave and needs station permission.
ALTER TABLE leave_requests
  ADD COLUMN station_leave TINYINT(1) NOT NULL DEFAULT 0 AFTER certificate;
