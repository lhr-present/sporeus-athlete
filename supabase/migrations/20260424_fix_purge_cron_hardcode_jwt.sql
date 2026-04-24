-- Fix purge-deleted-accounts cron: replace current_setting('app.service_role_key')
-- with hardcoded service_role JWT (GUC was never set; same pattern as ai-batch-worker cron).

SELECT cron.unschedule('purge-deleted-accounts');

SELECT cron.schedule(
  'purge-deleted-accounts',
  '0 4 * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/purge-deleted-accounts',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;$$
);
