-- Migration: account_settings was created by an older run without an explicit collation, so on MySQL 8 its text columns are
-- utf8mb4_0900_ai_ci while users is utf8mb4_unicode_ci; joining them failed with "Illegal mix of collations" (add employee).
-- The code now joins with an explicit collation as well. Safe to re-run.
ALTER TABLE account_settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
