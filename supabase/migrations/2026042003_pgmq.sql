-- ─── 20260420_pgmq.sql — pgmq message queuing for async AI batch jobs ─────────
-- P6: 4 queues for decoupling analytics pipeline from synchronous requests.
-- Producers: client / edge functions; Consumer: enqueue-ai-batch edge function.

CREATE EXTENSION IF NOT EXISTS pgmq;

-- ── Queues ─────────────────────────────────────────────────────────────────────
-- ai-session-analysis : per-session AI feedback requests (from TrainingLog save)
-- nightly-digest      : nightly batch digest generation tasks (from pg_cron)
-- hrv-analysis        : HRV data ready for trend analysis
-- coach-report        : coach weekly report generation

SELECT pgmq.create('ai-session-analysis')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'ai-session-analysis');

SELECT pgmq.create('nightly-digest')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'nightly-digest');

SELECT pgmq.create('hrv-analysis')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'hrv-analysis');

SELECT pgmq.create('coach-report')
WHERE NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'coach-report');

-- ── Enqueue helper RPC ─────────────────────────────────────────────────────────
-- Called by authenticated clients to enqueue an analysis job.
-- Validates caller owns the resource before enqueuing.

CREATE OR REPLACE FUNCTION enqueue_session_analysis(
  p_entry_id   text,
  p_date       date,
  p_type       text,
  p_tss        numeric,
  p_rpe        numeric,
  p_duration   numeric
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg_id bigint;
BEGIN
  -- Send to queue; returns message id
  SELECT pgmq.send(
    'ai-session-analysis',
    jsonb_build_object(
      'entry_id',  p_entry_id,
      'user_id',   auth.uid(),
      'date',      p_date,
      'type',      p_type,
      'tss',       p_tss,
      'rpe',       p_rpe,
      'duration',  p_duration,
      'queued_at', now()
    )
  ) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_session_analysis(text, date, text, numeric, numeric, numeric) TO authenticated;

-- ── Drain helper RPC ───────────────────────────────────────────────────────────
-- Called by enqueue-ai-batch edge function (service role) to read & process msgs.
-- Returns up to batch_size messages, marks them as invisible for vt seconds.

CREATE OR REPLACE FUNCTION drain_ai_session_queue(
  batch_size int DEFAULT 10,
  vt         int DEFAULT 300    -- 5-minute visibility timeout
)
RETURNS TABLE (
  msg_id      bigint,
  enqueued_at timestamptz,
  message     jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT msg_id, enqueued_at, message
  FROM   pgmq.read('ai-session-analysis', vt, batch_size);
$$;

-- ── Archive helper ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ack_ai_session_msg(p_msg_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgmq.archive('ai-session-analysis', p_msg_id);
$$;
