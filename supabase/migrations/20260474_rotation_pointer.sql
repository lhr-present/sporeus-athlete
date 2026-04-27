-- 20260474_rotation_pointer.sql
-- Replace calendar scaffolding with a single rotation pointer on user_programs.

ALTER TABLE user_programs DROP COLUMN IF EXISTS end_date;

ALTER TABLE user_programs RENAME COLUMN start_date TO reference_date;

COMMENT ON COLUMN user_programs.reference_date IS
  'Continuity anchor — the day the user adopted this program. NOT a deadline. Display-only.';

ALTER TABLE user_programs
  ADD COLUMN IF NOT EXISTS next_day_index      int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_completed  int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_session_date   date;

-- Back-fill existing rows (no data loss)
UPDATE user_programs up SET
  sessions_completed = COALESCE((
    SELECT COUNT(*) FROM strength_sessions ss
    WHERE ss.program_id = up.id
  ), 0),
  last_session_date = (
    SELECT MAX(ss.session_date) FROM strength_sessions ss
    WHERE ss.program_id = up.id
  );

-- Drop session-minutes commitment field from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS gf_session_minutes;

COMMENT ON COLUMN profiles.gf_days_per_week IS
  'Advisory only — used for template suggestion at onboarding. Never enforced.';
