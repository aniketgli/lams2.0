-- Leave types: shortest leave per application, applications per month, applications in the whole service.
-- 0 = no limit for all three.
ALTER TABLE leave_types
  ADD COLUMN min_days_per_application DECIMAL(5,1) NOT NULL DEFAULT 0 AFTER max_spells_per_year,
  ADD COLUMN max_spells_per_month     SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER min_days_per_application,
  ADD COLUMN max_spells_lifetime      SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER max_spells_per_month;
