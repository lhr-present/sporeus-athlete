// ─── useSubscription.js — Realtime profiles subscription status ───────────────
// Subscribes to postgres_changes on the current user's profiles row.
// Calls onUpdate({ subscription_status, subscription_tier, trial_ends_at,
//   grace_period_ends_at, subscription_end_date }) whenever the webhook
// drives a state change — no reload required.

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

export function useSubscription(userId, onUpdate) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    if (!userId || !supabase) return

    const channel = supabase
      .channel(`profile-sub:${userId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'profiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        const {
          subscription_status, subscription_tier,
          trial_ends_at, grace_period_ends_at, subscription_end_date,
        } = payload.new
        cbRef.current?.({
          subscription_status,
          subscription_tier,
          trial_ends_at,
          grace_period_ends_at,
          subscription_end_date,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}
