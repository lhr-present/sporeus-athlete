// ─── AISettings — subscription tier, daily AI usage, cache controls ──────────
import { useState, useEffect } from 'react'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { clearInsightCache } from '../../lib/aiPrompts.js'

export default function AISettings({ authUser }) {
  const [tier, setTierState] = useState('loading')
  const [dailyUsed, setDailyUsed] = useState(0)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (!isSupabaseReady() || !authUser) return
    // Read authoritative tier from DB
    supabase.from('profiles').select('subscription_tier').eq('id', authUser.id).maybeSingle()
      .then(({ data }) => {
        const t = data?.subscription_tier || 'free'
        setTierState(t)
        try { localStorage.setItem('sporeus-tier', t) } catch (e) { logger.warn('localStorage:', e.message) }
      })
    // Read today's AI usage count
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('ai_insights').select('*', { count: 'exact', head: true })
      .eq('athlete_id', authUser.id).eq('date', today)
      .then(({ count }) => setDailyUsed(count || 0))
  }, [authUser?.id])

  if (!isSupabaseReady() || !authUser) return (
    <div style={{ ...S.mono, fontSize:'11px', color:'#555', padding:'12px 0' }}>
      Sign in to view AI settings.
    </div>
  )

  const handleClearCache = async () => {
    await clearInsightCache(authUser.id)
    try { Object.keys(localStorage).filter(k => k.startsWith('sporeus-ai-')).forEach(k => localStorage.removeItem(k)) } catch (e) { logger.warn('localStorage:', e.message) }
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  const TIER_INFO = {
    free:  { label: 'Free',  limit: 0,   desc: 'Rule-based insights only' },
    coach: { label: 'Coach', limit: 50,  desc: '50 AI calls/day' },
    club:  { label: 'Club',  limit: 500, desc: '500 AI calls/day' },
  }
  const info = TIER_INFO[tier] || TIER_INFO.free

  return (
    <div style={{ marginTop:'8px' }}>
      {/* Tier display */}
      <div style={{ marginBottom:'14px' }}>
        <label style={{ ...S.label, marginBottom:'6px' }}>SUBSCRIPTION TIER</label>
        <div style={{ ...S.mono, fontSize:'12px', color:'#ff6600', fontWeight:600 }}>
          {tier === 'loading' ? '…' : info.label.toUpperCase()}
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'3px' }}>{info.desc}</div>
        {info.limit > 0 && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#555', marginTop:'3px' }}>
            Today: {dailyUsed} / {info.limit} calls used
          </div>
        )}
        {tier === 'free' && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'6px' }}>
            Upgrade to Coach or Club at sporeus.com to enable AI insights.
          </div>
        )}
      </div>

      {/* Clear cache */}
      <div>
        <button onClick={handleClearCache} style={{ ...S.btnSec, fontSize:'11px', padding:'6px 14px' }}>
          {cleared ? '✓ Cache cleared' : 'Clear AI cache'}
        </button>
        <div style={{ ...S.mono, fontSize:'9px', color:'#444', marginTop:'4px' }}>Removes cached AI insights — next load will re-fetch.</div>
      </div>
    </div>
  )
}
