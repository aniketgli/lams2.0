-- Migration: institute units can be limited to some employee types and cadres.
-- Safe to re-run.
--
--   organization_units.metadata   JSON text: { "empTypes": "permanent,contractual", "cadres": "Scientific,Technical" }
--                                 Empty / missing = the unit is offered for every employee type and cadre.
--
-- Designations keep their cadre in their existing metadata column ({ "cadre": "Scientific" }), so they need no change.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_units' AND COLUMN_NAME = 'metadata'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE organization_units ADD COLUMN metadata LONGTEXT NULL AFTER institute',
  'SELECT ''organization_units.metadata already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
