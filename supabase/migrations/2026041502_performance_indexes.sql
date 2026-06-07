-- Performance indexes for high-frequency queries
-- Added: 2026-04-15
--
-- Audit summary:
--   training_log   → composite (user_id, date) already exists in 001_initial_schema.sql
--   wellness_logs  → table does not exist in this schema; no index needed
--   recovery       → composite (user_id, date) already exists in 001_initial_schema.sql
--   coach_sessions → only separate indexes exist; composite (coach_id, session_date) missing
--   session_attendance → UNIQUE constraint covers (session_id, athlete_id); composite index missing for explicit planner hint
--   audit_log      → only single-column indexes exist; composite (user_id, created_at) missing
--
-- RLS gap:
--   request_counts → RLS enabled, zero policies. Access intentionally restricted to
--                    service_role (edge function uses service key). Explicit deny
--                    policy added here for clarity and defense-in-depth.

-- ─── coach_sessions: queries filter by coach + date range ─────────────────────
-- Supports: SELECT * FROM coach_sessions WHERE coach_id = $1 AND session_date >= $2
-- Without composite index, Postgres uses idx_coach_sessions_coach_id then re-filters
-- date in memory — expensive for coaches with many past sessions.
CREATE INDEX IF NOT EXISTS idx_coach_sessions_coach_date
  ON public.coach_sessions (coach_id, session_date DESC);

-- ─── session_attendance: join pattern session_id + athlete lookup ─────────────
-- Supports: SELECT status FROM session_attendance WHERE session_id = $1 AND athlete_id = $2
-- The UNIQUE constraint already creates an implicit index, but its column order
-- (session_id, athlete_id) is preserved here to make the planner's choice explicit
-- and to document the intended access pattern.
CREATE INDEX IF NOT EXISTS idx_session_attendance_session_athlete
  ON public.session_attendance (session_id, athlete_id);

-- ─── audit_log: GDPR queries filter by user then sort by time ─────────────────
-- Supports: SELECT * FROM audit_log WHERE user_id = $1 ORDER BY created_at DESC
-- Without composite, Postgres uses the single-column user_id index then sorts
-- all matching rows — costly for users with large audit histories.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);

-- ─── RLS gap: request_counts has RLS enabled but no policy ───────────────────
-- This table is written/read exclusively by the edge function via the service key,
-- which bypasses RLS. The deny-all policy below makes the intent explicit and
-- ensures no anon/authenticated role can read rate-limit data directly.
CREATE POLICY IF NOT EXISTS request_counts_deny_all ON request_counts
  AS RESTRICTIVE
  FOR ALL
  USING (false);
