// ─── useInsightNotifier.js — Realtime ai_insights toast for session_analysis ──
// Subscribes to ai_insights postgres_changes for the current user.
// When a new row with kind='session_analysis' arrives, enqueues a toast via
// the provided addToast callback.
//
// Called from useAppState so it has access to both authUser and addToast.

import { useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'

/**
 * @param {object}   opts
 * @param {string|null} opts.userId    — auth.uid(), null when signed out
 * @param {Function}    opts.addToast  — from useToasts
 * @param {Function}    [opts.onInsight] — called with the new ai_insights row on tap
 */
export function useInsightNotifier({ userId, addToast, onInsight }) {
  const channelRef   = useRef(null)
  const addToastRef  = useRef(addToast)
  const onInsightRef = useRef(onInsight)
  addToastRef.current  = addToast
  onInsightRef.current = onInsight

  useEffect(() => {
    if (!userId || !isSupabaseReady()) return

    const ch = supabase
      .channel(`insight-notifier-${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'ai_insights',
        filter: `athlete_id=eq.${userId}`,
      }, ({ new: row }) => {
        if (row.kind !== 'session_analysis') return

        logger.info('useInsightNotifier: new session_analysis row', row.id)

        addToastRef.current({
          id:       `insight-${row.id}`,
          message:  'New session insight ready — tap to view',
          type:     'info',
          duration: 8000,
          action: onInsightRef.current
            ? { label: 'VIEW', onClick: () => onInsightRef.current(row) }
            : null,
        })
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.warn('useInsightNotifier: channel error, realtime may be unavailable')
        }
      })

    channelRef.current = ch

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- userId is stable per session; callbacks via refs
  }, [userId])
}
