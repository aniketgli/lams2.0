-- Migration: persistent login sessions (replaces the in-memory session store).
-- Run once before deploying Phase 1. Safe to re-run.
CREATE TABLE IF NOT EXISTS web_sessions (
  sid        VARCHAR(128)    NOT NULL PRIMARY KEY,
  user_id    BIGINT UNSIGNED NULL,
  expires_at DATETIME(3)     NOT NULL,
  data       MEDIUMTEXT      NOT NULL,
  KEY idx_web_sessions_expires (expires_at),
  KEY idx_web_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
