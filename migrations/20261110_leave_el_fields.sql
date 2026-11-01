-- Leave type switches that decide which extra fields the apply form shows, and when the HoD must approve.
ALTER TABLE leave_types
  ADD COLUMN needs_contact  TINYINT(1)   NOT NULL DEFAULT 0,  -- contact address with mobile number is required
  ADD COLUMN ltc_allowed    TINYINT(1)   NOT NULL DEFAULT 0,  -- Regular / Availing LTC / Ex-India option (and LTC encashment)
  ADD COLUMN prefix_suffix  TINYINT(1)   NOT NULL DEFAULT 0,  -- holidays next to the leave may be prefixed / suffixed
  ADD COLUMN hod_after_days DECIMAL(5,1) NOT NULL DEFAULT 0;  -- 2-stage leave goes to the HoD only above this many days; 0 = always

-- What the employee enters on the apply form.
ALTER TABLE leave_requests
  ADD COLUMN ltc_type        VARCHAR(10)  NOT NULL DEFAULT 'none',  -- none | ltc | ex_india
  ADD COLUMN encash_days     TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- leave encashment with LTC, 0 = none
  ADD COLUMN contact_address VARCHAR(300) NULL,                     -- address and mobile number during the leave
  ADD COLUMN prefix_from     DATE NULL,
  ADD COLUMN prefix_to       DATE NULL,
  ADD COLUMN suffix_from     DATE NULL,
  ADD COLUMN suffix_to       DATE NULL;
