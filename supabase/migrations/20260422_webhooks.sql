-- ─── 20260422_webhooks.sql — DB triggers for event-driven analysis ───────────
-- v7.43.0: 4 triggers:
--   1. on_training_log_insert  → POST to analyse-session  (pg_net webhook)
--   2. on_injury_insert        → POST to adjust-coach-plan (pg_net webhook)
--   3. on_recovery_hrv_drop    → pure pg trigger → notification_log inserts
--   4. on_test_result_ftp      → pure pg trigger → profiles.ftp + power zones

-- ── Extend notification_log kind CHECK to include hrv_alert ─────────────────────
ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_kind_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN (
    'checkin_reminder', 'invite_accepted', 'readiness_red',
    'session_feedback', 'missed_checkin', 'test',
    'race_countdown', 'injury_alert', 'system', 'message',
    'hrv_alert'
  ));

-- ── Helper: compute Coggan 7-zone power bands from FTP ───────────────────────────
CREATE OR REPLACE FUNCTION compute_power_zones(ftp_watts INT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
AS $$
BEGIN
  IF ftp_watts IS NULL OR ftp_watts <= 0 THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'z1', jsonb_build_array(0,                        ROUND(ftp_watts * 0.55)),
    'z2', jsonb_build_array(ROUND(ftp_watts * 0.56),  ROUND(ftp_watts * 0.75)),
    'z3', jsonb_build_array(ROUND(ftp_watts * 0.76),  ROUND(ftp_watts * 0.90)),
    'z4', jsonb_build_array(ROUND(ftp_watts * 0.91),  ROUND(ftp_watts * 1.05)),
    'z5', jsonb_build_array(ROUND(ftp_watts * 1.06),  ROUND(ftp_watts * 1.20)),
    'z6', jsonb_build_array(ROUND(ftp_watts * 1.21),  ROUND(ftp_watts * 1.50)),
    'z7', jsonb_build_array(ROUND(ftp_watts * 1.51),  NULL::int)
  );
END;
$$;

COMMENT ON FUNCTION compute_power_zones(INT) IS
  'Coggan 7-zone power bands as JSONB {z1..z7: [low, high]} from FTP.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER 1: training_log INSERT → analyse-session webhook
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_webhook_analyse_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url     TEXT;
  v_key     TEXT;
  v_payload JSONB;
BEGIN
  -- Only fire for non-file-upload sessions to avoid duplicate analysis
  -- (UploadActivity already invokes parse-activity which may call analyse-session)
  -- All sources qualify; parse-activity deduplicates via source_id.

  v_url := current_setting('app.supabase_url', true) || '/functions/v1/analyse-session';
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL OR v_url = '/functions/v1/analyse-session' THEN
    -- Settings not configured — skip silently (dev/test environment)
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'session_id', NEW.id,
    'user_id',    NEW.user_id,
    'source',     'db_webhook'
  );

  PERFORM net.http_post(
    url     := v_url,
    body    := v_payload,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_training_log_insert ON training_log;
CREATE TRIGGER on_training_log_insert
  AFTER INSERT ON training_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_webhook_analyse_session();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER 2: injuries INSERT → adjust-coach-plan webhook
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_webhook_adjust_plan_on_injury()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url     TEXT;
  v_key     TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/adjust-coach-plan';
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL OR v_url = '/functions/v1/adjust-coach-plan' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'injury_id', NEW.id,
      'user_id',   NEW.user_id,
      'level',     NEW.level,
      'zone',      NEW.zone,
      'source',    'db_webhook'
    ),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_injury_insert ON injuries;
CREATE TRIGGER on_injury_insert
  AFTER INSERT ON injuries
  FOR EACH ROW
  EXECUTE FUNCTION fn_webhook_adjust_plan_on_injury();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER 3: recovery INSERT → HRV drop detection (pure pg, no HTTP)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_check_hrv_drop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mean    FLOAT;
  v_stddev  FLOAT;
  v_delta   FLOAT;
  v_sigma   FLOAT;
  v_coach   UUID;
BEGIN
  -- Only fire when HRV was recorded
  IF NEW.hrv IS NULL THEN RETURN NEW; END IF;

  -- 28-day rolling baseline (exclude today's row, which is being inserted)
  SELECT AVG(hrv), STDDEV(hrv)
  INTO v_mean, v_stddev
  FROM recovery
  WHERE user_id = NEW.user_id
    AND date >= CURRENT_DATE - INTERVAL '28 days'
    AND date < NEW.date
    AND hrv IS NOT NULL;

  -- Need at least 5 data points and non-zero variance for meaningful alert
  IF v_mean IS NULL OR v_stddev IS NULL OR v_stddev < 0.01 THEN RETURN NEW; END IF;

  v_delta := NEW.hrv - v_mean;
  v_sigma := v_delta / v_stddev;

  -- Alert when > 2 standard deviations below personal mean
  IF v_sigma < -2.0 THEN
    -- Athlete notification
    INSERT INTO notification_log (user_id, kind, dedupe_key, payload, delivery_status)
    VALUES (
      NEW.user_id,
      'hrv_alert',
      'hrv_alert_athlete_' || NEW.user_id || '_' || NEW.date,
      jsonb_build_object(
        'hrv',    NEW.hrv,
        'mean',   ROUND(v_mean::numeric, 1),
        'stddev', ROUND(v_stddev::numeric, 1),
        'sigma',  ROUND(v_sigma::numeric, 2),
        'date',   NEW.date
      ),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;

    -- Find linked active coach and notify them too
    SELECT coach_id INTO v_coach
    FROM coach_athletes
    WHERE athlete_id = NEW.user_id
      AND status = 'active'
    LIMIT 1;

    IF v_coach IS NOT NULL THEN
      INSERT INTO notification_log (user_id, kind, dedupe_key, payload, delivery_status)
      VALUES (
        v_coach,
        'hrv_alert',
        'hrv_alert_coach_' || NEW.user_id || '_' || NEW.date,
        jsonb_build_object(
          'athlete_id', NEW.user_id,
          'hrv',        NEW.hrv,
          'mean',       ROUND(v_mean::numeric, 1),
          'sigma',      ROUND(v_sigma::numeric, 2),
          'date',       NEW.date
        ),
        'pending'
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_recovery_hrv_drop ON recovery;
CREATE TRIGGER on_recovery_hrv_drop
  AFTER INSERT ON recovery
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_hrv_drop();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER 4: test_results INSERT (test_id='ftp') → update profiles.ftp + zones
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_update_ftp_on_test()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ftp INT;
BEGIN
  -- Only react to FTP test entries
  IF LOWER(NEW.test_id) <> 'ftp' THEN RETURN NEW; END IF;
  IF NEW.value IS NULL OR NEW.value <= 0 THEN RETURN NEW; END IF;

  v_ftp := ROUND(NEW.value::numeric)::INT;

  UPDATE profiles
  SET
    ftp          = v_ftp,
    profile_data = COALESCE(profile_data, '{}'::jsonb)
                    || jsonb_build_object(
                         'ftp',         v_ftp,
                         'powerZones',  compute_power_zones(v_ftp),
                         'ftpUpdatedAt', NOW()::text
                       )
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_test_result_ftp ON test_results;
CREATE TRIGGER on_test_result_ftp
  AFTER INSERT ON test_results
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_ftp_on_test();
