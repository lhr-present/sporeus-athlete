-- ─── 20260420_activity_uploads.sql — Raw activity file storage + job tracking ──
-- P1: Supabase Storage bucket for FIT/GPX archival + activity_upload_jobs audit trail.
-- Client-side parsing (fileImport.js) still handles the actual FIT/GPX decode;
-- this migration adds cloud storage for raw file retention.

-- ── Storage bucket (insert into storage.buckets if writable via Management API) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-uploads',
  'activity-uploads',
  false,
  52428800,        -- 50 MB per file
  ARRAY['application/octet-stream', 'text/xml', 'application/xml',
        'application/gpx+xml', 'application/vnd.ant.fit']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ────────────────────────────────────────────────────────
-- Path convention: {userId}/{timestamp}-{filename}
-- The first folder segment must match the authenticated user's id.

CREATE POLICY "activity_uploads: own files only — insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'activity-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "activity_uploads: own files only — select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'activity-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "activity_uploads: own files only — delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'activity-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── activity_upload_jobs ────────────────────────────────────────────────────────
-- Audit trail: one row per uploaded activity file, regardless of parse outcome.

CREATE TABLE IF NOT EXISTS activity_upload_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path     TEXT        NOT NULL,          -- storage object path
  file_name     TEXT        NOT NULL,          -- original filename
  file_type     TEXT        NOT NULL           -- 'fit' | 'gpx' | 'csv'
                  CHECK (file_type IN ('fit', 'gpx', 'csv')),
  file_size     INTEGER,                       -- bytes
  status        TEXT        NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded', 'parsed', 'failed')),
  log_entry_id  UUID        REFERENCES training_log(id) ON DELETE SET NULL,
  parse_meta    JSONB,                         -- {date, durationMin, tss, distanceM, ...}
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auj_user_created ON activity_upload_jobs (user_id, created_at DESC);

ALTER TABLE activity_upload_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_upload_jobs: own rows"
ON activity_upload_jobs FOR ALL
USING  (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE activity_upload_jobs IS
  'One row per raw FIT/GPX/CSV file upload; links storage path to parsed training_log entry';
