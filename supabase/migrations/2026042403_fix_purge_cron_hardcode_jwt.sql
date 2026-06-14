-- purge-deleted-accounts cron: Authorization bearer is sourced at run time from
-- the `app.service_role_key` database GUC (set via `ALTER DATABASE ... SET ...`).
-- (Historical note: an earlier revision hardcoded the JWT here because the GUC
-- was unset; that leaked the service_role key into the public repo — reverted to
-- the GUC pattern. Operator must `ALTER DATABASE postgres SET app.service_role_key`.)

SELECT cron.unschedule('purge-deleted-accounts');

SELECT cron.schedule(
  'purge-deleted-accounts',
  '0 4 * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/purge-deleted-accounts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  ) AS request_id;$$
);
