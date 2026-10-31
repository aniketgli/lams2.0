-- Medical certificate of a leave request (PDF, JPEG or PNG, checked by the server from the file's own bytes).
-- One file per request; it is removed together with the request.
CREATE TABLE IF NOT EXISTS leave_certificates (
  request_id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  file_name    VARCHAR(200)    NOT NULL,
  mime_type    VARCHAR(40)     NOT NULL,
  size_bytes   INT UNSIGNED    NOT NULL,
  data         MEDIUMBLOB      NOT NULL,
  uploaded_by  BIGINT UNSIGNED NOT NULL,
  uploaded_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
