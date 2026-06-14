-- ─── v5.8.0 Squad Overview ────────────────────────────────────────────────────
-- Adds category column to existing coach_notes table, and the
-- get_squad_overview() Postgres function called by the squad-sync edge function.

-- Add category to coach_notes (existing table has: id, coach_id, athlete_id, note, created_at)
ALTER TABLE coach_notes
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('injury','wellness','technique','motivation','general'));

-- ── RLS policies for coach_notes ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coach_notes' AND policyname='coach_notes_coach'
  ) THEN
    CREATE POLICY "coach_notes_coach" ON coach_notes
      FOR ALL USING (coach_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='coach_notes' AND policyname='coach_notes_athlete_read'
  ) THEN
    CREATE POLICY "coach_notes_athlete_read" ON coach_notes
      FOR SELECT USING (athlete_id = auth.uid());
  END IF;
END $$;

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- ── get_squad_overview ─────────────────────────────────────────────────────────
-- Returns one aggregated row per athlete linked (active) to the given coach.
-- EWMA for CTL/ATL uses the TrainingPeaks convention:
--   K_CTL = 1 - exp(-1/42),  K_ATL = 1 - exp(-1/7)
-- Iterates a 180-day date series per athlete (loop in plpgsql over a CTE).
CREATE OR REPLACE FUNCTION get_squad_overview(p_coach_id uuid)
RETURNS TABLE (
  athlete_id         uuid,
  display_name       text,
  today_ctl          numeric,
  today_atl          numeric,
  today_tsb          numeric,
  acwr_ratio         numeric,
  acwr_status        text,
  last_hrv_score     numeric,
  last_session_date  date,
  missed_sessions_7d int,
  training_status    text,
  adherence_pct      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _ath       RECORD;
  _day       RECORD;
  _ctl       numeric;
  _atl       numeric;
  _ctl_7ago  numeric;
  _tss7      numeric;
  _tss28     numeric;
  _cutoff    date := CURRENT_DATE - 179;
  _7ago      date := CURRENT_DATE - 7;
  K_CTL CONSTANT numeric := 1.0 - exp(-1.0/42);
  K_ATL CONSTANT numeric := 1.0 - exp(-1.0/7);
BEGIN
  FOR _ath IN
    SELECT ca.athlete_id,
           COALESCE(p.display_name, p.email, 'Athlete') AS dname
    FROM   coach_athletes ca
    JOIN   profiles p ON p.id = ca.athlete_id
    WHERE  ca.coach_id = p_coach_id
      AND  ca.status   = 'active'
  LOOP
    _ctl := 0;  _atl := 0;  _ctl_7ago := 0;

    -- Day-by-day EWMA over 180-day priming window
    FOR _day IN (
      WITH ds AS (
        SELECT generate_series(_cutoff, CURRENT_DATE, '1 day'::interval)::date AS d
      )
      SELECT ds.d,
             COALESCE(SUM(tl.tss), 0) AS daily_tss
      FROM   ds
      LEFT JOIN training_log tl
             ON tl.user_id = _ath.athlete_id AND tl.date = ds.d
      GROUP  BY ds.d
      ORDER  BY ds.d
    ) LOOP
      IF _day.d = _7ago THEN _ctl_7ago := _ctl; END IF;
      _ctl := _ctl * (1 - K_CTL) + _day.daily_tss * K_CTL;
      _atl := _atl * (1 - K_ATL) + _day.daily_tss * K_ATL;
    END LOOP;

    athlete_id   := _ath.athlete_id;
    display_name := _ath.dname;
    today_ctl    := ROUND(_ctl::numeric, 1);
    today_atl    := ROUND(_atl::numeric, 1);
    today_tsb    := ROUND((_ctl - _atl)::numeric, 1);

    -- ACWR: 7d acute / (28d chronic / 4)
    SELECT COALESCE(SUM(tss), 0) INTO _tss7
    FROM   training_log
    WHERE  user_id = _ath.athlete_id AND date >= CURRENT_DATE - 6;

    SELECT COALESCE(SUM(tss), 0) INTO _tss28
    FROM   training_log
    WHERE  user_id = _ath.athlete_id AND date >= CURRENT_DATE - 27;

    IF _tss28 = 0 THEN
      acwr_ratio  := NULL;
      acwr_status := 'low';
    ELSE
      acwr_ratio  := ROUND((_tss7 / (_tss28 / 4.0))::numeric, 2);
      acwr_status := CASE
        WHEN acwr_ratio > 1.5  THEN 'danger'
        WHEN acwr_ratio > 1.3  THEN 'caution'
        WHEN acwr_ratio >= 0.8 THEN 'optimal'
        ELSE 'low'
      END;
    END IF;

    -- Most recent HRV (rMSSD ms)
    SELECT hrv INTO last_hrv_score
    FROM   recovery
    WHERE  user_id = _ath.athlete_id AND hrv IS NOT NULL
    ORDER  BY date DESC LIMIT 1;

    -- Most recent session date
    SELECT MAX(date) INTO last_session_date
    FROM   training_log
    WHERE  user_id = _ath.athlete_id;

    -- Missed sessions (plan adherence stub — extend when plan table supports it)
    missed_sessions_7d := 0;

    -- Adherence: sessions logged in last 7 days / 7
    SELECT LEAST(100, ROUND(COUNT(*) / 7.0 * 100)::numeric)
    INTO   adherence_pct
    FROM   training_log
    WHERE  user_id = _ath.athlete_id AND date >= CURRENT_DATE - 6;

    -- Training status (priority order per spec)
    training_status := CASE
      WHEN _atl > _ctl + 20                                    THEN 'Overreaching'
      WHEN last_session_date IS NULL
        OR last_session_date < CURRENT_DATE - 4               THEN 'Detraining'
      WHEN _ctl > _ctl_7ago + 3                                THEN 'Building'
      WHEN (_ctl - _atl) > 15                                  THEN 'Peaking'
      WHEN _ctl < _ctl_7ago - 3                                THEN 'Recovering'
      ELSE                                                          'Maintaining'
    END;

    RETURN NEXT;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION get_squad_overview(uuid) TO authenticated;
