// ── dashboard/VDOTBenchmarkCard.jsx — E36 VDOT age/gender percentile card ─────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeVDOTBenchmark } from '../../lib/athlete/vdotBenchmark.js'

const BAR_W = 220

export default function VDOTBenchmarkCard({ log, testResults, profile }) {
  const { t, lang } = useContext(LangCtx)

  const result = computeVDOTBenchmark(log || [], testResults || [], profile || {})

  if (!result) {
    return (
      <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
        <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '8px' }}>
          ◈ {t('vdotBenchTitle')}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>
          {t('vdotBenchNeedMore')}
        </div>
      </div>
    )
  }

  const { currentVdot, ageGroup, gender, norm, tier, nextTier, citation } = result
  const { p25, p50, p75, p90 } = norm

  // ── Percentile bar geometry ────────────────────────────────────────────────
  // Bar spans from (p25 - margin) to (p90 + margin)
  const barMin  = p25 - 5
  const barMax  = p90 + 5
  const barSpan = barMax - barMin

  function xOf(v) {
    return Math.max(0, Math.min(BAR_W, ((v - barMin) / barSpan) * BAR_W))
  }

  // Segment colors for p25→p50 (below), p50→p75 (median), p75→p90 (top25), p90→end (top10)
  const segments = [
    { from: barMin, to: p50, color: '#88888844' },
    { from: p50,    to: p75, color: '#f5c54244' },
    { from: p75,    to: p90, color: '#0064ff44' },
    { from: p90,    to: barMax, color: '#5bc25b44' },
  ]

  const markerX = xOf(currentVdot)
  const tierLabel = lang === 'tr' ? tier.label_tr : tier.label_en
  const ageLabel  = ageGroup.replace('-', '–')

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      {/* Title */}
      <div style={{ ...S.mono, fontSize: '11px', fontWeight: 600, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '10px' }}>
        ◈ {t('vdotBenchTitle')}
      </div>

      {/* Current VDOT + tier badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <div>
          <div style={{ ...S.mono, fontSize: '32px', fontWeight: 700, color: tier.color, lineHeight: 1 }}>
            {Math.round(currentVdot)}
          </div>
          <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '2px', letterSpacing: '0.05em' }}>
            VDOT
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {/* Tier badge */}
          <div style={{ display: 'inline-block', ...S.mono, fontSize: '11px', fontWeight: 700, color: tier.color, border: `1px solid ${tier.color}66`, padding: '2px 8px', borderRadius: '3px', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {tierLabel}
          </div>
          {/* Context */}
          <div style={{ ...S.mono, fontSize: '10px', color: '#555' }}>
            {ageLabel} {gender} runners
          </div>
        </div>
      </div>

      {/* Percentile bar */}
      <div style={{ marginBottom: '8px', marginTop: '6px' }}>
        <svg width={BAR_W} height={24} style={{ display: 'block', overflow: 'visible' }}>
          {/* Segments */}
          {segments.map((seg, i) => {
            const x1 = xOf(seg.from)
            const x2 = xOf(seg.to)
            return (
              <rect key={i} x={x1} y={6} width={x2 - x1} height={10}
                fill={seg.color} rx={i === 0 ? 2 : 0} />
            )
          })}
          {/* Threshold tick labels */}
          {[
            { v: p25, label: `p25\n${p25}` },
            { v: p50, label: `p50\n${p50}` },
            { v: p75, label: `p75\n${p75}` },
            { v: p90, label: `p90\n${p90}` },
          ].map(({ v, label: _label }) => {
            const x = xOf(v)
            return (
              <g key={v}>
                <line x1={x} y1={4} x2={x} y2={18} stroke="#44444466" strokeWidth={1} />
              </g>
            )
          })}
          {/* Athlete marker */}
          <line x1={markerX} y1={2} x2={markerX} y2={22} stroke={tier.color} strokeWidth={2.5} />
          <circle cx={markerX} cy={11} r={4} fill={tier.color} />
        </svg>

        {/* Axis labels below bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', ...S.mono, fontSize: '8px', color: '#555', marginTop: '2px', width: `${BAR_W}px` }}>
          <span>p25 {p25}</span>
          <span>p50 {p50}</span>
          <span>p75 {p75}</span>
          <span>p90 {p90}</span>
        </div>
      </div>

      {/* Next tier callout */}
      {nextTier && (
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          +{Math.ceil(nextTier.vdotNeeded)} VDOT {t('vdotBenchNextTier')} ({nextTier.label})
        </div>
      )}

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '5px' }}>
        {citation}
      </div>
    </div>
  )
}
