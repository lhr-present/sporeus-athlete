-- 20260459_onboarding.sql — E9: First-run onboarding enhancements
-- is_demo flag on training_log — bulk deletable demo sessions
-- onboarding_state — tracks completion of each onboarding step
-- peer_comparison_opt_in — aggregated peer benchmarks consent

-- ── training_log: is_demo flag ──────────────────────────────────────────────
ALTER TABLE training_log ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_training_log_is_demo
  ON training_log(user_id, is_demo)
  WHERE is_demo = true;

-- ── onboarding_state ────────────────────────────────────────────────────────
-- Tracks which steps the user has completed (for funnel analytics + resume).
-- Columns are nullable booleans: null = not yet reached, false = skipped, true = completed.
CREATE TABLE IF NOT EXISTS onboarding_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  training_purpose      TEXT,                  -- general_fitness | race | weight | rehab | exploring
  primary_sport         TEXT,                  -- Running | Cycling | Triathlon | Swimming | Rowing | Other
  logging_method        TEXT,                  -- manual | strava | fit_upload
  step_q1_done          BOOLEAN,               -- training purpose Q answered
  step_q2_done          BOOLEAN,               -- sport selected
  step_q3_done          BOOLEAN,               -- logging method selected
  first_session_logged  BOOLEAN DEFAULT false, -- true after first training_log INSERT
  first_week_done       BOOLEAN DEFAULT false, -- true after ≥3 sessions in first 7 days
  demo_mode_used        BOOLEAN DEFAULT false, -- user loaded demo data
  strava_prompted       BOOLEAN DEFAULT false, -- in-context Strava connect shown
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ             -- null until all required steps done
);

ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_state: user owns row"
  ON onboarding_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── peer_comparison_opt_in ─────────────────────────────────────────────────
-- Users can opt in to anonymous peer benchmarking (percentile only — no PII).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peer_comparison_opt_in BOOLEAN NOT NULL DEFAULT false;

-- ── Funnel tracking events (via attribution_events) ────────────────────────
-- No schema change needed — use attribution_events with these event_type values:
-- onboarding_started, onboarding_q1_done, onboarding_q2_done, onboarding_q3_done,
-- onboarding_first_log, onboarding_completed, demo_mode_loaded, demo_mode_cleared,
-- strava_prompt_shown, strava_prompt_accepted, strava_prompt_dismissed
