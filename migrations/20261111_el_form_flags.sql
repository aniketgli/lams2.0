-- Earned Leave (CCS Rule 26): the apply form shows the LTC / Ex-India option and the contact address with mobile number.
-- The administrator can change these any time in the Leave Types tab.
UPDATE leave_types SET needs_contact = 1, ltc_allowed = 1 WHERE id > 0 AND code = 'EL';
