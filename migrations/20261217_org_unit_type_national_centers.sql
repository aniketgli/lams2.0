-- Organization unit type "National Centers" (Master Settings > Lists > Organization Unit Types), before "Other".
-- Adds nothing if it already exists. Safe to run again.
INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata)
VALUES ('org_unit_type', 'National Centers', 'National Centers', 57, NULL);
