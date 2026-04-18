-- tests/perf/seed-perf-data.sql
-- Seed 18 k training sessions for perf test athletes.
-- Assumes perf test users already exist (created by harness.ts --setup).
-- Safe to re-run: INSERT ... ON CONFLICT DO NOTHING.
-- Run via: psql $SUPABASE_DB_URL < tests/perf/seed-perf-data.sql

DO $$
DECLARE
  _athlete_ids  uuid[];
  _athlete      uuid;
  _day          int;
  _sessions     int;
  _start_date   date := CURRENT_DATE - 364;
  _types        text[] := ARRAY[
    'Easy','Threshold','VO2max','Long Run','Tempo','Intervals','Race','Rest'
  ];
  _sources      text[] := ARRAY['manual','strava','gpx'];
  _total        bigint := 0;
BEGIN
  -- Collect perf test athlete IDs (role=athlete, email ends @perf.sporeus.dev)
  SELECT ARRAY_AGG(u.id) INTO _athlete_ids
  FROM auth.users u
  WHERE u.email LIKE '%@perf.sporeus.dev'
    AND (u.raw_user_meta_data->>'role') = 'athlete';

  IF _athlete_ids IS NULL OR cardinality(_athlete_ids) = 0 THEN
    RAISE EXCEPTION 'No perf test athletes found. Run harness.ts --setup first.';
  END IF;

  FOREACH _athlete IN ARRAY _athlete_ids LOOP
    -- 365 days × average 5 sessions = 1825 sessions per athlete
    -- Vary sessions/day (1–8) to give realistic distribution
    FOR _day IN 0..364 LOOP
      -- Deterministic pseudorandom session count: 1–8, biased toward 4–6
      _sessions := CASE
        WHEN _day % 7 = 0 THEN 1   -- Sunday rest-ish
        WHEN _day % 7 = 6 THEN 2   -- Saturday lighter
        WHEN _day % 3 = 0 THEN 7
        ELSE 5
      END;

      INSERT INTO training_log (
        user_id,
        date,
        type,
        duration_min,
        tss,
        rpe,
        notes,
        source
      )
      SELECT
        _athlete,
        _start_date + _day,
        _types[ 1 + ((_day + s.n) % array_length(_types, 1)) ],
        30 + ((_day * 7 + s.n * 13) % 120),        -- 30–149 min
        ROUND((10 + ((_day * 11 + s.n * 17) % 115))::numeric, 1),  -- 10–124 TSS
        1 + ((_day + s.n) % 9),                    -- RPE 1–9
        CASE WHEN s.n % 3 = 0
          THEN 'Felt ' || (ARRAY['strong','tired','good','heavy','fresh'])[1 + ((_day+s.n)%5)]
               || ' during ' || _types[1 + ((_day+s.n) % array_length(_types,1))]
          ELSE NULL
        END,
        _sources[ 1 + ((_day + s.n) % array_length(_sources, 1)) ]
      FROM generate_series(1, _sessions) AS s(n)
      ON CONFLICT DO NOTHING;

    END LOOP;  -- days
  END LOOP;  -- athletes

  SELECT COUNT(*) INTO _total
  FROM training_log
  WHERE user_id = ANY(_athlete_ids);

  RAISE NOTICE 'Perf seed complete: % total rows for % athletes',
    _total, cardinality(_athlete_ids);
END $$;

-- Seed recovery rows (HRV data — needed for coach_dashboard last_hrv_score)
DO $$
DECLARE
  _athlete_ids  uuid[];
  _athlete      uuid;
  _day          int;
  _start_date   date := CURRENT_DATE - 364;
BEGIN
  SELECT ARRAY_AGG(u.id) INTO _athlete_ids
  FROM auth.users u
  WHERE u.email LIKE '%@perf.sporeus.dev'
    AND (u.raw_user_meta_data->>'role') = 'athlete';

  IF _athlete_ids IS NULL THEN RETURN; END IF;

  FOREACH _athlete IN ARRAY _athlete_ids LOOP
    FOR _day IN 0..364 LOOP
      INSERT INTO recovery (user_id, date, score, sleep_hrs, soreness, stress, mood, hrv)
      VALUES (
        _athlete,
        _start_date + _day,
        50 + (_day % 50),
        6.0 + (_day % 3),
        1 + (_day % 5),
        1 + (_day % 5),
        1 + (_day % 5),
        55 + (_day % 40)::numeric   -- HRV 55–94 ms
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Seed FTS-searchable notes for search_performance scenario
-- Ensures ~30 % of sessions have rich text notes (≈5 500 rows)
DO $$
DECLARE
  _athlete_ids  uuid[];
  _phrases      text[] := ARRAY[
    'threshold run in rain, felt strong',
    'easy recovery jog after long weekend',
    'VO2max intervals on track, legs heavy',
    'long ride with moderate headwind',
    'tempo run at lactate threshold',
    'hard day: sprint repeats at 5k pace',
    'aerobic base building session at Z2',
    'race simulation, pacing strategy tested'
  ];
BEGIN
  SELECT ARRAY_AGG(u.id) INTO _athlete_ids
  FROM auth.users u
  WHERE u.email LIKE '%@perf.sporeus.dev'
    AND (u.raw_user_meta_data->>'role') = 'athlete';

  IF _athlete_ids IS NULL THEN RETURN; END IF;

  UPDATE training_log
  SET    notes = _phrases[ 1 + (floor(random()*array_length(_phrases,1)))::int ]
  WHERE  user_id = ANY(_athlete_ids)
    AND  notes IS NULL
    AND  random() < 0.30;  -- update 30 % of null-notes rows

  RAISE NOTICE 'FTS notes seeded for ~30%% of sessions.';
END $$;
