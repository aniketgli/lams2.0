-- Migration: "Project" is no longer an organization unit type (projects have their own master).
-- The value is switched off, not deleted, so existing units that use it keep their data;
-- it no longer appears in the Type dropdown. Safe to re-run.
UPDATE lookup_values SET status = 'INACTIVE'
 WHERE id > 0 AND lookup_type = 'org_unit_type' AND code = 'Project';
