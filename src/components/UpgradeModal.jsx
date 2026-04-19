// ─── UpgradeModal.jsx — Pricing comparison + checkout CTA ─────────────────────
// Shows when a user hits a feature gate or clicks "Upgrade".
// TRY pricing via Dodo (lang=tr), EUR/USD via Stripe (lang=en / international).
// 14-day free trial for Coach tier (no credit card required for Dodo).
//
// Props:
//   open        {boolean}          — visibility
//   onClose     {function}         — called to close
//   featureKey  {string|null}      — gate that triggered (shows feature-specific copy)
//   lang        {string}           — 'tr' | 'en' — selects currency + payment provider
//   currentTier {string}           — 'free' | 'coach' | 'club'

import { useEffect, useRef } from 'react'
import { getCheckoutUrl, getUpgradePrompt } from '../lib/subscription.js'
import { trackEvent, trackFunnel } from '../lib/telemetry.js'
import { S } from '../styles.js'

// ── Pricing data ──────────────────────────────────────────────────────────────
const PRICING = {
  tr: {
    coach: { price: '₺299', period: '/ay', trial: '14 gün ücretsiz', currency: 'TRY' },
    club:  { price: '₺899', period: '/ay', trial: null,              currency: 'TRY' },
  },
  en: {
    coach: { price: '€9',  period: '/mo', trial: '14-day free trial', currency: 'EUR' },
    club:  { price: '€27', period: '/mo', trial: null,                currency: 'EUR' },
  },
}

// ── Feature comparison rows ──────────────────────────────────────────────────
const FEATURES = [
  { label: { tr: 'Sporcu profilleri',   en: 'Athlete profiles'    }, free: '1',        coach: '15',        club: 'Sınırsız / Unlimited' },
  { label: { tr: 'AI analiz (aylık)',   en: 'AI insights / month' }, free: '—',        coach: '50',        club: '500'         },
  { label: { tr: 'Dosya yükleme',       en: 'File uploads'        }, free: '5/ay',     coach: 'Sınırsız',  club: 'Sınırsız'    },
  { label: { tr: 'Canlı kadro ekranı',  en: 'Live squad feed'     }, free: '—',        coach: '✓',         club: '✓'           },
  { label: { tr: 'Semantik arama',      en: 'Semantic AI search'  }, free: '—',        coach: '✓',         club: '✓'           },
  { label: { tr: 'PDF raporlar',        en: 'PDF reports'         }, free: '—',        coach: '✓',         club: '✓'           },
  { label: { tr: 'Takım yönetimi',      en: 'Multi-team mgmt'     }, free: '—',        coach: '1 takım',   club: '10 takım'    },
  { label: { tr: 'API erişimi',         en: 'API access'          }, free: '—',        coach: '—',         club: '✓'           },
  { label: { tr: 'Beyaz etiket',        en: 'White-label'         }, free: '—',        coach: '—',         club: '✓'           },
]

const TIER_COLS = ['free', 'coach', 'club']
const TIER_LABELS = { tr: { free: 'ÜCRETSİZ', coach: 'COACH', club: 'KULÜP' },
                      en: { free: 'FREE',      coach: 'COACH', club: 'CLUB'  } }

export default function UpgradeModal({ open, onClose, featureKey = null, lang = 'tr', currentTier = 'free' }) {
  const overlayRef = useRef(null)
  const pricing = PRICING[lang] || PRICING.en
  const tierLabels = TIER_LABELS[lang] || TIER_LABELS.en

  // Fire gate_shown telemetry on open
  useEffect(() => {
    if (open && featureKey) {
      trackEvent('upgrade', 'gate_shown', featureKey, { event_type: 'conversion' })
    }
  }, [open, featureKey])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleCheckout(tier) {
    const url = getCheckoutUrl(tier, lang)
    trackEvent('upgrade', 'checkout_started', tier, { event_type: 'conversion' })
    trackFunnel('tier_upgrade')
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback if env var not configured
      window.open('https://sporeus.com/pricing', '_blank', 'noopener,noreferrer')
    }
  }

  const gateMsg = featureKey ? getUpgradePrompt(featureKey) : null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10200 }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'tr' ? 'Plan yükselt' : 'Upgrade plan'}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, 95vw)', maxHeight: '90vh', overflowY: 'auto',
          zIndex: 10201,
          background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '10px',
          boxShadow: '0 32px 96px rgba(0,0,0,0.95)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.14em', marginBottom: '6px' }}>
              {lang === 'tr' ? 'SPOREUS PLANLAR' : 'SPOREUS PLANS'}
            </div>
            {gateMsg && (
              <div style={{ fontSize: '11px', color: '#888', maxWidth: '480px', lineHeight: 1.6 }}>
                {gateMsg}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'tr' ? 'Kapat' : 'Close'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '20px', lineHeight: 1, padding: '0 0 0 16px', flexShrink: 0 }}
          >×</button>
        </div>

        {/* Pricing cards */}
        <div style={{ display: 'flex', gap: '12px', padding: '20px 24px', flexWrap: 'wrap' }}>
          {['coach', 'club'].map(tier => {
            const p = pricing[tier]
            const isCurrentTier = currentTier === tier
            const isCoach = tier === 'coach'
            return (
              <div
                key={tier}
                style={{
                  flex: '1 1 200px',
                  border: isCoach ? '1px solid #ff6600' : '1px solid #2a2a2a',
                  borderRadius: '8px',
                  padding: '16px',
                  background: isCoach ? '#0f0a00' : '#0a0a0a',
                  position: 'relative',
                }}
              >
                {isCoach && p.trial && (
                  <div style={{
                    position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                    background: '#ff6600', color: '#fff', fontSize: '9px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '10px', letterSpacing: '0.1em', whiteSpace: 'nowrap',
                  }}>
                    {lang === 'tr' ? '14 GÜN ÜCRETSİZ' : '14-DAY FREE TRIAL'}
                  </div>
                )}
                <div style={{ fontSize: '10px', fontWeight: 700, color: isCoach ? '#ff6600' : '#0064ff', letterSpacing: '0.12em', marginBottom: '8px' }}>
                  {tierLabels[tier]}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: '#e5e5e5' }}>{p.price}</span>
                  <span style={{ fontSize: '10px', color: '#555' }}>{p.period}</span>
                </div>
                {isCurrentTier ? (
                  <div style={{ fontSize: '10px', color: '#5bc25b', marginTop: '12px', fontWeight: 600 }}>
                    {lang === 'tr' ? '✓ Mevcut planın' : '✓ Current plan'}
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(tier)}
                    style={{
                      ...S.btn,
                      width: '100%',
                      marginTop: '12px',
                      fontSize: '10px',
                      padding: '8px',
                      background: isCoach ? '#ff6600' : '#0064ff',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {isCoach && p.trial
                      ? (lang === 'tr' ? 'ÜCRETSİZ DENE →' : 'START FREE TRIAL →')
                      : (lang === 'tr' ? 'YÜKSELT →' : 'UPGRADE →')
                    }
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ padding: '0 24px 24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#444', fontWeight: 400, width: '40%' }}>
                  {lang === 'tr' ? 'ÖZELLİK' : 'FEATURE'}
                </th>
                {TIER_COLS.map(t => (
                  <th key={t} style={{
                    padding: '6px 8px', textAlign: 'center',
                    color: t === 'free' ? '#444' : t === 'coach' ? '#ff6600' : '#0064ff',
                    fontWeight: 700, fontSize: '9px', letterSpacing: '0.1em',
                    borderBottom: t === 'coach' ? '1px solid #ff660044' : '1px solid #1a1a1a',
                  }}>
                    {tierLabels[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid #111' }}>
                  <td style={{ padding: '6px 8px', color: '#888' }}>
                    {row.label[lang] || row.label.en}
                  </td>
                  {TIER_COLS.map(t => (
                    <td key={t} style={{
                      padding: '6px 8px', textAlign: 'center',
                      color: row[t] === '✓' ? '#5bc25b' : row[t] === '—' ? '#333' : '#aaa',
                      background: t === 'coach' ? '#0f0a0008' : 'transparent',
                    }}>
                      {row[t]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '16px', fontSize: '9px', color: '#333', lineHeight: 1.7 }}>
            {lang === 'tr'
              ? '· Coach planı Dodo ile TRY olarak ödenir. Uluslararası kullanıcılar EUR/USD ile ödeyebilir.\n· 14 günlük deneme süresi sonunda otomatik faturalandırma başlar.\n· Her ay yenilenir — dilediğinizde iptal edebilirsiniz.'
              : '· Coach plan billed in TRY via Dodo for Turkey. International users billed in EUR/USD via Stripe.\n· After 14-day trial, billing starts automatically. Cancel anytime.'
            }
          </div>
        </div>
      </div>
    </>
  )
}
