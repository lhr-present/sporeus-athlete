-- 20260411_enable_extensions.sql — enable extensions a fresh DB needs
--
-- ROOT CAUSE (2026-06-07): the production project had pg_cron and pg_net enabled
-- manually via the Supabase dashboard, but NO migration creates them. A fresh
-- branch/clone runs only migrations, so these extensions were missing and the
-- first top-level `cron.*` usage (20260420_materialized_views: `cron.unschedule
-- … FROM cron.job`) failed → the whole branch went MIGRATIONS_FAILED. Enabling
-- them here — before that first use — lets a fresh database provision cleanly.
-- Verified on a preview branch: both install as the postgres role and `cron.job`
-- then resolves. Idempotent (IF NOT EXISTS); a no-op on the prod DB where they
-- already exist. pgmq / vector are created by their own later migrations.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
