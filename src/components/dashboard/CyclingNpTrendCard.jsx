// ─── CyclingNpTrendCard.jsx — 90d best-NP-by-duration trend (Coggan/Allen) ───
//
// Surfaces `computeCyclingNpTrend` — the canonical fitness-progression signal
// per Coggan & Allen 2010: best Normalized Power held for 5/20/60-min targets
// across three sub-windows inside a rolling 90 days. A rising 20-min best NP
// is FTP rising; a flat 90d trend at constant volume signals a plateau.
//
// CPDecayCard covers Critical Power / W' bioenergetic decay. This card
// covers duration-bucketed fitness ceiling — independent signal.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeCyclingNpTrend } from '../../lib/athlete/cyclingNpTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const TREND_COLOR = {
  rising:  '#5bc25b',
  stable:  '#0064ff',
  falling: '#ff8c1a',
}
const TREND_ARROW = {
  rising:  '↑',
  stable:  '→',
  falling: '↓',
}
const TREND_LABEL_EN = {
  rising:  'rising',
  stable:  'stable',
  falling: 'falling',
}
const TREND_LABEL_TR = {
  rising:  'yükseliyor',
  stable:  'sabit',
  falling: 'düşüyor',
}

function CyclingNpTrendCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // Internal sport-gate — render nothing for non-cyclists.
  const isCyclist = useMemo(() => {
    if (parseFloat(profile?.ftp || 0) > 0) return true
    if (!Array.isArray(log)) return false
    return log.some(e => (
      /bike|cycl|ride/i.test(String(e?.type || '')) ||
      /cycl/i.test(String(e?.sport || ''))
    ))
  }, [log, profile])

  const result = useMemo(() => {
    if (!isCyclist) return null
    return computeCyclingNpTrend({ log })
  }, [isCyclist, log])

  if (!isCyclist) return null
  if (!result) return null

  const { buckets, latestBest, trend, citation } = result
  const headColor = TREND_COLOR[trend] || '#888'

  const title       = isTR ? 'NP TRENDİ · 90G' : 'NP TREND · 90D'
  const ariaLabel   = isTR ? '90 günlük en iyi NP trendi' : 'Best NP by duration over 90 days'
  const overallLbl  = isTR ? 'genel' : 'overall'
  const bestLbl     = isTR ? 'en iyi son 30g' : 'best (recent 30d)'
  const trendLabels = isTR ? TREND_LABEL_TR : TREND_LABEL_EN

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-cycling-np-trend-card
      data-overall-trend={trend}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${headColor}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
          <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div style={{ fontSize: 9, color: '#555' }}>Coggan/Allen</div>
      </div>

      {/* Headline: latest best NP + overall trend arrow */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ff6600', lineHeight: 1 }}>
            {latestBest}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#888', marginLeft: 3 }}>W</span>
          </div>
          <div style={{ fontSize: 9, color: '#888', marginTop: 3 }}>{bestLbl}</div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: headColor,
          border: `1px solid ${headColor}44`,
          padding: '2px 8px', borderRadius: 2,
          letterSpacing: '0.04em',
        }}>
          <span style={{ marginRight: 4 }}>{TREND_ARROW[trend]}</span>
          {trendLabels[trend]} · {overallLbl}
        </div>
      </div>

      {/* Bucket rows */}
      <div data-np-trend-buckets style={{ marginBottom: 8 }}>
        {buckets.map(b => {
          const c = TREND_COLOR[b.trend] || '#888'
          return (
            <div
              key={b.duration}
              data-bucket-min={b.duration}
              data-bucket-trend={b.trend}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, fontSize: 11, padding: '4px 0',
                borderBottom: '1px solid var(--border, #222)',
              }}
            >
              <span style={{ color: 'var(--muted, #888)', minWidth: 56 }}>
                {isTR ? `≥${b.duration} dk` : `≥${b.duration} min`}{/* v9.498: session NP among rides ≥ bucket, not MMP-at-duration */}
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 700, flex: 1, textAlign: 'right' }}>
                {b.bestNp}<span style={{ fontWeight: 400, color: '#888', marginLeft: 2 }}>W</span>
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: c,
                border: `1px solid ${c}44`, padding: '1px 6px', borderRadius: 2,
                letterSpacing: '0.04em',
                minWidth: 64, textAlign: 'center',
              }}>
                {TREND_ARROW[b.trend]} {trendLabels[b.trend]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Citation */}
      <div style={{ fontSize: 8, color: '#333', marginTop: 6, fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(CyclingNpTrendCard)
