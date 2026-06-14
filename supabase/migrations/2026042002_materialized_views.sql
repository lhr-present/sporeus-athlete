-- ─── 20260420_materialized_views.sql — CTL/ATL proxy views + squad readiness ──
-- P8: Three materialized views for sub-5ms coach dashboard reads.
-- Refreshed daily at 02:00 UTC via pg_cron.
-- RANGE-based windows handle session-sparse days correctly.

-- ── mv_ctl_atl_daily ───────────────────────────────────────────────────────────
-- Per-athlete, per-day: rolling 7d / 42d TSS sums as ATL/CTL proxies.
-- RANGE BETWEEN INTERVAL '...' uses calendar-day windows (not row count).

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ctl_atl_daily AS
WITH daily AS (
  SELECT
    user_id,
    date,
    SUM(tss)::numeric(8,2)       AS daily_tss,
    COUNT(*)::int                 AS sessions,
    ROUND(AVG(rpe), 1)            AS avg_rpe,
    ROUND(SUM(duration_min), 0)   AS total_min
  FROM training_log
  WHERE tss IS NOT NULL AND tss > 0
  GROUP BY user_id, date
)
SELECT
  user_id,
  date,
  daily_tss,
  sessions,
  avg_rpe,
  total_min,
  ROUND(SUM(daily_tss) OVER (
    PARTITION BY user_id ORDER BY date
    RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
  ), 1) AS atl_7d,
  ROUND(SUM(daily_tss) OVER (
    PARTITION BY user_id ORDER BY date
    RANGE BETWEEN INTERVAL '41 days' PRECEDING AND CURRENT ROW
  ), 1) AS ctl_42d
FROM daily
WITH DATA;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ctlatl_user_date
  ON mv_ctl_atl_daily (user_id, date);

-- ── mv_weekly_load_summary ─────────────────────────────────────────────────────
-- ISO-week aggregates for load trend charts on athlete and coach dashboards.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_load_summary AS
SELECT
  user_id,
  DATE_TRUNC('week', date)::date  AS week_start,
  ROUND(SUM(tss)::numeric, 1)     AS total_tss,
  COUNT(*)::int                   AS session_count,
  ROUND(AVG(rpe), 1)              AS avg_rpe,
  ROUND(MAX(tss)::numeric, 1)     AS max_session_tss,
  ROUND(SUM(duration_min), 0)     AS total_min
FROM training_log
WHERE tss IS NOT NULL AND tss > 0
GROUP BY user_id, DATE_TRUNC('week', date)::date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_user_week
  ON mv_weekly_load_summary (user_id, week_start);

-- ── mv_squad_readiness ─────────────────────────────────────────────────────────
-- Coach view: each active athlete's latest ATL, CTL and ACWR proxy.
-- No direct RLS on MV — access strictly gated by get_squad_readiness() RPC.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_squad_readiness AS
SELECT
  ca.coach_id,
  ca.athlete_id,
  p.display_name                               AS athlete_name,
  latest.last_date,
  latest.atl_7d,
  latest.ctl_42d,
  CASE
    WHEN latest.ctl_42d > 0
    THEN ROUND(latest.atl_7d / latest.ctl_42d, 2)
    ELSE NULL
  END                                          AS acwr,
  latest.daily_tss                             AS last_day_tss
FROM coach_athletes ca
JOIN profiles p ON p.id = ca.athlete_id
LEFT JOIN LATERAL (
  SELECT date AS last_date, atl_7d, ctl_42d, daily_tss
  FROM mv_ctl_atl_daily
  WHERE user_id = ca.athlete_id
  ORDER BY date DESC
  LIMIT 1
) latest ON true
WHERE ca.status = 'active'
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_squad_coach_athlete
  ON mv_squad_readiness (coach_id, athlete_id);

-- ── RPCs ───────────────────────────────────────────────────────────────────────

-- Athlete: own load timeline (last p_days calendar days)
CREATE OR REPLACE FUNCTION get_load_timeline(
  p_days int DEFAULT 90
)
RETURNS TABLE (
  date        date,
  daily_tss   numeric,
  sessions    int,
  atl_7d      numeric,
  ctl_42d     numeric,
  avg_rpe     numeric,
  total_min   numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT date, daily_tss, sessions, atl_7d, ctl_42d, avg_rpe, total_min
  FROM   mv_ctl_atl_daily
  WHERE  user_id = auth.uid()
    AND  date >= CURRENT_DATE - p_days
  ORDER  BY date;
$$;

GRANT EXECUTE ON FUNCTION get_load_timeline(int) TO authenticated;

-- Athlete: own weekly load summary (last p_weeks weeks)
CREATE OR REPLACE FUNCTION get_weekly_summary(
  p_weeks int DEFAULT 16
)
RETURNS TABLE (
  week_start       date,
  total_tss        numeric,
  session_count    int,
  avg_rpe          numeric,
  max_session_tss  numeric,
  total_min        numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT week_start, total_tss, session_count, avg_rpe, max_session_tss, total_min
  FROM   mv_weekly_load_summary
  WHERE  user_id = auth.uid()
    AND  week_start >= DATE_TRUNC('week', CURRENT_DATE) - (p_weeks || ' weeks')::interval
  ORDER  BY week_start;
$$;

GRANT EXECUTE ON FUNCTION get_weekly_summary(int) TO authenticated;

-- Coach: squad readiness (own active athletes only — enforced by WHERE coach_id = auth.uid())
CREATE OR REPLACE FUNCTION get_squad_readiness()
RETURNS TABLE (
  athlete_id    uuid,
  athlete_name  text,
  last_date     date,
  atl_7d        numeric,
  ctl_42d       numeric,
  acwr          numeric,
  last_day_tss  numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT athlete_id, athlete_name, last_date, atl_7d, ctl_42d, acwr, last_day_tss
  FROM   mv_squad_readiness
  WHERE  coach_id = auth.uid()
  ORDER  BY acwr DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_squad_readiness() TO authenticated;

-- ── Refresh orchestrator ───────────────────────────────────────────────────────
-- Refreshes all three views in dependency order.
-- Called by pg_cron — not exposed to authenticated users.

CREATE OR REPLACE FUNCTION refresh_mv_load()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ctl_atl_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_load_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_squad_readiness;
END;
$$;

-- ── pg_cron: refresh daily at 02:00 UTC ───────────────────────────────────────
-- Idempotent: remove old job first (no-op if absent), then create.

SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'refresh-mv-load-daily';

SELECT cron.schedule(
  'refresh-mv-load-daily',
  '0 2 * * *',
  $$SELECT refresh_mv_load()$$
);

-- ── Ops notes ─────────────────────────────────────────────────────────────────
-- After applying:
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'refresh-mv-load-daily';
--   SELECT refresh_mv_load();            -- immediate first-run refresh
--   SELECT COUNT(*) FROM mv_squad_readiness;
-- REFRESH CONCURRENTLY requires unique indexes — all created above.
-- If refresh_mv_load() > 30s, narrow windows with a date > CURRENT_DATE - 365 filter.
