-- ─── 20260420_session_analysis.sql — Per-session AI analysis schema ─────────
-- P2: Extends ai_insights for per-session coaching feedback.
-- analyse-session edge function stores here after client invocation.

-- Extend ai_insights for per-session analyses
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS kind      TEXT NOT NULL DEFAULT 'daily'
    CHECK (kind IN ('daily', 'session', 'hrv', 'ftp')),
  ADD COLUMN IF NOT EXISTS source_id TEXT;    -- training_log entry id for kind='session'

-- Index for fast per-session lookup
CREATE INDEX IF NOT EXISTS idx_ai_insights_source
  ON ai_insights (athlete_id, source_id)
  WHERE source_id IS NOT NULL;

-- RLS: athlete reads own insights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insights' AND policyname = 'ai_insights: own rows'
  ) THEN
    CREATE POLICY "ai_insights: own rows"
      ON ai_insights FOR SELECT
      USING (auth.uid() = athlete_id);
  END IF;
END $$;

-- RLS: service role writes (edge functions run as service role via SECURITY DEFINER or service key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insights' AND policyname = 'ai_insights: service write'
  ) THEN
    CREATE POLICY "ai_insights: service write"
      ON ai_insights FOR INSERT
      WITH CHECK (true);   -- service_role bypasses RLS; this allows authed edge fn writes
  END IF;
END $$;
