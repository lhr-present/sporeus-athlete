-- 20260477_session_confirmation.sql
-- Two-sided session confirmation: athlete marks done, coach verifies.
-- Works for both GF (gym) and endurance athletes linked to a coach.

-- Athlete side: timestamp set when athlete logs/confirms a session
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_workout_done_at TIMESTAMPTZ;

-- Coach side: per-link verification timestamp + optional note
ALTER TABLE coach_athletes
  ADD COLUMN IF NOT EXISTS coach_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coach_verified_note TEXT NOT NULL DEFAULT '';

-- RPC: coach marks they've reviewed an athlete's recent sessions.
-- SECURITY DEFINER validates the active coach-athlete link before writing.
CREATE OR REPLACE FUNCTION public.coach_verify_athlete(
  p_athlete_id UUID,
  p_note       TEXT DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM coach_athletes
    WHERE coach_id = auth.uid()
      AND athlete_id = p_athlete_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE coach_athletes
  SET coach_verified_at   = NOW(),
      coach_verified_note = p_note
  WHERE coach_id = auth.uid()
    AND athlete_id = p_athlete_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_verify_athlete TO authenticated;
