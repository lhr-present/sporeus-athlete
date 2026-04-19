-- 20260456_athlete_retention.sql — E6: Athlete retention
-- personal_records: persist PR events per athlete
-- athlete_goals: structured goal tracking

-- ── personal_records ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,                 -- longest_session | highest_tss | weekly_tss | longest_streak | power_peak_*
  value        NUMERIC NOT NULL,              -- the record value (minutes / TSS / watts / days)
  prev_value   NUMERIC,                       -- previous best (null = first ever)
  session_id   UUID,                          -- reference to training_log row (nullable — no FK to avoid coupling)
  achieved_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_records_user_cat
  ON personal_records(user_id, category, achieved_at DESC);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_records: athlete owns rows"
  ON personal_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── athlete_goals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlete_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_en      TEXT NOT NULL,
  text_tr      TEXT,
  category     TEXT,                          -- optional: race | fitness | consistency | other
  target_date  DATE,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','achieved','abandoned')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_goals_user
  ON athlete_goals(user_id, status, target_date ASC NULLS LAST);

ALTER TABLE athlete_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_goals: athlete owns rows"
  ON athlete_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_athlete_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_athlete_goals_updated_at
  BEFORE UPDATE ON athlete_goals
  FOR EACH ROW EXECUTE FUNCTION update_athlete_goals_updated_at();
