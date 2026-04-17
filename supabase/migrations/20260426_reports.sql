-- ─── 20260426_reports.sql — PDF report generation: bucket + table + pg_cron ───

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  5242880,  -- 5 MB per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage objects: each user can read/write their own reports path
CREATE POLICY "reports_user_rls"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can access all (for edge function uploads)
CREATE POLICY "reports_service_rls"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'reports')
  WITH CHECK (bucket_id = 'reports');

-- ── generated_reports table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL CHECK (kind IN ('weekly','monthly_squad','race_readiness')),
  storage_path TEXT        NOT NULL,
  params       JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id
  ON public.generated_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reports_kind
  ON public.generated_reports (kind, created_at DESC);

-- ── RLS on generated_reports ──────────────────────────────────────────────────
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Own reports
CREATE POLICY "reports_own"
  ON public.generated_reports
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Coaches can read monthly_squad reports for their athletes
-- (reports where user_id is one of their athletes)
CREATE POLICY "reports_coach_squad"
  ON public.generated_reports
  FOR SELECT
  USING (
    kind = 'monthly_squad'
    AND EXISTS (
      SELECT 1 FROM public.coach_athletes ca
      WHERE ca.coach_id = auth.uid()
        AND ca.athlete_id = generated_reports.user_id
        AND ca.status = 'active'
    )
  );

GRANT SELECT, INSERT, DELETE ON public.generated_reports TO authenticated;
GRANT ALL ON public.generated_reports TO service_role;

-- ── Email reports opt-in on profiles ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reports BOOLEAN NOT NULL DEFAULT false;

-- ── pg_cron: Sunday 22:00 UTC — generate weekly reports batch ────────────────
SELECT cron.schedule(
  'monday-weekly-reports',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/generate-report',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{"source":"pg_cron","batch":"weekly"}'::jsonb
  ) AS request_id;
  $$
);

-- ── pg_cron: 1st of month 06:00 UTC — generate monthly squad reports ─────────
SELECT cron.schedule(
  'monthly-squad-reports',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/generate-report',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{"source":"pg_cron","batch":"monthly_squad"}'::jsonb
  ) AS request_id;
  $$
);
