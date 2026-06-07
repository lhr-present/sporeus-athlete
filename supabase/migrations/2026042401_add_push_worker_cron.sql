-- Add missing push-worker cron job.
-- push-worker drains the push_fanout pgmq queue every minute,
-- sending VAPID push notifications enqueued by trigger-checkin-reminders.

SELECT cron.schedule(
  'push-worker',
  '* * * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/push-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  ) AS request_id;$$
);
