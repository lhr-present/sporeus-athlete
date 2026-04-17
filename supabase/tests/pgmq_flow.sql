-- ─── supabase/tests/pgmq_flow.sql — pgmq round-trip smoke test ───────────────
-- Run against a linked instance:
--   npx supabase db query --linked < supabase/tests/pgmq_flow.sql
--
-- Tests:
--   1. Send 10 messages to ai_batch
--   2. Read 5 (VT=1s), confirm read_ct = 1
--   3. Delete 3 by msg_id
--   4. After VT expires, confirm 7 messages remain
--   5. move_to_dlq RPC sends a message to ai_batch_dlq
--   6. Cleanup via pgmq.purge_queue

DO $$
DECLARE
  v_msg_id   bigint;
  v_msg_ids  bigint[] := ARRAY[]::bigint[];
  v_depth    bigint;
  v_read_row RECORD;
  v_read_ids bigint[] := ARRAY[]::bigint[];
  v_del_ids  bigint[] := ARRAY[]::bigint[];
  v_dlq_id   bigint;
  i          int;
BEGIN
  -- ── Clean slate ───────────────────────────────────────────────────────────
  PERFORM pgmq.purge_queue('ai_batch');
  PERFORM pgmq.purge_queue('ai_batch_dlq');

  -- ── TEST 1: Send 10 messages ──────────────────────────────────────────────
  FOR i IN 1..10 LOOP
    SELECT pgmq.send(
      'ai_batch',
      jsonb_build_object(
        'coach_id',    'test-coach-' || i::text,
        'week_start',  '2026-04-14',
        'kind',        'weekly_digest',
        'retry_count', 0,
        '_test',       true
      )
    ) INTO v_msg_id;
    v_msg_ids := v_msg_ids || v_msg_id;
  END LOOP;

  ASSERT array_length(v_msg_ids, 1) = 10,
    format('TEST 1 FAILED: expected 10 msg_ids, got %s', array_length(v_msg_ids, 1));

  SELECT queue_length INTO v_depth FROM pgmq.metrics('ai_batch');
  ASSERT v_depth = 10,
    format('TEST 1 FAILED: expected depth 10, got %s', v_depth);

  RAISE NOTICE 'TEST 1 PASSED: 10 messages sent, queue depth = 10';

  -- ── TEST 2: Read 5 messages (VT = 1 second) ───────────────────────────────
  FOR v_read_row IN SELECT * FROM pgmq.read('ai_batch', 1, 5) LOOP
    v_read_ids := v_read_ids || v_read_row.msg_id;
    ASSERT v_read_row.read_ct = 1,
      format('TEST 2 FAILED: read_ct should be 1 on first read, got %s', v_read_row.read_ct);
    ASSERT (v_read_row.message->>'_test')::boolean = true,
      'TEST 2 FAILED: message should contain _test=true';
  END LOOP;

  ASSERT array_length(v_read_ids, 1) = 5,
    format('TEST 2 FAILED: expected 5 reads, got %s', array_length(v_read_ids, 1));

  RAISE NOTICE 'TEST 2 PASSED: 5 messages read with read_ct=1';

  -- ── TEST 3: Delete 3 by msg_id ────────────────────────────────────────────
  v_del_ids := ARRAY[v_msg_ids[1], v_msg_ids[2], v_msg_ids[3]];
  FOR i IN 1..3 LOOP
    PERFORM pgmq.delete('ai_batch', v_del_ids[i]);
  END LOOP;

  RAISE NOTICE 'TEST 3 PASSED: 3 messages deleted by msg_id';

  -- ── TEST 4: After VT expires, confirm 7 remain ───────────────────────────
  PERFORM pg_sleep(2);   -- let VT=1s expire

  SELECT queue_length INTO v_depth FROM pgmq.metrics('ai_batch');
  ASSERT v_depth = 7,
    format('TEST 4 FAILED: expected 7 messages after 3 deletes, got %s', v_depth);

  RAISE NOTICE 'TEST 4 PASSED: queue depth = 7 after deleting 3';

  -- ── TEST 5: move_to_dlq RPC sends to ai_batch_dlq ────────────────────────
  SELECT public.move_to_dlq(
    '{"coach_id":"test","dlq_reason":"max_retries","_test":true}'::jsonb
  ) INTO v_dlq_id;

  ASSERT v_dlq_id IS NOT NULL,
    'TEST 5 FAILED: move_to_dlq returned NULL msg_id';

  SELECT queue_length INTO v_depth FROM pgmq.metrics('ai_batch_dlq');
  ASSERT v_depth >= 1,
    format('TEST 5 FAILED: expected ai_batch_dlq depth >= 1, got %s', v_depth);

  RAISE NOTICE 'TEST 5 PASSED: DLQ message enqueued (msg_id=%)', v_dlq_id;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  PERFORM pgmq.purge_queue('ai_batch');
  PERFORM pgmq.purge_queue('ai_batch_dlq');

  RAISE NOTICE '──────────────────────────────────────';
  RAISE NOTICE 'pgmq_flow: all 5 tests passed ✓';
  RAISE NOTICE '──────────────────────────────────────';
END;
$$;
