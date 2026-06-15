-- 20260623_revoke_enqueue_push_fanout_anon.sql
-- Residual from the 2026-06-16 final audit: enqueue_push_fanout was still anon-executable
-- (SECURITY DEFINER) — a push-queue abuse vector. No genuine client caller (only the
-- trigger-checkin-reminders edge fn, via service_role). Held in the v9.400 lockdown out of
-- caution; now closed with the same pattern. Applied to prod via MCP.
revoke execute on function public.enqueue_push_fanout(jsonb) from public, anon, authenticated;
grant  execute on function public.enqueue_push_fanout(jsonb) to service_role;
