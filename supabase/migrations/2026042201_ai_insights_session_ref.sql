-- ─── 20260422_ai_insights_session_ref.sql — ai_insights session FK + kind extension ──
-- v7.43.0: Adds session_id FK for webhook-driven session analysis, extends kind enum,
-- adds index on (athlete_id, kind, created_at desc) for realtime queries.

-- ── 1. Add session_id FK (references training_log row that triggered the analysis) ──
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES training_log(id) ON DELETE CASCADE;

-- ── 2. Extend kind CHECK to include new webhook-driven kinds ─────────────────────────
-- Drop auto-generated constraint, replace with extended set.
ALTER TABLE ai_insights
  DROP CONSTRAINT IF EXISTS ai_insights_kind_check;

ALTER TABLE ai_insights
  ADD CONSTRAINT ai_insights_kind_check
  CHECK (kind IN (
    'daily',            -- nightly-batch per-athlete daily summary (legacy)
    'session',          -- client-invoked per-session (legacy, kept for back-compat)
    'hrv',              -- HRV analysis
    'ftp',              -- FTP test result
    'session_analysis', -- webhook-driven per-session (v7.43.0+)
    'coach_session_flag', -- coach mirror for sessions with flags
    'weekly_digest'     -- weekly squad summary
  ));

-- ── 3. Composite index for realtime & history queries ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_insights_kind_created
  ON ai_insights (athlete_id, kind, created_at DESC);

-- ── 4. Index for session_id FK lookups ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_insights_session_id
  ON ai_insights (session_id)
  WHERE session_id IS NOT NULL;

COMMENT ON COLUMN ai_insights.session_id IS
  'FK to training_log.id — set when kind = session_analysis or coach_session_flag';
