-- Half Pay Leave and Commuted Leave are one leave: the apply form offers "Normal HPL" or "Commuted Leave (Medical)".
-- A leave type that debits another type's balance is a conversion option of that type.
-- Commuted: every day takes 2 days of HPL, whole days only, and a medical certificate is always needed.
ALTER TABLE leave_types
  ADD COLUMN certificate_required TINYINT(1) NOT NULL DEFAULT 0;  -- a medical certificate is needed for every application

UPDATE leave_types c JOIN leave_types h ON h.code = 'HPL'
   SET c.debit_from_type_id = h.id, c.debit_factor = 2, c.is_debited = 0, c.half_day_allowed = 0, c.certificate_required = 1
 WHERE c.id > 0 AND c.code = 'COMM';
