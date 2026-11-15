-- Organization unit types "Section", "Labs & Repositories" and "Library" (Master Settings > Lists > Organization
-- Unit Types). "Other" stays last. Adds nothing for a type that already exists. Safe to run again.
INSERT IGNORE INTO lookup_values (lookup_type, code, name, sort_order, metadata) VALUES
  ('org_unit_type', 'Section',             'Section',             45, NULL),
  ('org_unit_type', 'Labs & Repositories', 'Labs & Repositories', 52, NULL),
  ('org_unit_type', 'Library',             'Library',             55, NULL);
