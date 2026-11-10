-- Migration: email outbox and log. Safe to re-run.
--
-- Every notification mail is first written here and then sent by the portal's own background sender, which retries a
-- failed send (about 1, 5, 15 and 60 minutes later). A mail survives a server restart, and a mail that could not go
-- out can be sent again from Master Settings > Organization > Email. Mails sent straight away (password mails, test
-- mail, scheduled reports) are recorded here too, without their text, so the log shows every mail.
--
-- Mails that carry a password are never stored with their text. Stored text is removed 30 days after sending.
CREATE TABLE IF NOT EXISTS email_outbox (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  queued_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),   -- (re)queued: a mail not sent within 24 hours of this is given up
  event           VARCHAR(60)  NOT NULL,                                -- e.g. LEAVE_APPLIED
  reference_id    VARCHAR(100) NULL,
  category        VARCHAR(20)  NOT NULL DEFAULT 'NOTIFICATION',         -- NOTIFICATION | SECURITY | REPORT
  to_email        VARCHAR(254) NOT NULL,
  to_name         VARCHAR(255) NULL,
  cc              TEXT         NULL,                                    -- the request's own CC, comma-separated (organization CC / BCC are added when sending)
  subject         VARCHAR(500) NOT NULL,
  body_html       MEDIUMTEXT   NULL,                                    -- NULL: recorded only (cannot be sent again)
  body_text       MEDIUMTEXT   NULL,
  with_logo       TINYINT(1)   NOT NULL DEFAULT 0,
  status          VARCHAR(12)  NOT NULL DEFAULT 'pending',              -- pending | sending | sent | failed | not_sent
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at       DATETIME(3)  NULL,
  sent_at         DATETIME(3)  NULL,
  cc_count        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bcc_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error      VARCHAR(1000) NULL,
  KEY idx_email_outbox_due (status, next_attempt_at),
  KEY idx_email_outbox_created (created_at)
);
