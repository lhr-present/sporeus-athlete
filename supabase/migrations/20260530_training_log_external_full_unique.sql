-- 20260530 — Make (user_id, external_id) a usable ON CONFLICT arbiter (v9.348.0)
--
-- BUG (verified in prod 2026-05-30 via a BEGIN/ROLLBACK probe):
--   INSERT ... ON CONFLICT (user_id, external_id) on training_log threw
--   42P10 "there is no unique or exclusion constraint matching the ON CONFLICT
--   specification". The only matching index was PARTIAL:
--     create unique index training_log_external
--       on training_log (user_id, external_id) where external_id is not null;
--   PostgREST's `onConflict` parameter only names columns — it cannot supply
--   the index predicate — so Postgres could not infer the partial index as an
--   arbiter. Every Strava/device activity upsert (strava-oauth,
--   strava-backfill-worker, device-sync — all using onConflict:'user_id,
--   external_id') therefore threw, and activity sync silently failed.
--
-- FIX: replace the partial index with a FULL unique index on the same columns.
--   A full unique index IS inferable as an arbiter without a predicate, so the
--   existing edge-function upserts work unchanged (no redeploy needed).
--   Manual sessions store external_id IS NULL; under the PG15+ default
--   (NULLS DISTINCT) each NULL is distinct, so two-a-days / multiple manual
--   sessions per day never collide. Verified prod is PG 17.6 and holds zero
--   duplicate non-null (user_id, external_id) pairs before this runs.
--
-- Idempotent: safe to re-run.

DROP INDEX IF EXISTS training_log_external;

CREATE UNIQUE INDEX IF NOT EXISTS training_log_user_external
  ON training_log (user_id, external_id);
