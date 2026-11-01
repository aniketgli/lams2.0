-- Casual Leave 20, Casual Leave 30 and Unpaid Leave are 1-stage leaves too (Reporting Manager approves directly).
UPDATE leave_types SET approval_stages = 1, sandwich_rule = 'excluded' WHERE id > 0 AND code IN ('CL20', 'CL30', 'UL');
