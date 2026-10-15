-- Back up lams2_db first. Execute this migration exactly once.
-- Preserve existing organization rows while assigning numeric auto-increment IDs.
ALTER TABLE organization_units ADD COLUMN id_new BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST;
ALTER TABLE organization_units DROP PRIMARY KEY, DROP COLUMN id, CHANGE COLUMN id_new id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (id);
