-- ─── 20260412_org_branding.sql — White-label org branding table ─────────────

CREATE TABLE IF NOT EXISTS org_branding (
  org_id        UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  primary_color TEXT        NOT NULL DEFAULT '#ff6600',
  logo_url      TEXT,
  app_name      TEXT        NOT NULL DEFAULT 'Sporeus Athlete',
  custom_domain TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER org_branding_updated_at
  BEFORE UPDATE ON org_branding
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS: org owner can read/write their own branding
ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_branding_owner ON org_branding
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

COMMENT ON TABLE org_branding IS 'White-label Club-tier branding overrides per org';
