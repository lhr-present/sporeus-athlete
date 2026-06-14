-- 20260615_funnel_cohort_rpc.sql — Growth analytics: cohort funnel summary RPC
--
-- Makes the activation funnel legible: of N signups on a given day, how many
-- logged a first session, how many within their first week, the activation rate,
-- and the average days-to-first-session. Read-only; service_role only (backend /
-- edge analytics). Net-new function — no existing object is modified.
--
-- "First session" uses training_log.created_at (when the row was logged), not the
-- session date, so a backfilled past-dated entry doesn't count as activation.

CREATE OR REPLACE FUNCTION public.get_funnel_cohort_summary(
  p_start date,
  p_end   date
)
RETURNS TABLE (
  signup_day        date,
  signed_up         bigint,
  first_session     bigint,
  first_week        bigint,
  activation_rate   numeric,
  avg_days_to_first numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
WITH cohort_signups AS (
  SELECT pr.created_at::date AS signup_day, pr.id AS user_id
  FROM public.profiles pr
  WHERE pr.created_at::date >= p_start
    AND pr.created_at::date <= p_end
),
first_logs AS (
  SELECT tl.user_id, MIN(tl.created_at) AS first_entry_at
  FROM public.training_log tl
  WHERE tl.created_at >= p_start::timestamp
    AND tl.created_at <  (p_end::timestamp + interval '38 days')
  GROUP BY tl.user_id
),
cohort_metrics AS (
  SELECT
    cs.signup_day,
    cs.user_id,
    (fl.first_entry_at IS NOT NULL)::int AS had_session,
    (fl.first_entry_at IS NOT NULL
       AND (fl.first_entry_at::date - cs.signup_day) <= 7
       AND (fl.first_entry_at::date - cs.signup_day) >= 0)::int AS had_first_week,
    -- date − date yields an integer number of days (NOT an interval), so use it directly
    CASE WHEN fl.first_entry_at IS NOT NULL AND fl.first_entry_at::date >= cs.signup_day
         THEN (fl.first_entry_at::date - cs.signup_day) END AS days_to_first
  FROM cohort_signups cs
  LEFT JOIN first_logs fl ON fl.user_id = cs.user_id
)
SELECT
  cm.signup_day,
  COUNT(DISTINCT cm.user_id)::bigint AS signed_up,
  SUM(cm.had_session)::bigint        AS first_session,
  SUM(cm.had_first_week)::bigint     AS first_week,
  CASE WHEN COUNT(DISTINCT cm.user_id) > 0
       THEN ROUND(SUM(cm.had_session)::numeric / COUNT(DISTINCT cm.user_id) * 100, 2)
       END AS activation_rate,
  CASE WHEN COUNT(cm.days_to_first) > 0
       THEN ROUND(AVG(cm.days_to_first)::numeric, 1)
       END AS avg_days_to_first
FROM cohort_metrics cm
GROUP BY cm.signup_day
ORDER BY cm.signup_day;
$$;

REVOKE ALL ON FUNCTION public.get_funnel_cohort_summary(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funnel_cohort_summary(date, date) TO service_role;
