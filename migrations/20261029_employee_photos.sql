-- Migration: profile photos, managed by each employee for themselves.
-- Safe to re-run.
--
-- One photo per employee, kept out of employee_profiles.profile_data so the
-- directory stays small. Only JPEG, PNG and WebP up to 512 KB are accepted
-- (checked on the server from the file's own bytes, not its name).

CREATE TABLE IF NOT EXISTS employee_photos (
  biometric_id VARCHAR(4)   NOT NULL PRIMARY KEY,
  mime_type    VARCHAR(32)  NOT NULL,               -- image/jpeg | image/png | image/webp
  byte_size    INT UNSIGNED NOT NULL,
  data         MEDIUMBLOB   NOT NULL,
  updated_by   VARCHAR(4)   NULL,                   -- biometric ID of whoever saved it
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
