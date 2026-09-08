ALTER TABLE users
  ADD COLUMN archived_at DATETIME NULL AFTER last_login_at,
  ADD COLUMN archive_note TEXT NULL AFTER archived_at;
