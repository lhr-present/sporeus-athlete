-- ─── 20260416_session_rsvp.sql — Session RSVP tables ────────────────────────

-- Coach-scheduled group sessions
CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid,
  title        text NOT NULL,
  session_date date NOT NULL,
  session_time text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Athlete attendance/RSVP responses
CREATE TABLE IF NOT EXISTS public.session_attendance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.coach_sessions(id) ON DELETE CASCADE,
  athlete_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('confirmed', 'declined', 'pending')),
  responded_at timestamptz,
  UNIQUE (session_id, athlete_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coach_sessions_coach_id ON public.coach_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_date     ON public.coach_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON public.session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_athlete ON public.session_attendance(athlete_id);

-- Enable RLS
ALTER TABLE public.coach_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- coach_sessions policies
-- Coach sees their own sessions
CREATE POLICY "coach_sessions_coach_read" ON public.coach_sessions
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "coach_sessions_coach_write" ON public.coach_sessions
  FOR ALL USING (auth.uid() = coach_id);

-- Athletes see sessions from their linked coach
CREATE POLICY "coach_sessions_athlete_read" ON public.coach_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_athletes
      WHERE coach_athletes.coach_id = coach_sessions.coach_id
        AND coach_athletes.athlete_id = auth.uid()
        AND coach_athletes.status = 'active'
    )
  );

-- session_attendance policies
-- Athletes update/insert their own attendance row
CREATE POLICY "attendance_athlete_write" ON public.session_attendance
  FOR ALL USING (auth.uid() = athlete_id);

-- Coaches read all attendance for their sessions
CREATE POLICY "attendance_coach_read" ON public.session_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_sessions
      WHERE coach_sessions.id = session_attendance.session_id
        AND coach_sessions.coach_id = auth.uid()
    )
  );
