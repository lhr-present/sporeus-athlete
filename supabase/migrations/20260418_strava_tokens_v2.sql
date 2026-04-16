-- Migration: strava_tokens v2
-- Adds sync_status, last_error, provider_athlete_name columns.
-- Existing rows get default values; no data loss.

ALTER TABLE public.strava_tokens
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error', 'paused')),
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS provider_athlete_name TEXT;

-- Index for dashboard queries: latest sync state per user
CREATE INDEX IF NOT EXISTS idx_strava_tokens_user_id ON public.strava_tokens (user_id);

COMMENT ON COLUMN public.strava_tokens.sync_status IS
  'idle=ok, syncing=in-progress, error=last sync failed (see last_error), paused=user paused';
COMMENT ON COLUMN public.strava_tokens.last_error IS
  'Last error message from sync, cleared on next successful sync';
COMMENT ON COLUMN public.strava_tokens.provider_athlete_name IS
  'Strava athlete first+last name at time of connect, cached locally';
