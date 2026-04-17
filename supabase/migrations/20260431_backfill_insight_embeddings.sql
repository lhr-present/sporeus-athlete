-- ── 20260431_backfill_insight_embeddings.sql ─────────────────────────────────
-- One-time backfill helper for insight_embeddings.
-- This does NOT auto-run on deploy — call manually after deploying embed-session.
--
-- Usage (from psql or Supabase SQL editor):
--   SELECT public.backfill_insight_embeddings();
--
-- What it does:
--   Enqueues all ai_insights rows that have a session_id and no matching
--   insight_embeddings row into the embed_backfill pgmq queue. The
--   strava-backfill-worker (or embed_backfill worker when implemented) will
--   drain it and call embed-session per session_id, which now also embeds
--   the linked ai_insights row.
--
-- Idempotent: safe to run multiple times — pgmq.send uses the insight_id
--   as a natural dedup key within the visible window. Rows already in
--   insight_embeddings are excluded by the NOT EXISTS filter.

CREATE OR REPLACE FUNCTION public.backfill_insight_embeddings()
RETURNS TABLE (enqueued bigint, skipped bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enqueued bigint := 0;
  v_skipped  bigint := 0;
  r          RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ai.athlete_id, ai.session_id
    FROM   public.ai_insights ai
    WHERE  ai.session_id IS NOT NULL
      AND  ai.insight_json IS NOT NULL
      AND  NOT EXISTS (
             SELECT 1 FROM public.insight_embeddings ie
             WHERE ie.insight_id = ai.id
           )
    ORDER BY ai.session_id
  LOOP
    BEGIN
      PERFORM pgmq.send(
        'embed_backfill',
        jsonb_build_object(
          'session_id', r.session_id,
          'user_id',    r.athlete_id,
          'source',     'backfill'
        )
      );
      v_enqueued := v_enqueued + 1;
    EXCEPTION WHEN OTHERS THEN
      -- pgmq not available or queue doesn't exist — count as skipped
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_enqueued, v_skipped;
END;
$$;

COMMENT ON FUNCTION public.backfill_insight_embeddings() IS
  'Enqueues ai_insights rows (with session_id) that lack insight_embeddings rows into embed_backfill queue. Run once after deploying embed-session C1 update. Idempotent.';

-- Grant to service_role only — not exposed to client
REVOKE ALL ON FUNCTION public.backfill_insight_embeddings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_insight_embeddings() TO service_role;
