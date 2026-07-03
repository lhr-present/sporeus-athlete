-- 20260636_strava_webhook_throttle.sql — per-user webhook enqueue throttle
--
-- audit_2026_07_03_v9450_461.md HIGH-1: the public strava-webhook POST handler
-- enqueued a backfill for ANY event whose owner_id mapped to a connected user —
-- no rate limit, no dedup. Strava athlete ids are enumerable, so an attacker
-- could flood the pgmq queue and burn the app-wide strava_rate_state budget,
-- starving every real user's sync.
--
-- The edge fn now claims this column in one atomic conditional UPDATE before
-- enqueueing: at most one webhook-driven enqueue per user per 120s (the worker
-- only runs every 2 min, and each enqueue imports a 2-day window, so coalescing
-- is lossless for anything followed by a later allowed enqueue).

ALTER TABLE public.strava_tokens
  ADD COLUMN IF NOT EXISTS webhook_last_enqueue_at timestamptz;
