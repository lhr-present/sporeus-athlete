CREATE TABLE IF NOT EXISTS public.team_announcements (
  id         BIGSERIAL PRIMARY KEY,
  coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     TEXT,
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by    UUID[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_coach_all"   ON public.team_announcements FOR ALL    USING (coach_id = auth.uid());
CREATE POLICY "ta_athlete_read" ON public.team_announcements FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS ta_coach_idx ON public.team_announcements(coach_id, created_at DESC);
COMMENT ON TABLE public.team_announcements IS 'Coach-to-squad broadcast messages. read_by[] tracks which athlete UUIDs have dismissed.';
