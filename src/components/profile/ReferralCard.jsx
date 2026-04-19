// ─── ReferralCard — referral code + stats + share buttons for coach/club tier ─
import { useState, useEffect } from 'react'
import { logger } from '../../lib/logger.js'
import { S } from '../../styles.js'
import { getTierSync } from '../../lib/subscription.js'
import { generateReferralCode, getReferralStats } from '../../lib/referral.js'
import { trackEvent } from '../../lib/telemetry.js'

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

  // Next reward milestone
  const nextMilestone = 3 - (uses % 3)
  const rewardMsg = uses > 0
    ? `${uses} club${uses !== 1 ? 's' : ''} referred · ${nextMilestone} more for 1 month free`
    : 'Every 3 referrals = 1 month free on your plan'

  function copyCode() {
    try {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        trackEvent('referral', 'copy_link', code)
      })
    } catch (e) { logger.warn('share:', e.message) }
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(`Sporeus'u dene — antrenman analiz uygulaması: ${shareUrl}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer')
    trackEvent('referral', 'share_whatsapp', code)
  }

  function shareTelegram() {
    const msg = encodeURIComponent(`Sporeus ile antrenmanlarını analiz et: ${shareUrl}`)
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${msg}`, '_blank', 'noopener,noreferrer')
    trackEvent('referral', 'share_telegram', code)
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>REFER A CLUB</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#888', marginBottom:12, lineHeight:1.6 }}>
        {rewardMsg}
      </div>

      {/* Referral code */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700, color:'#ff6600', letterSpacing:'0.1em' }}>
          {code}
        </span>
        <button onClick={copyCode} style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px' }}>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
        <button
          onClick={shareWhatsApp}
          aria-label="Share via WhatsApp"
          style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px', borderColor:'#25d366', color:'#25d366' }}
        >
          WhatsApp ↗
        </button>
        <button
          onClick={shareTelegram}
          aria-label="Share via Telegram"
          style={{ ...S.btnSec, fontSize:'9px', padding:'3px 10px', borderColor:'#0088cc', color:'#0088cc' }}
        >
          Telegram ↗
        </button>
      </div>

      {/* Stats */}
      {uses > 0 && (
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#5bc25b' }}>
          ✓ {uses} club{uses !== 1 ? 's' : ''} referred
          {rewards.length > 0 ? ` · ${rewards.length} reward${rewards.length > 1 ? 's' : ''} earned` : ''}
        </div>
      )}

      {/* Reward progress bar */}
      {uses > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#555', marginBottom:3 }}>
            <span>Progress to next reward</span>
            <span>{3 - nextMilestone}/3</span>
          </div>
          <div style={{ height:3, background:'#1a1a1a', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${((3 - nextMilestone) / 3) * 100}%`, background:'#ff6600', borderRadius:2, transition:'width 0.3s' }} />
          </div>
        </div>
      )}
    </div>
  )
}
