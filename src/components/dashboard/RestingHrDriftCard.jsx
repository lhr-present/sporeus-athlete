// ─── RestingHrDriftCard.jsx — early-overreaching RHR drift warning ─────────
//
// Surfaces `detectRestingHrDrift` ONLY when the athlete's recent 3-day RHR
// has drifted >5% above their 14-day rolling baseline for ≥3 consecutive
// days — an early signal of accumulated fatigue, illness onset, or
// over-reaching. Renders nothing in the no-data / no-drift case so the
// dashboard stays quiet until there is something physiologically
// meaningful to say.
//
// Distinct from `SleepRestingHRCard` (the snapshot view of current sleep
// + RHR) — this card is the WARNING surface.
//
// Reference: Buchheit 2014; Plews & Buchheit 2017; Bouchard 1995.

import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { detectRestingHrDrift } from '../../lib/athlete/restingHrDrift.js'

const MONO = "'IBM Plex Mono', monospace"
const WARN = '#ff8a1f'  // orange — matches Bloomberg-terminal palette

function RestingHrDriftCard({ recovery }) {
  const ctx = useContext(LangCtx) || { lang: 'en' }
  const lang = ctx.lang || 'en'
  const isTR = lang === 'tr'

  const result = useMemo(
    () => detectRestingHrDrift({ recovery }),
    [recovery]
  )

  // Render nothing when no signal — no surface unless there's an actual drift.
  if (!result || !result.isDrifting) return null

  const {
    baseline,
    recent3dMean,
    deltaPct,
    consecutiveDriftDays,
    citation,
  } = result

  const title = isTR
    ? 'İSTİRAHAT KALBİ KAYIYOR'
    : 'RESTING HR DRIFTING'

  const ariaLabel = isTR
    ? 'İstirahat kalp atış hızı kayma uyarısı'
    : 'Resting heart rate drift warning'

  const baselineLabel = isTR ? 'Taban' : 'Baseline'
  const recentLabel   = isTR ? 'Son 3g ort' : 'Recent 3d mean'
  const deltaLabel    = isTR ? 'Fark' : 'Delta'
  const daysLabel     = isTR ? 'Üst üste gün' : 'Consecutive days'

  const recommendation = isTR
    ? 'Hafif günler + ekstra uyku; 3 gün sonra tekrar bak.'
    : 'Easy days + extra sleep; reassess in 3 days.'

  const ruleCode = 'RHR_DRIFT'

  const deltaStr = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-resting-hr-drift-card
      data-drifting="true"
      style={{
        background: 'var(--card-bg, #1a1a1a)',
        border: `1px solid ${WARN}66`,
        borderLeft: `3px solid ${WARN}`,
        borderRadius: 6,
        padding: 14,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #e5e5e5)',
      }}
    >
      {/* Title row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <span aria-hidden="true" style={{ color: WARN, fontSize: 14 }}>⚠</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: WARN,
          letterSpacing: '0.08em',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: 9,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          marginLeft: 'auto',
        }}>
          [{ruleCode}]
        </span>
      </div>

      {/* Metric grid */}
      <div
        data-rhr-drift-metrics
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Metric label={baselineLabel} value={`${baseline} bpm`} />
        <Metric label={recentLabel}   value={`${recent3dMean} bpm`} highlight={WARN} />
        <Metric
          label={deltaLabel}
          value={deltaStr}
          highlight={WARN}
          dataAttr="data-rhr-drift-delta"
        />
        <Metric
          label={daysLabel}
          value={String(consecutiveDriftDays)}
          highlight={WARN}
          dataAttr="data-rhr-drift-days"
        />
      </div>

      {/* Recommendation */}
      <div style={{
        fontSize: 11,
        lineHeight: 1.5,
        color: 'var(--text)',
        marginBottom: 8,
      }}>
        {recommendation}
      </div>

      {/* Citation */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        fontStyle: 'italic',
        letterSpacing: '0.04em',
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
      }}>
        {citation}
      </div>
    </div>
  )
}

function Metric({ label, value, highlight, dataAttr }) {
  const extra = dataAttr ? { [dataAttr]: '' } : {}
  return (
    <div {...extra}>
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        letterSpacing: '0.06em',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        color: highlight || 'var(--text)',
        letterSpacing: '0.03em',
      }}>
        {value}
      </div>
    </div>
  )
}

export default memo(RestingHrDriftCard)
