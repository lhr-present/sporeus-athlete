// src/components/dashboard/OverreachWatchCard.jsx
//
// Overreach Watch card. Surfaces the pure-fn `overreachWatch`
// (src/lib/athlete/overreachWatch.js), which cross-references two load signals
// that were previously only shown in isolation:
//   - Neuromuscular freshness (Cairns 2006 / Seiler 2010) — NMFreshnessCard
//   - Acute:Chronic Workload Ratio (Hulin 2016) — ACWRCard
//
// Renders the bilingual headline + signal chips + detail action read with a
// muted-italic citation footer. Returns null when either signal lacks enough
// data (the pure fn returns null), so the card hides instead of showing an
// empty shell. Mirrors EFDecouplingCard structure.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { overreachWatch } from '../../lib/athlete/overreachWatch.js'

// Axis → accent color. Red = back off (systemic), orange = caution
// (volume spike / hidden intensity), grey = holding / neutral.
const AXIS_COLOR = {
  systemic_overreach:    '#e03030', // both red — rest
  volume_spike:          '#ff6600', // caution — cap volume
  hidden_intensity_cost: '#f5c542', // caution — trim intensity
  holding:               '#888888', // neutral
}

// NMF classification → display label.
const NM_EN = { fresh: 'Fresh', normal: 'Normal', accumulated: 'Accumulated', overreached: 'Overreached' }
const NM_TR = { fresh: 'Taze', normal: 'Normal', accumulated: 'Birikmiş', overreached: 'Aşırı yük' }

// ACWR status → display label.
const ACWR_EN = { optimal: 'Optimal', caution: 'Caution', danger: 'Danger', undertraining: 'Undertraining' }
const ACWR_TR = { optimal: 'Optimal', caution: 'Dikkat', danger: 'Tehlike', undertraining: 'Az antrenman' }

export default function OverreachWatchCard({ log = [], lang: langProp }) {
  const ctx = useContext(LangCtx) || {}
  const lang = langProp || ctx.lang || 'en'
  const isTR = lang === 'tr'

  const result = useMemo(
    () => overreachWatch(Array.isArray(log) ? log : []),
    [log],
  )

  if (!result) return null

  const color = AXIS_COLOR[result.axis] || '#888'
  const headline = isTR ? result.headline.tr : result.headline.en
  const detail = isTR ? result.detail.tr : result.detail.en
  const title = isTR ? 'AŞIRI YÜK İZLEME' : 'OVERREACH WATCH'
  const ariaLabel = isTR
    ? 'Nöromusküler tazelik ve yük çapraz okuması'
    : 'Neuromuscular freshness and load cross-read'

  const nmLabel = (isTR ? NM_TR : NM_EN)[result.nmClass] || result.nmClass
  const acwrLabel = (isTR ? ACWR_TR : ACWR_EN)[result.acwrStatus] || result.acwrStatus

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-overreach-watch-card
      data-axis={result.axis}
      className="sp-card"
      style={{ ...S.card, animationDelay: '218ms', borderLeft: `3px solid ${color}` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          <span style={{ color, marginRight: 6 }}>◳</span>{title}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Seiler · Hulin</div>
      </div>

      {/* Headline */}
      <div style={{
        ...S.mono,
        fontSize: '13px',
        fontWeight: 700,
        color,
        lineHeight: 1.35,
        marginBottom: '8px',
      }}>
        {headline}
      </div>

      {/* Signal chips */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{
          ...S.mono, fontSize: '10px', fontWeight: 700,
          color, border: `1px solid ${color}44`, padding: '2px 6px', borderRadius: '2px',
        }}>
          {isTR ? 'Nöro' : 'Neuro'} {nmLabel}
        </span>
        <span style={{
          ...S.mono, fontSize: '10px', fontWeight: 700,
          color, border: `1px solid ${color}44`, padding: '2px 6px', borderRadius: '2px',
        }}>
          ACWR {acwrLabel} {result.acwrRatio.toFixed(2)}
        </span>
      </div>

      {/* Detail action read */}
      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--text)',
        lineHeight: 1.6,
        padding: '8px',
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: '3px',
        marginBottom: '8px',
      }}>
        {detail}
      </div>

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', fontStyle: 'italic' }}>
        Cairns S.P. 2006 / Seiler S. 2010 (neuromuscular); Hulin B.T. et al. 2016 (ACWR)
      </div>
    </div>
  )
}
