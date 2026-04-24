-- Add missing push-worker cron job.
-- push-worker drains the push_fanout pgmq queue every minute,
-- sending VAPID push notifications enqueued by trigger-checkin-reminders.

SELECT cron.schedule(
  'push-worker',
  '* * * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/push-worker',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;$$
);
