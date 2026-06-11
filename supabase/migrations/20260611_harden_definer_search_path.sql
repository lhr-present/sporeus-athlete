-- 20260611_harden_definer_search_path.sql
-- Security hardening: pin search_path on SECURITY DEFINER RPCs that were missing it.
--
-- A SECURITY DEFINER function with a mutable search_path resolves unqualified
-- object names against the *caller's* session search_path. A user who can create
-- objects in a schema that precedes `public` in their search_path could shadow
-- the tables these functions read (system_status / client_events), causing the
-- definer-privileged function to operate on attacker-controlled objects. Pinning
-- search_path eliminates that vector. (This is what the Supabase linter's
-- "function_search_path_mutable" warning flags.)
--
-- We pin to `public` (matching the already-hardened coach_confirm_general_program
-- and coach_verify_athlete in 20260476/20260477) rather than `''`, because these
-- bodies reference unqualified public tables; `public` fixes the path without a
-- body rewrite. Built-ins still resolve from pg_catalog (always implicitly first).
--
-- ALTER FUNCTION ... SET is used so the function bodies are untouched. Idempotent:
-- re-applying simply re-sets the same setting.

ALTER FUNCTION public.get_system_status()                SET search_path = public;
ALTER FUNCTION public.get_funnel_today()                 SET search_path = public;
ALTER FUNCTION public.get_recent_client_errors(int)      SET search_path = public;

-- Note: public.coach_confirm_general_program(uuid) and public.coach_verify_athlete(...)
-- already SET search_path = public at definition time (20260476 / 20260477) — no change needed.
