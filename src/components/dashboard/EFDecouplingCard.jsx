// src/components/dashboard/EFDecouplingCard.jsx
//
// EF × Decoupling mismatch card. Surfaces the pure-fn `efDecouplingMismatch`
// (src/lib/athlete/efDecouplingMismatch.js), which cross-references two mature
// aerobic trend signals that were previously only shown in isolation:
//   - Aerobic Efficiency Factor trend (Coggan 2003) — AerobicEfficiencyCard
//   - Aerobic decoupling / Pw:Hr drift trend (Friel) — AerobicDecouplingTrendCard
//
// Renders the bilingual headline + detail action read with a muted-italic
// citation footer. Returns null when either signal lacks enough data (the
// pure fn returns null), so the card hides instead of showing an empty shell.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { efDecouplingMismatch } from '../../lib/athlete/efDecouplingMismatch.js'

// Quadrant → accent color. Green = good (base consolidating), orange = caution
// (drifting), red = back off, grey = no signal.
const QUADRANT_COLOR = {
  improving_rising: '#ff6600', // engine up but drifting — caution
  improving_flat:   '#5bc25b', // consolidating — good
  flat_rising:      '#e03030', // stalled + worsening — back off
  flat_flat:        '#888888', // holding steady — neutral
}

function EFDecouplingCard({ log = [], lang: langProp }) {
  const ctx = useContext(LangCtx) || {}
  const lang = langProp || ctx.lang || 'en'
  const t = ctx.t
  const isTR = lang === 'tr'

  const result = useMemo(
    () => efDecouplingMismatch(Array.isArray(log) ? log : []),
    [log],
  )

  if (!result) return null

  const color = QUADRANT_COLOR[result.quadrant] || '#888'
  const headline = isTR ? result.headline.tr : result.headline.en
  const detail = isTR ? result.detail.tr : result.detail.en
  const title = (t && t('efDecoupleTitle')) || (isTR ? 'EF × KAYMA' : 'EF × DECOUPLING')
  const ariaLabel = isTR ? 'EF ve aerobik kayma çapraz okuması' : 'EF and aerobic decoupling cross-read'

  const efPct = (result.weeklyGain >= 0 ? '+' : '') + result.weeklyGain.toFixed(3)
  const dcPct = result.avgDecouplePct.toFixed(1)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-ef-decoupling-card
      data-quadrant={result.quadrant}
      className="sp-card"
      style={{ ...S.card, animationDelay: '215ms', borderLeft: `3px solid ${color}` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          <span style={{ color, marginRight: 6 }}>◧</span>{title}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Coggan 2003 · Friel</div>
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
          EF {efPct}/wk
        </span>
        <span style={{
          ...S.mono, fontSize: '10px', fontWeight: 700,
          color, border: `1px solid ${color}44`, padding: '2px 6px', borderRadius: '2px',
        }}>
          {isTR ? 'Kayma' : 'Drift'} {dcPct}%
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
        Coggan A.R. 2003 (Efficiency Factor); Friel J. 2014 (Pw:Hr decoupling)
      </div>
    </div>
  )
}

export default memo(EFDecouplingCard)
