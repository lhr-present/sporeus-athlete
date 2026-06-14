-- ─── v7.25.0 Squad Realtime + Indexes ──────────────────────────────────────
-- 1. Enable Supabase Realtime for tables CoachSquadView subscribes to.
-- 2. Add missing coach_id index on coach_athletes (needed for get_squad_overview
--    and the new realtime filter `coach_id=eq.{coachId}`).

-- ── Realtime publication ──────────────────────────────────────────────────────
-- Each DO block guards against "already a member of publication" errors,
-- which would otherwise abort the entire migration.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'coach_athletes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_athletes;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'training_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.training_log;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'recovery'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recovery;
  END IF;
END $$;

-- ── Missing index on coach_athletes ──────────────────────────────────────────
-- get_squad_overview() filters by coach_id; the realtime channel filter also
-- uses coach_id. Without this index every subscription event does a seq-scan.
CREATE INDEX IF NOT EXISTS idx_coach_athletes_coach_id
  ON public.coach_athletes (coach_id);
