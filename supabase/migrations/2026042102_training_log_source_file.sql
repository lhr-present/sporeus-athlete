-- ─── 20260421_training_log_source_file.sql — Add source file path to training_log ──
-- v7.42.0: parse-activity edge function populates this column when creating
-- training_log rows from server-side FIT/GPX parsing.

ALTER TABLE training_log
  ADD COLUMN IF NOT EXISTS source_file_path TEXT;

COMMENT ON COLUMN training_log.source_file_path IS
  'Storage object path for the raw FIT/GPX file that produced this log entry (if any)';
