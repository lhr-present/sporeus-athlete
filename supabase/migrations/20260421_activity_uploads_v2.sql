-- ─── 20260421_activity_uploads_v2.sql — Extend activity upload for server-side parse ──
-- v7.42.0: Adds parse-activity edge function support columns, reduces bucket to 25MB,
-- adds free-tier monthly upload quota tracking to profiles, schedules monthly reset.

-- ── 1. Reduce bucket file size limit to 25 MB (was 50 MB) ────────────────────────
UPDATE storage.buckets
SET file_size_limit = 26214400   -- 25 MB
WHERE id = 'activity-uploads';

-- ── 2. Extend activity_upload_jobs with server-side parse columns ─────────────────
ALTER TABLE activity_upload_jobs
  ADD COLUMN IF NOT EXISTS parsed_session_id UUID REFERENCES training_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error              TEXT,
  ADD COLUMN IF NOT EXISTS parsed_at         TIMESTAMPTZ;

-- ── 3. Extend status CHECK to include server-side parse states ────────────────────
-- Auto-generated constraint name: activity_upload_jobs_status_check
ALTER TABLE activity_upload_jobs
  DROP CONSTRAINT IF EXISTS activity_upload_jobs_status_check;

ALTER TABLE activity_upload_jobs
  ADD CONSTRAINT activity_upload_jobs_status_check
  CHECK (status IN ('uploaded', 'parsed', 'failed', 'pending', 'parsing', 'done', 'error'));

-- ── 4. Add upload quota columns to profiles ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS file_upload_count_month INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS file_upload_reset_at    DATE;

-- ── 5. Monthly reset via pg_cron (1st of each month, 00:00 UTC) ───────────────────
SELECT cron.schedule(
  'reset-upload-count-monthly',
  '0 0 1 * *',
  $$UPDATE profiles
    SET file_upload_count_month = 0,
        file_upload_reset_at    = CURRENT_DATE
    WHERE subscription_tier = 'free' OR subscription_tier IS NULL$$
);

COMMENT ON COLUMN activity_upload_jobs.parsed_session_id IS
  'FK to training_log row created by parse-activity edge function';
COMMENT ON COLUMN activity_upload_jobs.parsed_at IS
  'Timestamp when server-side parse completed successfully';
COMMENT ON COLUMN profiles.file_upload_count_month IS
  'Rolling monthly upload counter; reset by pg_cron on 1st of each month';
