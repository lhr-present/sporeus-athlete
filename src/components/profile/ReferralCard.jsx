// ─── ReferralCard — referral code + stats for coach/club tier ────────────────
import { useState, useEffect } from 'react'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'
import { getTierSync } from '../../lib/subscription.js'
import { generateReferralCode, getReferralStats } from '../../lib/referral.js'

export default function ReferralCard({ authUser }) {
  const tier = getTierSync()
  const [stats, setStats]   = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!authUser?.id || tier === 'free') return
    getReferralStats(authUser.id).then(setStats)
  }, [authUser?.id, tier])

  if (tier === 'free' || !authUser) return null

  const code     = stats?.code || generateReferralCode(authUser.id)
  const shareUrl = `https://sporeus.com/join?ref=${code}`
  const uses     = stats?.uses ?? 0
  const rewards  = stats?.rewards ?? []

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } catch (e) { logger.warn('share:', e.message) }
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>REFER A CLUB</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', marginBottom:12, lineHeight:1.6 }}>
        Every 3 new clubs you refer earns 1 month free on your plan.
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700, color:'#ff6600', letterSpacing:'0.1em' }}>
          {code}
        </span>
        <button onClick={copyCode} style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#555', marginBottom:10, wordBreak:'break-all' }}>
        {shareUrl}
      </div>
      {uses > 0 && (
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5bc25b' }}>
          {uses} club{uses !== 1 ? 's' : ''} referred
          {rewards.length > 0 ? ` · ${rewards.length} reward${rewards.length > 1 ? 's' : ''} earned` : ''}
        </div>
      )}
    </div>
  )
}
