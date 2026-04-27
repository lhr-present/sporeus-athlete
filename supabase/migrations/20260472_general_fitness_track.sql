-- 20260472_general_fitness_track.sql
-- General Fitness / Sedentary track: user mode, exercise library, program templates,
-- user programs, strength sessions, set-by-set log.

-- ── Profile extension ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_mode text NOT NULL DEFAULT 'endurance'
    CHECK (user_mode IN ('endurance','general','hybrid')),
  ADD COLUMN IF NOT EXISTS gf_goal text,
  ADD COLUMN IF NOT EXISTS gf_experience text,
  ADD COLUMN IF NOT EXISTS gf_days_per_week int,
  ADD COLUMN IF NOT EXISTS gf_session_minutes int,
  ADD COLUMN IF NOT EXISTS gf_equipment text;

-- ── Exercise library (world-readable, no per-user writes) ────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id              text PRIMARY KEY,
  name_en         text NOT NULL,
  name_tr         text NOT NULL,
  pattern         text NOT NULL CHECK (pattern IN ('squat','hinge','push_h','push_v','pull_h','pull_v','carry','core','iso')),
  primary_muscle  text NOT NULL CHECK (primary_muscle IN ('quads','hamstrings','glutes','chest','back','delts','biceps','triceps','core','calves','full')),
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment       text NOT NULL CHECK (equipment IN ('bw','db','bb','machine','band','cable')),
  cues_en         text NOT NULL,
  cues_tr         text NOT NULL,
  youtube_url     text,
  is_compound     boolean NOT NULL DEFAULT false
);

-- ── Program templates (world-readable) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_templates (
  id               text PRIMARY KEY,
  name_en          text NOT NULL,
  name_tr          text NOT NULL,
  split            text NOT NULL CHECK (split IN ('full_body','upper_lower','ppl','bro')),
  days_per_week    int NOT NULL,
  experience_level text NOT NULL CHECK (experience_level IN ('beginner','intermediate','advanced')),
  equipment        text NOT NULL CHECK (equipment IN ('bw','home','gym')),
  description_en   text NOT NULL,
  description_tr   text NOT NULL,
  weeks            int NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS program_template_days (
  template_id     text NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_index       int NOT NULL,
  day_label_en    text NOT NULL,
  day_label_tr    text NOT NULL,
  PRIMARY KEY (template_id, day_index)
);

CREATE TABLE IF NOT EXISTS program_template_exercises (
  template_id     text NOT NULL,
  day_index       int NOT NULL,
  position        int NOT NULL,
  exercise_id     text NOT NULL REFERENCES exercises(id),
  sets            int NOT NULL,
  reps_low        int NOT NULL,
  reps_high       int NOT NULL,
  rir             int NOT NULL DEFAULT 2,
  rest_seconds    int NOT NULL,
  PRIMARY KEY (template_id, day_index, position),
  FOREIGN KEY (template_id, day_index)
    REFERENCES program_template_days(template_id, day_index) ON DELETE CASCADE
);

-- ── User-instantiated programs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text REFERENCES program_templates(id),
  name        text NOT NULL,
  start_date  date NOT NULL,
  end_date    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Strength sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strength_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      uuid REFERENCES user_programs(id) ON DELETE SET NULL,
  session_date    date NOT NULL,
  day_label       text,
  notes           text,
  duration_minutes int,
  rpe             int CHECK (rpe BETWEEN 1 AND 10),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strength_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES strength_sessions(id) ON DELETE CASCADE,
  exercise_id text NOT NULL REFERENCES exercises(id),
  set_number  int NOT NULL,
  reps        int NOT NULL,
  load_kg     numeric(6,2),
  rir         int CHECK (rir BETWEEN 0 AND 5),
  is_warmup   boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS strength_sessions_user_date ON strength_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS strength_sets_session ON strength_sets(session_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE exercises              ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_template_days  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_sets          ENABLE ROW LEVEL SECURITY;

-- World-readable library tables
CREATE POLICY "exercises_world_read"               ON exercises              FOR SELECT USING (true);
CREATE POLICY "program_templates_world_read"       ON program_templates      FOR SELECT USING (true);
CREATE POLICY "program_template_days_world_read"   ON program_template_days  FOR SELECT USING (true);
CREATE POLICY "program_template_exercises_world_read" ON program_template_exercises FOR SELECT USING (true);

-- User programs: owner read/write
CREATE POLICY "user_programs_owner_select" ON user_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_programs_owner_insert" ON user_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_programs_owner_update" ON user_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_programs_owner_delete" ON user_programs FOR DELETE USING (auth.uid() = user_id);

-- Strength sessions: owner read/write
CREATE POLICY "strength_sessions_owner_select" ON strength_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "strength_sessions_owner_insert" ON strength_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "strength_sessions_owner_update" ON strength_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "strength_sessions_owner_delete" ON strength_sessions FOR DELETE USING (auth.uid() = user_id);

-- Strength sets: owner via session join
CREATE POLICY "strength_sets_owner_select" ON strength_sets FOR SELECT
  USING (EXISTS (SELECT 1 FROM strength_sessions ss WHERE ss.id = session_id AND ss.user_id = auth.uid()));
CREATE POLICY "strength_sets_owner_insert" ON strength_sets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM strength_sessions ss WHERE ss.id = session_id AND ss.user_id = auth.uid()));
CREATE POLICY "strength_sets_owner_update" ON strength_sets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM strength_sessions ss WHERE ss.id = session_id AND ss.user_id = auth.uid()));
CREATE POLICY "strength_sets_owner_delete" ON strength_sets FOR DELETE
  USING (EXISTS (SELECT 1 FROM strength_sessions ss WHERE ss.id = session_id AND ss.user_id = auth.uid()));
