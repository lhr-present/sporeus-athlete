// src/components/dashboard/AerobicEfficiencyCard.jsx
// E20 — Aerobic Efficiency Factor Trend Card.
// Shows weekly EF history, OLS trend classification, 8-bar SVG chart.
//
// Sources:
//   Coggan A.R. (2003). Training and Racing with a Power Meter. VeloPress.
//   Allen H. & Coggan A.R. (2010). Training and Racing with a Power Meter (2nd ed.).

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeAerobicEfficiencyTrend } from '../../lib/science/aerobicEfficiency.js'

const CLASS_COLOR = {
  improving: '#5bc25b',
  stable:    '#f5c542',
  declining: '#e03030',
}

const CLASS_KEY = {
  improving: 'efImproving',
  stable:    'efStable',
  declining: 'efDeclining',
}

export default function AerobicEfficiencyCard({ log = [] }) {
  const { t } = useContext(LangCtx)

  const result = useMemo(
    () => computeAerobicEfficiencyTrend(Array.isArray(log) ? log : []),
    [log],
  )

  if (result === null) return null

  const { weeks, weeklyGain, classification, citation } = result

  const classColor = CLASS_COLOR[classification] || '#888'
  const classLabel = t(CLASS_KEY[classification]) || classification

  // Latest EF value (last week in the sorted history)
  const latestEF = weeks[weeks.length - 1]?.ef ?? null

  // Weekly gain badge text
  const gainSign  = weeklyGain >= 0 ? '+' : ''
  const gainBadge = `${gainSign}${weeklyGain.toFixed(3)}/wk`
  const gainColor = weeklyGain > 0.005 ? '#5bc25b' : weeklyGain < -0.005 ? '#e03030' : '#f5c542'

  // ── 8-bar SVG chart ────────────────────────────────────────────────────────

  const SVG_W   = 200
  const SVG_H   = 50
  const PAD_X   = 2
  const PAD_Y   = 4
  const nBars   = weeks.length
  const BAR_GAP = 2
  const BAR_W   = nBars > 0 ? Math.max(1, (SVG_W - PAD_X * 2 - BAR_GAP * (nBars - 1)) / nBars) : 1

  const efVals = weeks.map(w => w.ef)
  const minEF  = Math.min(...efVals)
  const maxEF  = Math.max(...efVals)
  const efRange = maxEF - minEF || 1
  const chartH  = SVG_H - PAD_Y * 2

  const bars = weeks.map((w, i) => {
    const x       = PAD_X + i * (BAR_W + BAR_GAP)
    const barH    = Math.max(2, ((w.ef - minEF) / efRange) * (chartH - 4) + 4)
    const y       = SVG_H - PAD_Y - barH
    return { x, y, width: BAR_W, height: barH }
  })

  return (
    <div
      className="sp-card"
      style={{ ...S.card, animationDelay: '210ms', borderLeft: `3px solid ${classColor}` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={S.cardTitle}>
          {'◈ '}{t('efTitle') || 'AEROBIC EFFICIENCY'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Coggan 2003</div>
      </div>

      {/* Latest EF + weekly gain badge */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '10px' }}>
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '36px',
            fontWeight: 700,
            color: '#ff6600',
            lineHeight: 1,
          }}>
            {latestEF !== null ? latestEF.toFixed(3) : '—'}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '3px' }}>
            EF (latest week)
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Weekly gain badge */}
          <span style={{
            ...S.mono,
            fontSize: '11px',
            fontWeight: 700,
            color: gainColor,
            border: `1px solid ${gainColor}44`,
            padding: '2px 6px',
            borderRadius: '2px',
          }}>
            {gainBadge}
          </span>
          {/* Classification badge */}
          <span style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 600,
            color: classColor,
            border: `1px solid ${classColor}44`,
            padding: '2px 6px',
            borderRadius: '2px',
          }}>
            {classLabel}
          </span>
        </div>
      </div>

      {/* 8-bar SVG chart */}
      <div style={{ marginBottom: '8px' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', overflow: 'visible' }}
          aria-label="Weekly EF bar chart"
        >
          {bars.map((b, i) => (
            <rect
              key={i}
              x={b.x.toFixed(1)}
              y={b.y.toFixed(1)}
              width={b.width.toFixed(1)}
              height={b.height.toFixed(1)}
              fill={classColor}
              opacity="0.75"
              rx="1"
            />
          ))}
          {/* Baseline */}
          <line
            x1={PAD_X}
            y1={SVG_H - PAD_Y}
            x2={SVG_W - PAD_X}
            y2={SVG_H - PAD_Y}
            stroke="#444"
            strokeWidth="0.5"
          />
        </svg>
        <div style={{ ...S.mono, fontSize: '8px', color: '#555', marginTop: '2px' }}>
          {nBars} {nBars === 1 ? 'week' : 'weeks'} · median EF/wk
        </div>
      </div>

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}
