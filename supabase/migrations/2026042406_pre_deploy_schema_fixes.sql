-- ── Pre-deploy schema fixes ────────────────────────────────────────────────────
-- Required by: check-dependencies, operator-digest, generate-report

-- ── 1. operator_alerts: notified flag ────────────────────────────────────────
ALTER TABLE public.operator_alerts
  ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false;

-- ── 2. system_status: latency_ms (written by check-dependencies) ─────────────
ALTER TABLE public.system_status
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

-- ── 3. generated_reports ──────────────────────────────────────────────────────
-- Written by generate-report; read by UI. Signed URL TTL = 7 days.
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('weekly', 'monthly_squad', 'race_readiness')),
  storage_path text        NOT NULL,
  params       jsonb,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_reports: own rows" ON public.generated_reports
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_generated_reports_user_kind
  ON public.generated_reports (user_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reports_expires_at
  ON public.generated_reports (expires_at);

-- 30-day TTL: purge expired reports nightly
SELECT cron.schedule(
  'purge-generated-reports',
  '45 3 * * *',
  $$DELETE FROM public.generated_reports WHERE expires_at < now();$$
);

-- ── 4. reports storage bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Deny all direct access; generate-report uses service_role (BYPASSRLS) + signed URLs.
CREATE POLICY "reports: deny public" ON storage.objects
  FOR ALL USING (bucket_id = 'reports' AND false);

-- ── 5. get_recent_client_errors RPC (used by operator-digest) ─────────────────
CREATE OR REPLACE FUNCTION public.get_recent_client_errors(p_limit integer DEFAULT 5)
RETURNS TABLE (category text, action text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT category, action, COUNT(*) AS count
  FROM public.client_events
  WHERE event_type = 'error'
    AND created_at >= now() - interval '24 hours'
  GROUP BY category, action
  ORDER BY count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_client_errors(integer) TO service_role;
