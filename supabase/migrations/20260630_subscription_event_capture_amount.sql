-- 20260630_subscription_event_capture_amount.sql
-- Deferred backlog: billing_events.amount_cents/currency were always NULL because
-- apply_subscription_event delegated to apply_tier_change WITHOUT forwarding amount.
-- apply_tier_change already accepts p_amount_cents/p_currency (20260454); this forwards
-- them, extracted from the event payload (Dodo metadata.amount major-unit string;
-- Stripe data.object.amount minor units), regex-guarded so a bad amount can't break
-- provisioning. Verbatim live body + the payment branch extended. No live subs exist yet.

CREATE OR REPLACE FUNCTION public.apply_subscription_event(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_event_id text;
  v_type     text;
  v_provider text;
  v_user_id  uuid;
  v_tier     text;
  v_amount_cents int;
  v_currency text;
BEGIN
  v_type     := p_event->>'type';
  v_provider := COALESCE(p_event->>'provider', 'dodo');
  v_event_id := COALESCE(p_event->>'id', 'evt_' || public.gen_random_uuid()::text);

  -- Resolve user_id across Dodo + Stripe payload shapes
  v_user_id := COALESCE(
    (p_event->'metadata'->>'user_id')::uuid,
    (p_event->>'user_id')::uuid,
    (p_event->'data'->'object'->'metadata'->>'user_id')::uuid
  );

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_user_id');
  END IF;

  -- Idempotency: insert or detect duplicate
  BEGIN
    INSERT INTO public.subscription_events(event_id, provider, type, user_id, payload, processed_at)
    VALUES (v_event_id, v_provider, v_type, v_user_id, p_event, now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event_id);
  END;

  -- State machine: delegate paid upgrades to apply_tier_change for billing_events audit
  CASE v_type
    WHEN 'payment.succeeded', 'payment_intent.succeeded', 'invoice.payment_succeeded' THEN
      v_tier := COALESCE(
        p_event->'metadata'->>'tier',
        p_event->'data'->'object'->'metadata'->>'tier',
        'coach'
      );
      -- Capture payment amount/currency for billing_events. Dodo: metadata.amount is a
      -- major-unit decimal string (299.00 -> 29900 cents). Stripe: data.object.amount is
      -- already minor units (900 -> 900 cents). Regex-guarded so a malformed amount can
      -- NEVER throw and break tier provisioning (falls to NULL instead).
      v_amount_cents := COALESCE(
        CASE WHEN (p_event->'metadata'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
             THEN round((p_event->'metadata'->>'amount')::numeric * 100)::int END,
        CASE WHEN (p_event->'data'->'object'->>'amount') ~ '^[0-9]+$'
             THEN (p_event->'data'->'object'->>'amount')::int END
      );
      v_currency := upper(COALESCE(
        p_event->'metadata'->>'currency',
        p_event->'data'->'object'->>'currency',
        'TRY'
      ));
      PERFORM public.apply_tier_change(
        p_user_id          := v_user_id,
        p_new_tier         := v_tier,
        p_reason           := v_type,
        p_webhook_event_id := v_event_id,
        p_webhook_source   := v_provider,
        p_amount_cents     := v_amount_cents,
        p_currency         := v_currency
      );
      UPDATE public.profiles SET
        subscription_provider = v_provider,
        updated_at            = now()
      WHERE id = v_user_id;

    WHEN 'payment.failed', 'invoice.payment_failed' THEN
      UPDATE public.profiles SET
        subscription_status  = 'past_due',
        grace_period_ends_at = now() + INTERVAL '3 days',
        updated_at           = now()
      WHERE id = v_user_id;

    WHEN 'subscription.cancelled', 'customer.subscription.deleted' THEN
      UPDATE public.profiles SET
        subscription_status   = 'cancelled',
        subscription_end_date = COALESCE(
          to_timestamp((p_event->'data'->'object'->>'current_period_end')::double precision),
          subscription_expires_at,
          now() + INTERVAL '30 days'
        ),
        updated_at = now()
      WHERE id = v_user_id;
      INSERT INTO public.billing_events(user_id, event_type, reason, webhook_source, webhook_event_id)
      VALUES (v_user_id, 'tier_downgrade', v_type, v_provider, v_event_id);

    WHEN 'subscription.created', 'subscription.trial_start' THEN
      UPDATE public.profiles SET
        subscription_status   = 'trialing',
        subscription_provider = v_provider,
        trial_ends_at         = COALESCE(
          (p_event->>'trial_ends_at')::timestamptz,
          now() + INTERVAL '14 days'
        ),
        updated_at = now()
      WHERE id = v_user_id;

    WHEN 'subscription.updated', 'customer.subscription.updated' THEN
      -- Advance period end on renewal. Dodo puts current_period_end at the top
      -- level (ISO); Stripe nests it under data.object as a unix timestamp. (Was
      -- top-level only and matched the Dodo event name only.)
      UPDATE public.profiles SET
        subscription_current_period_end = COALESCE(
          (p_event->>'current_period_end')::timestamptz,
          to_timestamp((p_event->'data'->'object'->>'current_period_end')::double precision),
          subscription_current_period_end
        ),
        updated_at = now()
      WHERE id = v_user_id;

    ELSE NULL; -- unknown type: recorded in subscription_events, no state change
  END CASE;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_event_id);
END;
$function$;
