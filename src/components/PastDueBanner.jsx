// ─── PastDueBanner.jsx — past_due / expired / cancelled subscription warning ──
// Shows a sticky top banner when the user's subscription needs attention.
// Dismissed per-session via sessionStorage (re-appears on next page load).
//
// Props:
//   profile     {object|null}   — from useAuth
//   lang        {string}        — 'tr' | 'en'
//   onUpgrade   {function}      — called to open UpgradeModal

import { useState } from 'react'
import { isPastDue, isCancelled, isOnTrial, daysUntilExpiry } from '../lib/subscription.js'
import { trackEvent } from '../lib/telemetry.js'

const DISMISS_KEY = 'sporeus-pastdue-dismissed'

function getBannerConfig(profile, lang) {
  const isTR = lang === 'tr'
  const days = daysUntilExpiry(profile)

  if (isPastDue(profile)) {
    return {
      bg:     'linear-gradient(90deg, #1a0000, #200a00)',
      border: '#e03030',
      color:  '#e03030',
      icon:   '⚠',
      text: isTR
        ? `Ödeme başarısız oldu. ${days > 0 ? `${days} gün` : ''} içinde güncellemezseniz hesabınız ücretsiz plana geçer.`
        : `Payment failed. Update your payment method within ${days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : 'today'} to keep your plan.`,
      cta: isTR ? 'Ödemeyi güncelle →' : 'Update payment →',
      url: 'https://sporeus.com/billing',
    }
  }

  if (isCancelled(profile)) {
    return {
      bg:     'linear-gradient(90deg, #0a0a1a, #0a100a)',
      border: '#555',
      color:  '#aaa',
      icon:   '◈',
      text: isTR
        ? `Aboneliğiniz iptal edildi. ${days > 0 ? `${days} gün` : 'Bugün'} sonra ücretsiz plana geçeceksiniz.`
        : `Subscription cancelled. Access ends in ${days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : '< 1 day'}.`,
      cta: isTR ? 'Yeniden aktifleştir →' : 'Reactivate →',
      url: null,  // opens UpgradeModal
    }
  }

  if (isOnTrial(profile)) {
    return {
      bg:     'linear-gradient(90deg, #0a0a00, #100e00)',
      border: '#ff6600',
      color:  '#ff9933',
      icon:   '◆',
      text: isTR
        ? `Ücretsiz denemeniz — ${days} gün kaldı.`
        : `Free trial — ${days} day${days !== 1 ? 's' : ''} remaining.`,
      cta: isTR ? 'Planı seç →' : 'Choose a plan →',
      url: null,  // opens UpgradeModal
    }
  }

  return null
}

export default function PastDueBanner({ profile, lang = 'tr', onUpgrade }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  const config = getBannerConfig(profile, lang)

  if (!config || dismissed) return null

  function handleCta() {
    trackEvent('upgrade', 'banner_clicked', profile?.subscription_status ?? 'unknown', { event_type: 'conversion' })
    if (config.url) {
      window.open(config.url, '_blank', 'noopener,noreferrer')
    } else if (onUpgrade) {
      onUpgrade()
    }
  }

  function handleDismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 10004,   // above status/offline banners (10001–10003), below consent (10010)
        background: config.bg,
        borderBottom: `2px solid ${config.border}`,
        color: config.color,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        padding: '9px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <span>
        <span style={{ fontWeight: 700, marginRight: '6px' }}>{config.icon}</span>
        {config.text}
      </span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={handleCta}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px', fontWeight: 700,
            padding: '5px 14px',
            background: config.border,
            border: 'none', color: '#fff',
            borderRadius: '3px', cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          {config.cta}
        </button>
        <button
          onClick={handleDismiss}
          aria-label={lang === 'tr' ? 'Kapat' : 'Dismiss'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#444', fontSize: '16px', lineHeight: 1, padding: 0,
          }}
        >×</button>
      </div>
    </div>
  )
}
