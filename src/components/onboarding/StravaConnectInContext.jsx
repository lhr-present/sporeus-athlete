// src/components/onboarding/StravaConnectInContext.jsx — E9
// Shown on sparse charts (< 14 sessions). Prompts Strava connect at the
// moment it would be most helpful — not at signup.

import { useState } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { initiateStravaOAuth } from '../../lib/strava.js'

export default function StravaConnectInContext({ sessionCount, lang = 'en', userId }) {
  const [dismissed, setDismissed] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Only show when chart is sparse (< 14 sessions)
  if (dismissed || sessionCount >= 14) return null

  const L = lang === 'tr' ? TR : EN

  async function connect() {
    if (!isSupabaseReady()) return
    setConnecting(true)
    try {
      // Mark the Strava prompt shown in onboarding_state (best-effort).
      if (userId) {
        await supabase
          .from('onboarding_state')
          .upsert({ user_id: userId, strava_prompted: true }, { onConflict: 'user_id' })
          .then(null, () => {})
      }
      // Browser-redirect to Strava's OAuth authorize page — the SAME path the
      // working Profile connect button uses. (Fix: the old code invoked
      // strava-oauth with no `code` and expected a `res.data.url` the edge fn
      // never returns — so this button did nothing. The edge fn's `connect`
      // action exchanges the code AFTER Strava redirects back.)
      const r = initiateStravaOAuth()
      if (!r.ok) { setConnecting(false) /* leaves the prompt visible with no redirect */ }
      // On success the browser navigates away to Strava; no further work here.
    } catch {
      setConnecting(false)
    }
  }

  function dismiss() {
    setDismissed(true)
  }

  return (
    <div style={{
      border:        '1px solid #0064ff',
      borderRadius:  '6px',
      padding:       '12px 14px',
      marginBottom:  '12px',
      background:    'rgba(0,100,255,0.04)',
      display:       'flex',
      alignItems:    'center',
      justifyContent:'space-between',
      gap:           '12px',
    }}
      role="complementary"
      aria-label={L.ariaLabel}
    >
      <div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
          {L.headline.replace('{count}', String(sessionCount))}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
          {L.description}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={connect}
          disabled={connecting}
          style={{
            padding:      '6px 14px',
            background:   '#fc4c02',
            color:        '#fff',
            border:       'none',
            borderRadius: '4px',
            cursor:       'pointer',
            fontSize:     '12px',
            fontFamily:   'inherit',
            fontWeight:   600,
            whiteSpace:   'nowrap',
          }}
        >
          {connecting ? '…' : L.connectBtn}
        </button>
        <button
          onClick={dismiss}
          aria-label={L.dismissLabel}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      'var(--muted)',
            fontSize:   '16px',
            padding:    '4px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

const EN = {
  headline:     'Your chart has {count} sessions.',
  description:  'Connect Strava to import your last 90 days of activity automatically.',
  connectBtn:   'Connect Strava',
  dismissLabel: 'Dismiss Strava prompt',
  ariaLabel:    'Connect Strava for more training history',
}

const TR = {
  headline:     'Grafiğinde {count} antrenman var.',
  description:  'Son 90 günlük Strava aktivitelerini otomatik içe aktarmak için Strava\'yı bağla.',
  connectBtn:   'Strava\'yı Bağla',
  dismissLabel: 'Strava önerisini kapat',
  ariaLabel:    'Daha fazla antrenman geçmişi için Strava bağla',
}
