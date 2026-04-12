-- ─── Training Plans table ────────────────────────────────────────────────────
-- Stores one yearly plan per authenticated user (upsert on user_id).

CREATE TABLE IF NOT EXISTS training_plans (
  id         uuid             DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid             REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_json  jsonb            NOT NULL,
  model      text,
  updated_at timestamptz      DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own plan" ON training_plans
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_training_plan_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_plans_updated_at ON training_plans;
CREATE TRIGGER training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION update_training_plan_timestamp();
