-- Migration: Leave Not Due (LND, Rule 31) and Extraordinary Leave (EOL, Rule 32). Safe to re-run.
--
-- The apply form asks for the ground of the leave (the list is fixed in server/leave/specialLeave.ts;
-- the purposes of these two types in the Leave Types master are not used).
--
-- LND: permanent employees; a temporary employee only after one year of service and only for TB, leprosy,
--      cancer or mental illness. Only on a medical certificate, except in continuation of a Maternity Leave
--      for child birth / adoption. At most 360 days in the whole service. No yearly balance.
-- EOL: no yearly balance. Permanent: at most 5 years of continuous absence. Temporary: 3 months on one
--      occasion; 6 months on a medical certificate and 18 months for treatment in a recognised sanatorium
--      (one year of service); 24 months for studies in public interest (three years of service). EOL spells
--      with other leave between them count as one continuous spell.

UPDATE leave_types
SET is_debited = 0,
    half_day_allowed = 0,
    lifetime_max = 360,
    certificate_required = 0,
    medical_cert_days = 0
WHERE code = 'LND' AND id > 0;

UPDATE leave_types
SET is_debited = 0,
    half_day_allowed = 0,
    max_consecutive_days = 0,
    certificate_required = 0,
    medical_cert_days = 0
WHERE code = 'EOL' AND id > 0;
