-- 20260537_teams_table.sql — M4 (MEDIUM)
--
-- src/lib/squadUtils.js (getTeams/createTeam, wired via CoachSquadView/
-- TeamSelector) queries public.teams, but no migration ever created it →
-- 42P01 "relation teams does not exist" on every coach squad view.
--
-- Schema matches the callers exactly:
--   getTeams:    SELECT id, name, sport, age_group, created_at WHERE org_id = $coach
--   createTeam:  INSERT (org_id, name, sport, age_group)
--   filterByTeam: reads team.athlete_ids (string[])
-- org_id is the coach's auth user id.
-- Idempotent: CREATE TABLE / INDEX / POLICY all guarded.

CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  sport       TEXT,
  age_group   TEXT,
  athlete_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON public.teams (org_id, created_at);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Owner-scoped: a coach only ever sees/edits teams they own.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teams' AND policyname = 'teams_owner_all'
  ) THEN
    CREATE POLICY "teams_owner_all"
      ON public.teams
      FOR ALL
      TO authenticated
      USING (org_id = (SELECT auth.uid()))
      WITH CHECK (org_id = (SELECT auth.uid()));
  END IF;
END $$;
