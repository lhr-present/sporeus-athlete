-- ─── 20260427_pgmq_queues.sql — scalable pgmq batch infrastructure (v7.48.0) ──
-- New queues: ai_batch, ai_batch_dlq, strava_backfill, push_fanout, embed_backfill
-- Observability: queue_metrics table + 5-min refresh cron
-- Rate state: strava_rate_state (rolling 600/15min counter)
-- RPC wrappers for all queues + pg_cron worker jobs

-- Extension already enabled in 20260420_pgmq.sql — guard here too
CREATE EXTENSION IF NOT EXISTS pgmq;

-- ── New queues ────────────────────────────────────────────────────────────────
SELECT pgmq.create('ai_batch')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'ai_batch');

SELECT pgmq.create('ai_batch_dlq')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'ai_batch_dlq');

SELECT pgmq.create('strava_backfill')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'strava_backfill');

SELECT pgmq.create('push_fanout')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'push_fanout');

SELECT pgmq.create('embed_backfill')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'embed_backfill');

-- ── Queue metrics observability table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.queue_metrics (
  id           BIGSERIAL   PRIMARY KEY,
  queue_name   TEXT        NOT NULL,
  depth        INT         NOT NULL DEFAULT 0,
  oldest_age_s INT         NOT NULL DEFAULT 0,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_metrics_queue_captured
  ON public.queue_metrics (queue_name, captured_at DESC);

ALTER TABLE public.queue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_metrics_service"
  ON public.queue_metrics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users with admin role can read
CREATE POLICY "queue_metrics_admin_read"
  ON public.queue_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

GRANT SELECT ON public.queue_metrics TO authenticated;
GRANT ALL    ON public.queue_metrics TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.queue_metrics_id_seq TO service_role;

-- ── refresh_queue_metrics() — snapshots depth + oldest age per queue ──────────
CREATE OR REPLACE FUNCTION public.refresh_queue_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  q_names TEXT[] := ARRAY[
    'ai_batch', 'ai_batch_dlq', 'strava_backfill', 'push_fanout', 'embed_backfill',
    'ai-session-analysis', 'nightly-digest', 'hrv-analysis', 'coach-report'
  ];
  q_name        TEXT;
  v_depth       BIGINT;
  v_oldest_age  INT;
BEGIN
  FOREACH q_name IN ARRAY q_names LOOP
    BEGIN
      SELECT COALESCE(m.queue_length, 0), COALESCE(m.oldest_msg_age_sec, 0)
      INTO v_depth, v_oldest_age
      FROM pgmq.metrics(q_name) m;

      INSERT INTO public.queue_metrics (queue_name, depth, oldest_age_s, captured_at)
      VALUES (q_name, v_depth::int, v_oldest_age, now());
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- queue may not exist; skip silently
    END;
  END LOOP;

  -- Retain only last 24 hours of snapshots
  DELETE FROM public.queue_metrics WHERE captured_at < now() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_queue_metrics() TO service_role;

-- ── Strava rate state (single-row rolling counter) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.strava_rate_state (
  id           INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  req_count    INT         NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.strava_rate_state (id, window_start, req_count)
VALUES (1, now(), 0)
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON public.strava_rate_state TO service_role;

-- ── RPCs: ai_batch queue ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_ai_batch(
  p_payload jsonb,
  p_delay_s int DEFAULT 0
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.send('ai_batch', p_payload, p_delay_s);
$$;

CREATE OR REPLACE FUNCTION public.read_ai_batch(
  batch_size int DEFAULT 20,
  vt         int DEFAULT 30
)
RETURNS TABLE (
  msg_id      bigint,
  read_ct     int,
  enqueued_at timestamptz,
  message     jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT msg_id, read_ct, enqueued_at, message
  FROM pgmq.read('ai_batch', vt, batch_size);
$$;

CREATE OR REPLACE FUNCTION public.delete_ai_batch_msg(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.delete('ai_batch', p_msg_id);
$$;

-- DLQ: plain send with no delay, payload carries dlq metadata
CREATE OR REPLACE FUNCTION public.move_to_dlq(p_payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.send('ai_batch_dlq', p_payload);
$$;

-- ── RPCs: push_fanout queue ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_push_fanout(p_payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.send('push_fanout', p_payload);
$$;

CREATE OR REPLACE FUNCTION public.read_push_fanout(
  batch_size int DEFAULT 50,
  vt         int DEFAULT 30
)
RETURNS TABLE (
  msg_id      bigint,
  read_ct     int,
  enqueued_at timestamptz,
  message     jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT msg_id, read_ct, enqueued_at, message
  FROM pgmq.read('push_fanout', vt, batch_size);
$$;

CREATE OR REPLACE FUNCTION public.delete_push_fanout_msg(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.delete('push_fanout', p_msg_id);
$$;

-- ── RPCs: strava_backfill queue ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_strava_backfill(p_payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.send('strava_backfill', p_payload);
$$;

CREATE OR REPLACE FUNCTION public.read_strava_backfill(
  batch_size int DEFAULT 5,
  vt         int DEFAULT 120
)
RETURNS TABLE (
  msg_id      bigint,
  read_ct     int,
  enqueued_at timestamptz,
  message     jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT msg_id, read_ct, enqueued_at, message
  FROM pgmq.read('strava_backfill', vt, batch_size);
$$;

CREATE OR REPLACE FUNCTION public.delete_strava_backfill_msg(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.delete('strava_backfill', p_msg_id);
$$;

-- ── GRANTs ────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.enqueue_ai_batch(jsonb, int)           TO service_role;
GRANT EXECUTE ON FUNCTION public.read_ai_batch(int, int)                TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_ai_batch_msg(bigint)            TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(jsonb)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_push_fanout(jsonb)             TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.read_push_fanout(int, int)             TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_push_fanout_msg(bigint)         TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_strava_backfill(jsonb)         TO service_role;
GRANT EXECUTE ON FUNCTION public.read_strava_backfill(int, int)         TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_strava_backfill_msg(bigint)     TO service_role;

-- ── pg_cron: queue_metrics refresh every 5 minutes ───────────────────────────
SELECT cron.schedule(
  'refresh-queue-metrics',
  '*/5 * * * *',
  $$ SELECT public.refresh_queue_metrics(); $$
);

-- ── pg_cron: ai-batch-worker every minute ────────────────────────────────────
SELECT cron.schedule(
  'ai-batch-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/ai-batch-worker',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ── pg_cron: push-worker every minute ────────────────────────────────────────
SELECT cron.schedule(
  'push-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/push-worker',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ── pg_cron: strava-backfill-worker every 2 minutes ──────────────────────────
SELECT cron.schedule(
  'strava-backfill-worker',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/strava-backfill-worker',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ── pg_cron: enqueue-ai-batch daily at 03:00 UTC ─────────────────────────────
-- Replaces old 'nightly-batch' cron (same schedule, same URL pattern)
SELECT cron.schedule(
  'enqueue-ai-batch',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/enqueue-ai-batch',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
