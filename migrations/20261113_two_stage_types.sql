-- EL, HPL and Commuted Leave are 2-stage leaves (Reporting Manager, then HoD).
-- Every rule that follows the stages then applies to them: holidays and weekly offs inside the leave count,
-- they cannot be joined with a 1-stage leave, and holidays between two straight 2-stage leaves count with the earlier one.
UPDATE leave_types SET approval_stages = 2, sandwich_rule = 'included' WHERE id > 0 AND code IN ('EL', 'HPL', 'COMM');
