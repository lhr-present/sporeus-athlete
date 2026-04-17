-- ─── 20260429_mv_hardening.sql — MV hardening: cache table, debounce, logging ──
-- v7.50.0: ctl_daily_cache trigger, mv_refresh_log, mv_refresh_pending debounce,
-- maybe_refresh_squad_mv() pg_cron job, logging refresh_mv_load(), get_mv_health(),
-- get_squad_overview() refactored to read from MVs (same output columns).

-- ── A. ctl_daily_cache ─────────────────────────────────────────────────────────
-- Fast-write cache for per-user daily CTL/ATL/TSB values.
-- Populated by compute_ctl_for_user() via trigger on training_log.

CREATE TABLE IF NOT EXISTS public.ctl_daily_cache (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  ctl_42d NUMERIC(8,2),
  atl_7d  NUMERIC(8,2),
  tsb     NUMERIC(8,2),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ctl_daily_cache_user
  ON ctl_daily_cache (user_id, date DESC);

ALTER TABLE public.ctl_daily_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='ctl_daily_cache' AND policyname='ctl_cache_own'
  ) THEN
    CREATE POLICY "ctl_cache_own" ON ctl_daily_cache
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='ctl_daily_cache' AND policyname='ctl_cache_service'
  ) THEN
    CREATE POLICY "ctl_cache_service" ON ctl_daily_cache
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ── B. compute_ctl_for_user(p_user_id uuid) ───────────────────────────────────
-- Computes rolling CTL/ATL/TSB for the last 49 days and upserts into
-- ctl_daily_cache. Seeds from an existing cache row at (CURRENT_DATE - 49)
-- if one exists, otherwise starts from zero.

CREATE OR REPLACE FUNCTION public.compute_ctl_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  K_CTL      CONSTANT numeric := 1.0 - exp(-1.0 / 42);
  K_ATL      CONSTANT numeric := 1.0 - exp(-1.0 / 7);
  v_ctl      numeric := 0;
  v_atl      numeric := 0;
  v_seed_date date   := CURRENT_DATE - 49;
  v_loop_day  date;
  v_daily_tss numeric;
BEGIN
  -- Seed from existing cache row at the window start if available
  SELECT ctl_42d, atl_7d
  INTO   v_ctl, v_atl
  FROM   public.ctl_daily_cache
  WHERE  user_id = p_user_id
    AND  date = v_seed_date
  LIMIT 1;

  -- Fallback to zero if no seed row found
  v_ctl := COALESCE(v_ctl, 0);
  v_atl := COALESCE(v_atl, 0);

  -- Loop CURRENT_DATE-48 through CURRENT_DATE (49 days)
  FOR v_loop_day IN
    SELECT generate_series(
      CURRENT_DATE - 48,
      CURRENT_DATE,
      '1 day'::interval
    )::date
  LOOP
    SELECT COALESCE(SUM(tss), 0)
    INTO   v_daily_tss
    FROM   public.training_log
    WHERE  user_id = p_user_id
      AND  date = v_loop_day;

    v_ctl := v_ctl * (1.0 - K_CTL) + v_daily_tss * K_CTL;
    v_atl := v_atl * (1.0 - K_ATL) + v_daily_tss * K_ATL;

    INSERT INTO public.ctl_daily_cache (user_id, date, ctl_42d, atl_7d, tsb)
    VALUES (
      p_user_id,
      v_loop_day,
      ROUND(v_ctl::numeric, 2),
      ROUND(v_atl::numeric, 2),
      ROUND((v_ctl - v_atl)::numeric, 2)
    )
    ON CONFLICT (user_id, date) DO UPDATE
      SET ctl_42d = EXCLUDED.ctl_42d,
          atl_7d  = EXCLUDED.atl_7d,
          tsb     = EXCLUDED.tsb;
  END LOOP;
END;
$$;

-- ── C. fn_update_ctl_cache() trigger on training_log ─────────────────────────
-- Fires AFTER INSERT on training_log, recomputes CTL cache for affected user
-- only when the new row falls within the 49-day rolling window.

CREATE OR REPLACE FUNCTION public.fn_update_ctl_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.date >= CURRENT_DATE - 48 THEN
    PERFORM public.compute_ctl_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_training_log_ctl_cache ON public.training_log;

CREATE TRIGGER on_training_log_ctl_cache
  AFTER INSERT ON public.training_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_ctl_cache();

-- ── D. mv_refresh_log ─────────────────────────────────────────────────────────
-- Observability table: records each MV refresh with timing and row count.

CREATE TABLE IF NOT EXISTS public.mv_refresh_log (
  id           BIGSERIAL PRIMARY KEY,
  view_name    TEXT NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms  INT,
  row_count    BIGINT
);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_view
  ON mv_refresh_log (view_name, refreshed_at DESC);

ALTER TABLE public.mv_refresh_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='mv_refresh_log' AND policyname='mv_refresh_log_admin'
  ) THEN
    CREATE POLICY "mv_refresh_log_admin" ON mv_refresh_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='mv_refresh_log' AND policyname='mv_refresh_log_service'
  ) THEN
    CREATE POLICY "mv_refresh_log_service" ON mv_refresh_log
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ── E. mv_refresh_pending ─────────────────────────────────────────────────────
-- Debounce signal table: one row per MV that needs a refresh.
-- Trigger upserts here; cron job drains and refreshes.

CREATE TABLE IF NOT EXISTS public.mv_refresh_pending (
  view_name    TEXT PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── F. fn_request_squad_refresh() + triggers on recovery / injuries ───────────
-- STATEMENT-level triggers: any INSERT/UPDATE on recovery or injuries signals
-- that mv_squad_readiness needs refreshing. Upsert is idempotent — 20 fires
-- still result in exactly 1 pending row.

CREATE OR REPLACE FUNCTION public.fn_request_squad_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.mv_refresh_pending (view_name, requested_at)
  VALUES ('mv_squad_readiness', now())
  ON CONFLICT (view_name) DO UPDATE
    SET requested_at = EXCLUDED.requested_at;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_recovery_request_squad_refresh ON public.recovery;

CREATE TRIGGER on_recovery_request_squad_refresh
  AFTER INSERT OR UPDATE ON public.recovery
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fn_request_squad_refresh();

DROP TRIGGER IF EXISTS on_injuries_request_squad_refresh ON public.injuries;

CREATE TRIGGER on_injuries_request_squad_refresh
  AFTER INSERT OR UPDATE ON public.injuries
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fn_request_squad_refresh();

-- ── G. maybe_refresh_squad_mv() ───────────────────────────────────────────────
-- Called every minute by pg_cron. If mv_refresh_pending has a row for
-- 'mv_squad_readiness', refreshes the MV and clears the pending row.

CREATE OR REPLACE FUNCTION public.maybe_refresh_squad_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mv_refresh_pending
    WHERE view_name = 'mv_squad_readiness'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_squad_readiness;
    DELETE FROM public.mv_refresh_pending
    WHERE  view_name = 'mv_squad_readiness';
  END IF;
END;
$$;

-- pg_cron: run every minute, idempotent reschedule
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'maybe-refresh-squad-mv';

SELECT cron.schedule(
  'maybe-refresh-squad-mv',
  '* * * * *',
  $$SELECT public.maybe_refresh_squad_mv()$$
);

-- ── H. refresh_mv_load() — logging version ────────────────────────────────────
-- Replaces the original (20260420_materialized_views.sql).
-- Refreshes all three MVs in dependency order and records timing + row count
-- into mv_refresh_log for each.

CREATE OR REPLACE FUNCTION public.refresh_mv_load()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start   timestamptz;
  v_dur_ms  int;
  v_rows    bigint;
BEGIN
  -- ── mv_ctl_atl_daily ──────────────────────────────────────────────────────
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ctl_atl_daily;
  v_dur_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;

  SELECT reltuples::bigint
  INTO   v_rows
  FROM   pg_class
  WHERE  relname = 'mv_ctl_atl_daily';

  INSERT INTO public.mv_refresh_log (view_name, duration_ms, row_count)
  VALUES ('mv_ctl_atl_daily', v_dur_ms, v_rows);

  -- ── mv_weekly_load_summary ───────────────────────────────────────────────
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_weekly_load_summary;
  v_dur_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;

  SELECT reltuples::bigint
  INTO   v_rows
  FROM   pg_class
  WHERE  relname = 'mv_weekly_load_summary';

  INSERT INTO public.mv_refresh_log (view_name, duration_ms, row_count)
  VALUES ('mv_weekly_load_summary', v_dur_ms, v_rows);

  -- ── mv_squad_readiness ───────────────────────────────────────────────────
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_squad_readiness;
  v_dur_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;

  SELECT reltuples::bigint
  INTO   v_rows
  FROM   pg_class
  WHERE  relname = 'mv_squad_readiness';

  INSERT INTO public.mv_refresh_log (view_name, duration_ms, row_count)
  VALUES ('mv_squad_readiness', v_dur_ms, v_rows);
END;
$$;

-- ── I. get_mv_health() ────────────────────────────────────────────────────────
-- Returns one row per materialized view with latest refresh stats and size.

CREATE OR REPLACE FUNCTION public.get_mv_health()
RETURNS TABLE (
  view_name    text,
  last_refresh timestamptz,
  duration_ms  int,
  row_count    bigint,
  size_pretty  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH view_names (vn) AS (
    VALUES
      ('mv_ctl_atl_daily'),
      ('mv_weekly_load_summary'),
      ('mv_squad_readiness')
  ),
  latest_log AS (
    SELECT DISTINCT ON (rl.view_name)
      rl.view_name,
      rl.refreshed_at,
      rl.duration_ms,
      rl.row_count
    FROM public.mv_refresh_log rl
    ORDER BY rl.view_name, rl.refreshed_at DESC
  )
  SELECT
    vn.vn                          AS view_name,
    ll.refreshed_at                AS last_refresh,
    ll.duration_ms,
    ll.row_count,
    pg_size_pretty(pg_relation_size(pc.oid)) AS size_pretty
  FROM view_names vn
  LEFT JOIN latest_log ll ON ll.view_name = vn.vn
  LEFT JOIN pg_class   pc ON pc.relname  = vn.vn;
$$;

GRANT EXECUTE ON FUNCTION public.get_mv_health() TO authenticated;

-- ── J. get_squad_overview() — MV-backed refactor ──────────────────────────────
-- Reads from mv_squad_readiness + mv_ctl_atl_daily instead of the slow 180-day
-- plpgsql EWMA loop. Output columns are IDENTICAL to the original.

CREATE OR REPLACE FUNCTION public.get_squad_overview(p_coach_id uuid)
RETURNS TABLE (
  athlete_id         uuid,
  display_name       text,
  today_ctl          numeric,
  today_atl          numeric,
  today_tsb          numeric,
  acwr_ratio         numeric,
  acwr_status        text,
  last_hrv_score     numeric,
  last_session_date  date,
  missed_sessions_7d int,
  training_status    text,
  adherence_pct      numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    sr.athlete_id,
    sr.athlete_name                           AS display_name,
    sr.ctl_42d                                AS today_ctl,
    sr.atl_7d                                 AS today_atl,
    ROUND((sr.ctl_42d - sr.atl_7d), 1)        AS today_tsb,
    sr.acwr                                   AS acwr_ratio,

    -- acwr_status
    CASE
      WHEN sr.acwr IS NULL OR sr.acwr = 0 THEN 'low'
      WHEN sr.acwr > 1.5                  THEN 'danger'
      WHEN sr.acwr > 1.3                  THEN 'caution'
      WHEN sr.acwr >= 0.8                 THEN 'optimal'
      ELSE                                     'low'
    END                                       AS acwr_status,

    -- last_hrv_score: most recent HRV reading for this athlete
    (
      SELECT r.hrv
      FROM   public.recovery r
      WHERE  r.user_id = sr.athlete_id
        AND  r.hrv IS NOT NULL
      ORDER  BY r.date DESC
      LIMIT  1
    )                                         AS last_hrv_score,

    -- last_session_date
    sr.last_date                              AS last_session_date,

    -- missed_sessions_7d: stub (same as original)
    0::int                                    AS missed_sessions_7d,

    -- training_status: uses ctl_42d from 7 days ago via LATERAL join on MV
    CASE
      WHEN sr.atl_7d > sr.ctl_42d + 20
        THEN 'Overreaching'
      WHEN sr.last_date IS NULL OR sr.last_date < CURRENT_DATE - 4
        THEN 'Detraining'
      WHEN sr.ctl_42d > COALESCE(ctl7ago.ctl_42d, 0) + 3
        THEN 'Building'
      WHEN (sr.ctl_42d - sr.atl_7d) > 15
        THEN 'Peaking'
      WHEN sr.ctl_42d < COALESCE(ctl7ago.ctl_42d, 0) - 3
        THEN 'Recovering'
      ELSE 'Maintaining'
    END                                       AS training_status,

    -- adherence_pct: sessions logged last 7 days / 7, capped at 100
    (
      SELECT LEAST(100, ROUND(COUNT(*) / 7.0 * 100)::numeric)
      FROM   public.training_log tl
      WHERE  tl.user_id = sr.athlete_id
        AND  tl.date >= CURRENT_DATE - 6
    )                                         AS adherence_pct

  FROM public.mv_squad_readiness sr

  -- ctl_42d value from 7 days ago for training_status logic
  LEFT JOIN LATERAL (
    SELECT mc.ctl_42d
    FROM   public.mv_ctl_atl_daily mc
    WHERE  mc.user_id = sr.athlete_id
      AND  mc.date = CURRENT_DATE - 7
    LIMIT 1
  ) ctl7ago ON true

  WHERE sr.coach_id = p_coach_id
  ORDER BY sr.acwr DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_squad_overview(uuid) TO authenticated;

-- ── Ops notes ─────────────────────────────────────────────────────────────────
-- After applying:
--   SELECT public.refresh_mv_load();           -- seed mv_refresh_log
--   SELECT * FROM public.get_mv_health();       -- verify health rows
--   SELECT * FROM public.ctl_daily_cache LIMIT 5; -- verify trigger wiring
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'maybe-refresh-squad-mv';
