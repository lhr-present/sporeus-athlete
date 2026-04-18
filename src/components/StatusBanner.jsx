// ─── StatusBanner.jsx — Non-dismissible system status banner ─────────────────
// Shows when any external service is 'down' or 'degraded'.
// Polls get_system_status() RPC every 5 min. Sits above OfflineBanner (z 10004).
import { useState, useEffect, useCallback, useContext } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { LangCtx } from '../contexts/LangCtx.jsx'

const MONO        = "'IBM Plex Mono', monospace"
const POLL_MS     = 5 * 60_000   // 5 min
const RETRY_MS    = 30_000       // retry on fetch error

// Service labels for user-facing messages
const SERVICE_LABEL = {
  strava_api:    'Strava',
  anthropic_api: 'AI features',
  dodo_payments: 'Dodo Payments',
  stripe:        'Stripe',
  supabase_api:  'Sporeus API',
}

function bannerStyle(status) {
  if (status === 'down') {
    return {
      background:   '#3a0000',
      borderBottom: '1px solid #cc0000',
      color:        '#ff6666',
    }
  }
  return {
    background:   '#2a1800',
    borderBottom: '1px solid #cc7700',
    color:        '#ffaa44',
  }
}

export default function StatusBanner() {
  const { t } = useContext(LangCtx)
  const [issues, setIssues] = useState([])

  const check = useCallback(async () => {
    if (!isSupabaseReady()) return

    try {
      const { data, error } = await supabase.rpc('get_system_status')
      if (error) throw error

      const affected = (data ?? []).filter(
        row => row.status === 'down' || row.status === 'degraded'
      )
      setIssues(affected)
    } catch {
      // Non-fatal — don't surface network errors as status issues
    }
  }, [])

  useEffect(() => {
    check()
    const iv = setInterval(check, POLL_MS)
    return () => clearInterval(iv)
  }, [check])

  if (issues.length === 0) return null

  const worstStatus = issues.some(i => i.status === 'down') ? 'down' : 'degraded'
  const style       = bannerStyle(worstStatus)

  const serviceNames = issues
    .map(i => SERVICE_LABEL[i.service] ?? i.service)
    .join(', ')

  const suffix = worstStatus === 'down'
    ? t('status_outage_suffix')
    : t('status_degraded_suffix')
  const msg = `${serviceNames} ${suffix}`

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="status-banner"
      data-status={worstStatus}
      style={{
        position:   'fixed',
        top:        0,
        left:       0,
        right:      0,
        zIndex:     10004,
        fontFamily: MONO,
        fontSize:   '10px',
        padding:    '6px 20px',
        textAlign:  'center',
        letterSpacing: '0.08em',
        ...style,
      }}
    >
      {worstStatus === 'down' ? '◉ ' : '◈ '}
      {msg.toUpperCase()}
      {issues.some(i => i.stale) && (
        <span style={{ opacity: 0.6, marginLeft: '8px' }}>
          ({t('status_check_stale', 'status check may be stale')})
        </span>
      )}
    </div>
  )
}
