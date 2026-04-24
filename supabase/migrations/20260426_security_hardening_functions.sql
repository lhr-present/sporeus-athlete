-- ═══════════════════════════════════════════════════════════════════════════
-- Security: SECURITY DEFINER search_path fix for all flagged functions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. Simple ALTER (bodies already use schema-qualified names / pgmq.*) ───

ALTER FUNCTION public.ack_ai_session_msg(bigint)               SET search_path = '';
ALTER FUNCTION public.decrypt_device_token(bytea)              SET search_path = '';
ALTER FUNCTION public.delete_ai_batch_msg(bigint)              SET search_path = '';
ALTER FUNCTION public.delete_push_fanout_msg(bigint)           SET search_path = '';
ALTER FUNCTION public.delete_strava_backfill_msg(bigint)       SET search_path = '';
ALTER FUNCTION public.drain_ai_session_queue(integer, integer) SET search_path = '';
ALTER FUNCTION public.encrypt_device_token(text)               SET search_path = '';
ALTER FUNCTION public.enqueue_ai_batch(jsonb, integer)         SET search_path = '';
ALTER FUNCTION public.enqueue_push_fanout(jsonb)               SET search_path = '';
ALTER FUNCTION public.enqueue_strava_backfill(jsonb)           SET search_path = '';
ALTER FUNCTION public.inject_tier_jwt_claim(jsonb)             SET search_path = '';
ALTER FUNCTION public.move_to_dlq(jsonb)                       SET search_path = '';
ALTER FUNCTION public.read_ai_batch(integer, integer)          SET search_path = '';
ALTER FUNCTION public.read_push_fanout(integer, integer)       SET search_path = '';
ALTER FUNCTION public.read_strava_backfill(integer, integer)   SET search_path = '';
ALTER FUNCTION public.refresh_queue_metrics()                  SET search_path = '';
ALTER FUNCTION public.enqueue_session_analysis(text, date, text, numeric, numeric, numeric) SET search_path = '';

-- ── B. Rewrite bodies to use public.* + SET search_path = '' ──────────────

CREATE OR REPLACE FUNCTION public.get_my_tier()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(subscription_tier, 'free')
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_load_timeline(p_days integer DEFAULT 90)
RETURNS TABLE(date date, daily_tss numeric, sessions integer, atl_7d numeric,
              ctl_42d numeric, avg_rpe numeric, total_min numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT date, daily_tss, sessions, atl_7d, ctl_42d, avg_rpe, total_min
  FROM   public.mv_ctl_atl_daily
  WHERE  user_id = auth.uid()
    AND  date >= CURRENT_DATE - p_days
  ORDER  BY date;
$$;

CREATE OR REPLACE FUNCTION public.get_squad_readiness()
RETURNS TABLE(athlete_id uuid, athlete_name text, last_date date,
              atl_7d numeric, ctl_42d numeric, acwr numeric, last_day_tss numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT athlete_id, athlete_name, last_date, atl_7d, ctl_42d, acwr, last_day_tss
  FROM   public.mv_squad_readiness
  WHERE  coach_id = auth.uid()
  ORDER  BY acwr DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_summary(p_weeks integer DEFAULT 16)
RETURNS TABLE(week_start date, total_tss numeric, session_count integer,
              avg_rpe numeric, max_session_tss numeric, total_min numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT week_start, total_tss, session_count, avg_rpe, max_session_tss, total_min
  FROM   public.mv_weekly_load_summary
  WHERE  user_id = auth.uid()
    AND  week_start >= DATE_TRUNC('week', CURRENT_DATE) - (p_weeks || ' weeks')::interval
  ORDER  BY week_start;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_load()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ctl_atl_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_weekly_load_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_squad_readiness;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_referral_uses(p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.referral_codes
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE code = p_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_tier_change(
  p_user_id          uuid,
  p_new_tier         text,
  p_reason           text,
  p_webhook_event_id text    DEFAULT NULL::text,
  p_old_tier         text    DEFAULT NULL::text,
  p_amount_cents     integer DEFAULT NULL::integer,
  p_currency         text    DEFAULT NULL::text,
  p_webhook_source   text    DEFAULT NULL::text,
  p_sub_status       text    DEFAULT NULL::text,
  p_expires_days     integer DEFAULT 30
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_old_tier   TEXT;
  v_event_type TEXT;
  v_new_status TEXT;
BEGIN
  IF p_new_tier NOT IN ('free','coach','club') THEN
    RAISE EXCEPTION 'apply_tier_change: invalid tier "%"', p_new_tier;
  END IF;
  IF p_old_tier IS NULL THEN
    SELECT subscription_tier INTO v_old_tier FROM public.profiles WHERE id = p_user_id;
  ELSE v_old_tier := p_old_tier; END IF;

  v_event_type := CASE
    WHEN p_reason = 'trial_start'                        THEN 'trial_start'
    WHEN p_new_tier = 'free' AND p_reason LIKE 'trial%'  THEN 'trial_end'
    WHEN p_new_tier = 'free'                             THEN 'tier_downgrade'
    ELSE 'tier_upgrade'
  END;

  v_new_status := COALESCE(p_sub_status,
    CASE WHEN p_reason = 'trial_start' THEN 'trialing'
         WHEN p_new_tier = 'free'      THEN 'expired'
         ELSE 'active' END);

  UPDATE public.profiles SET
    subscription_tier       = p_new_tier,
    subscription_status     = v_new_status,
    subscription_expires_at = CASE WHEN p_new_tier != 'free'
                                THEN NOW() + (p_expires_days || ' days')::INTERVAL
                                ELSE subscription_expires_at END,
    trial_ends_at           = CASE WHEN p_reason = 'trial_start' THEN NOW() + INTERVAL '14 days'
                                   WHEN p_new_tier = 'free'      THEN NULL
                                   ELSE trial_ends_at END,
    grace_period_ends_at    = CASE WHEN v_new_status = 'active' THEN NULL
                                   ELSE grace_period_ends_at END,
    subscription_end_date   = CASE WHEN p_new_tier != 'free' THEN NULL
                                   ELSE subscription_end_date END,
    updated_at              = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_tier_change: user % not found', p_user_id;
  END IF;

  INSERT INTO public.billing_events(
    user_id, event_type, old_tier, new_tier,
    webhook_source, webhook_event_id, reason, amount_cents, currency)
  VALUES (p_user_id, v_event_type, v_old_tier, p_new_tier,
    p_webhook_source, p_webhook_event_id, p_reason, p_amount_cents, p_currency);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_everything(q text, limit_per_kind integer DEFAULT 10)
RETURNS TABLE(kind text, record_id text, rank real, snippet text, date_hint text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT 'session'::text, id::text,
      ts_rank_cd(notes_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(notes,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      date::text
    FROM public.training_log
    WHERE notes_tsv @@ plainto_tsquery('simple', q) AND user_id = auth.uid()
    ORDER BY 3 DESC LIMIT limit_per_kind;
  RETURN QUERY
    SELECT 'note'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(note,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM public.coach_notes
    WHERE body_tsv @@ plainto_tsquery('simple', q)
      AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;
  RETURN QUERY
    SELECT 'message'::text, id::text,
      ts_rank_cd(content_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(body,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      sent_at::date::text
    FROM public.messages
    WHERE content_tsv @@ plainto_tsquery('simple', q)
      AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;
  RETURN QUERY
    SELECT 'announcement'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(message,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM public.team_announcements
    WHERE body_tsv @@ plainto_tsquery('simple', q)
      AND (coach_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.coach_athletes ca
                      WHERE ca.athlete_id = auth.uid()
                        AND ca.coach_id = team_announcements.coach_id
                        AND ca.status = 'active'))
    ORDER BY 3 DESC LIMIT limit_per_kind;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_squad_overview(p_coach_id uuid)
RETURNS TABLE(
  athlete_id uuid, display_name text,
  today_ctl numeric, today_atl numeric, today_tsb numeric,
  acwr_ratio numeric, acwr_status text,
  last_hrv_score numeric, last_session_date date,
  missed_sessions_7d integer, training_status text, adherence_pct numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _ath      RECORD;
  _day      RECORD;
  _ctl      numeric;
  _atl      numeric;
  _ctl_7ago numeric;
  _tss7     numeric;
  _tss28    numeric;
  _cutoff   date := CURRENT_DATE - 179;
  _7ago     date := CURRENT_DATE - 7;
  K_CTL CONSTANT numeric := 1.0 - exp(-1.0/42);
  K_ATL CONSTANT numeric := 1.0 - exp(-1.0/7);
BEGIN
  FOR _ath IN
    SELECT ca.athlete_id,
           COALESCE(p.display_name, p.email, 'Athlete') AS dname
    FROM   public.coach_athletes ca
    JOIN   public.profiles p ON p.id = ca.athlete_id
    WHERE  ca.coach_id = p_coach_id
      AND  ca.status   = 'active'
  LOOP
    _ctl := 0; _atl := 0; _ctl_7ago := 0;

    FOR _day IN (
      WITH ds AS (
        SELECT generate_series(_cutoff, CURRENT_DATE, '1 day'::interval)::date AS d
      )
      SELECT ds.d,
             COALESCE(SUM(tl.tss), 0) AS daily_tss
      FROM   ds
      LEFT JOIN public.training_log tl
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

    SELECT COALESCE(SUM(tss), 0) INTO _tss7
    FROM   public.training_log
    WHERE  user_id = _ath.athlete_id AND date >= CURRENT_DATE - 6;

    SELECT COALESCE(SUM(tss), 0) INTO _tss28
    FROM   public.training_log
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

    SELECT hrv INTO last_hrv_score
    FROM   public.recovery
    WHERE  user_id = _ath.athlete_id AND hrv IS NOT NULL
    ORDER  BY date DESC LIMIT 1;

    SELECT MAX(date) INTO last_session_date
    FROM   public.training_log
    WHERE  user_id = _ath.athlete_id;

    missed_sessions_7d := 0;

    SELECT LEAST(100, ROUND(COUNT(*) / 7.0 * 100)::numeric)
    INTO   adherence_pct
    FROM   public.training_log
    WHERE  user_id = _ath.athlete_id AND date >= CURRENT_DATE - 6;

    training_status := CASE
      WHEN _atl > _ctl + 20                                  THEN 'Overreaching'
      WHEN last_session_date IS NULL
        OR last_session_date < CURRENT_DATE - 4             THEN 'Detraining'
      WHEN _ctl > _ctl_7ago + 3                              THEN 'Building'
      WHEN (_ctl - _atl) > 15                                THEN 'Peaking'
      WHEN _ctl < _ctl_7ago - 3                              THEN 'Recovering'
      ELSE                                                        'Maintaining'
    END;

    RETURN NEXT;
  END LOOP;
END;
$$;
