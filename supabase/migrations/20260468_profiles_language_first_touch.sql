-- Add profiles.language and profiles.first_touch — referenced in master reference
-- as v8.1.0 additions but absent from the live schema.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language    TEXT NOT NULL DEFAULT 'tr'
    CHECK (language IN ('en', 'tr')),
  ADD COLUMN IF NOT EXISTS first_touch JSONB;
