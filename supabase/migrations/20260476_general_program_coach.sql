-- 20260476_general_program_coach.sql
-- Extends profiles to store general-fitness program state so coaches can read
-- it via the existing "profiles: coaches read athletes" SELECT policy.
-- Adds a SECURITY DEFINER RPC that coaches call to confirm a member's program.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS general_program             jsonb,
  ADD COLUMN IF NOT EXISTS general_program_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS general_program_confirmed_by uuid REFERENCES profiles(id);

-- ── coach_confirm_general_program ─────────────────────────────────────────────
-- Callable only by an authenticated coach who has an active link to the athlete.
CREATE OR REPLACE FUNCTION public.coach_confirm_general_program(p_athlete_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM coach_athletes
    WHERE  coach_id  = auth.uid()
      AND  athlete_id = p_athlete_id
      AND  status     = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE profiles
  SET    general_program_confirmed_at = NOW(),
         general_program_confirmed_by = auth.uid()
  WHERE  id = p_athlete_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_confirm_general_program(uuid) TO authenticated;
