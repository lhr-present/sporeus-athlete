-- ─── supabase/tests/rls/policy_inventory.sql — RLS policy dump ─────────────
-- Produces the raw pg_policies inventory used to generate rls_inventory.md.
-- Run: npx supabase db query --linked < supabase/tests/rls/policy_inventory.sql

-- ── Section 1: All public-schema RLS policies ─────────────────────────────────
SELECT
  tablename                                     AS table_name,
  policyname                                    AS policy_name,
  cmd,
  permissive,
  roles,
  qual                                          AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ── Section 2: Tables with RLS enabled vs disabled ────────────────────────────
SELECT
  c.relname                                     AS table_name,
  c.relrowsecurity                              AS rls_enabled,
  c.relforcerowsecurity                         AS rls_forced,
  (SELECT count(*) FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'   -- ordinary tables only
ORDER BY c.relname;

-- ── Section 3: Tables with RLS enabled but ZERO policies (deny all) ──────────
SELECT c.relname AS table_with_rls_no_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;

-- ── Section 4: SECURITY DEFINER functions that bypass RLS ────────────────────
SELECT
  p.proname                                     AS function_name,
  pg_get_function_arguments(p.oid)              AS args,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  pg_get_functiondef(p.oid)                     AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- ── Section 5: storage.objects policies (bucket-level) ───────────────────────
SELECT
  tablename   AS table_name,
  policyname  AS policy_name,
  cmd,
  qual        AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
ORDER BY policyname;

-- ── Section 6: Materialized views (no RLS by definition) ─────────────────────
SELECT
  c.relname                                     AS mv_name,
  pg_get_userbyid(c.relowner)                   AS owner,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_can_select,
  has_table_privilege('anon', c.oid, 'SELECT')          AS anon_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'm'  -- materialized view
ORDER BY c.relname;

-- ── Section 7: pgmq queue tables (in pgmq schema) ────────────────────────────
SELECT
  c.relname                                     AS queue_table,
  c.relrowsecurity                              AS rls_enabled,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_can_select,
  has_table_privilege('anon', c.oid, 'SELECT')          AS anon_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'pgmq'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- ── Section 8: Function grants (who can EXECUTE what) ────────────────────────
SELECT
  p.proname                                                  AS function_name,
  has_function_privilege('authenticated',p.oid,'EXECUTE')    AS auth_can_execute,
  has_function_privilege('anon',        p.oid,'EXECUTE')     AS anon_can_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE')     AS svc_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enqueue_ai_batch', 'read_ai_batch', 'delete_ai_batch_msg',
    'enqueue_push_fanout', 'read_push_fanout', 'delete_push_fanout_msg',
    'enqueue_strava_backfill', 'read_strava_backfill', 'delete_strava_backfill_msg',
    'move_to_dlq', 'refresh_queue_metrics', 'refresh_mv_load',
    'maybe_refresh_squad_mv', 'get_squad_overview', 'search_everything',
    'get_load_timeline', 'get_weekly_summary', 'get_squad_readiness',
    'increment_referral_uses', 'get_my_tier', 'get_mv_health'
  )
ORDER BY p.proname;
