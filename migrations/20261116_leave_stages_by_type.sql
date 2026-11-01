-- CL, SCL, RH, Compensatory Off and Station Leave are 1-stage leaves: the Reporting Manager approves directly.
-- Every other leave type is a 2-stage leave: the Reporting Manager forwards and the HoD approves.
-- (sandwich_rule follows the stages: 2-stage leaves count the holidays inside them, 1-stage leaves do not.)
UPDATE leave_types SET approval_stages = 1, sandwich_rule = 'excluded' WHERE id > 0 AND code IN ('CL', 'SCL', 'RH', 'C-OFF', 'STN');
UPDATE leave_types SET approval_stages = 2, sandwich_rule = 'included', hod_after_days = 0 WHERE id > 0 AND code NOT IN ('CL', 'SCL', 'RH', 'C-OFF', 'STN');
