-- supabase/migrations/20260462_book_reader_attribution.sql — E16
-- Tracks which EŞİK/THRESHOLD book chapter QR code drove each signup.
-- Used to measure per-chapter CTA performance and reader → user conversion.

-- ── book_attributions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_attributions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id    TEXT NOT NULL,              -- 'ch1' through 'ch22'
  utm_source    TEXT NOT NULL DEFAULT 'esik_book',
  utm_medium    TEXT,                       -- 'qr' | 'pdf_link' | 'direct'
  utm_campaign  TEXT,                       -- e.g. 'launch_2026'
  claimed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each user can only claim a given chapter once
  CONSTRAINT book_attributions_user_chapter_unique UNIQUE (user_id, chapter_id),

  -- Valid chapter IDs: ch1 through ch22
  CONSTRAINT book_attributions_chapter_check
    CHECK (chapter_id ~ '^ch([1-9]|1[0-9]|2[0-2])$')
);

-- Index for per-chapter funnel analytics
CREATE INDEX idx_book_attributions_chapter ON book_attributions (chapter_id);
CREATE INDEX idx_book_attributions_user    ON book_attributions (user_id);
CREATE INDEX idx_book_attributions_claimed ON book_attributions (claimed_at);

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE book_attributions ENABLE ROW LEVEL SECURITY;

-- Athletes can see their own attributions
CREATE POLICY "athlete_read_own_book_attribution"
  ON book_attributions FOR SELECT
  USING (auth.uid() = user_id);

-- Athletes can insert their own attribution (idempotent — UNIQUE constraint deduplicates)
CREATE POLICY "athlete_insert_own_book_attribution"
  ON book_attributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all (for analytics queries)
-- (service role bypasses RLS by default)

-- ── View: per-chapter funnel summary (service role only) ───────────────────
CREATE OR REPLACE VIEW book_chapter_funnel AS
SELECT
  chapter_id,
  count(*)                                          AS total_claims,
  count(DISTINCT user_id)                           AS unique_users,
  min(claimed_at)                                   AS first_claim,
  max(claimed_at)                                   AS latest_claim,
  count(*) FILTER (WHERE utm_medium = 'qr')         AS qr_claims,
  count(*) FILTER (WHERE utm_medium = 'pdf_link')   AS pdf_link_claims
FROM book_attributions
GROUP BY chapter_id
ORDER BY total_claims DESC;

COMMENT ON TABLE book_attributions IS
  'Tracks EŞİK/THRESHOLD book chapter → Sporeus signup attribution. One row per user per chapter. E16.';
