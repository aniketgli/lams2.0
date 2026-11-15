-- Organization unit type "Office" (Master Settings > Lists > Organization Unit Types), between Unit and Other.
-- Adds nothing if an "Office" type already exists. Safe to run again.
INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata)
VALUES ('org_unit_type', 'Office', 'Office', 50, NULL);
