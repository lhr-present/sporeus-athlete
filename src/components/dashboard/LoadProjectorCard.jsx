// ─── LoadProjectorCard.jsx — E34: 4-Week CTL/TSB forward projection ───────────
// Dual SVG line chart: baseline (current load) vs elevated (+10% load)
// CTL line solid #0064ff, elevated CTL dashed, TSB dotted color-by-zone.
// Reference: Banister 1991 · Coggan PMC
import { useContext, useMemo } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeLoadProjection } from '../../lib/athlete/loadProjector.js'

// TSB zone coloring matching spec
function tsbColor(tsb) {
  if (tsb > 10)  return '#5bc25b'
  if (tsb < -10) return '#e03030'
  return '#f5c542'
}

function tsbZoneLabel(tsb, t) {
  if (tsb > 10)  return t('loadProjFresh')
  if (tsb < -10) return t('loadProjFatigued')
  return t('loadProjNeutral')
}

export default function LoadProjectorCard({ log }) {
  const { t, lang } = useContext(LangCtx)

  const proj = useMemo(
    () => computeLoadProjection(log ?? []),
    [log]
  )

  if (!proj) return null

  const { baseline, elevated, currentCTL, currentTSB, citation } = proj

  const title = lang === 'tr' ? t('loadProjTitle') : t('loadProjTitle')

  // ── SVG chart dimensions ──────────────────────────────────────────────────
  const W = 260, H = 60, padL = 4, padR = 4, padT = 4, padB = 20
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = baseline.length  // 28

  // Determine scale: use CTL values from both series + TSB
  const allCTL = [...baseline.map(p => p.ctl), ...elevated.map(p => p.ctl)]
  const allTSB = baseline.map(p => p.tsb)
  const allVals = [...allCTL, ...allTSB]
  const minY = Math.min(...allVals)
  const maxY = Math.max(...allVals)
  const rangeY = maxY - minY || 1

  const xPos = i => padL + (i / (n - 1)) * chartW
  const yPos = v => padT + (1 - (v - minY) / rangeY) * chartH

  // CTL polyline (baseline — solid)
  const ctlBasePts = baseline.map((p, i) => `${xPos(i)},${yPos(p.ctl)}`).join(' ')

  // CTL polyline (elevated — dashed)
  const ctlElevPts = elevated.map((p, i) => `${xPos(i)},${yPos(p.ctl)}`).join(' ')

  // TSB segments (colored by zone, dotted)
  // Build segments of same color
  const tsbSegments = []
  let segStart = 0
  for (let i = 1; i <= n; i++) {
    const prevColor = tsbColor(baseline[i - 1].tsb)
    const currColor = i < n ? tsbColor(baseline[i].tsb) : null
    if (currColor !== prevColor || i === n) {
      const pts = baseline.slice(segStart, i).map((p, j) => `${xPos(segStart + j)},${yPos(p.tsb)}`).join(' ')
      tsbSegments.push({ pts, color: prevColor })
      segStart = i - 1  // overlap by 1 to avoid gaps
    }
  }

  // Week gridline X positions (days 7, 14, 21, 28 → index 6, 13, 20, 27)
  const weekIdxs = [6, 13, 20, 27]
  const weekLabels = ['W1', 'W2', 'W3', 'W4']

  // Footer values
  const baselineCTL28 = Math.round(baseline[27].ctl)
  const elevatedCTL28 = Math.round(elevated[27].ctl)

  // Current TSB badge
  const tsbBadgeColor = tsbColor(currentTSB)
  const tsbLabel = tsbZoneLabel(currentTSB, t)

  return (
    <div className="sp-card" style={S.card}>
      {/* Title */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#ff6600',
        marginBottom: '10px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '8px',
      }}>
        ◈ {title}
      </div>

      {/* Current state row: CTL + TSB badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#888' }}>
          CTL{' '}
          <span style={{ fontWeight: 700, color: '#ff6600', fontSize: '14px' }}>{currentCTL}</span>
        </div>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '9px',
          fontWeight: 700,
          color: tsbBadgeColor,
          border: `1px solid ${tsbBadgeColor}44`,
          padding: '2px 6px',
          borderRadius: '2px',
          letterSpacing: '0.08em',
        }}>
          TSB {currentTSB >= 0 ? '+' : ''}{currentTSB} · {tsbLabel}
        </span>
      </div>

      {/* Dual SVG Line Chart */}
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
          {/* Week gridlines */}
          {weekIdxs.map((idx, wi) => (
            <line
              key={wi}
              x1={xPos(idx)} y1={padT}
              x2={xPos(idx)} y2={padT + chartH}
              stroke="var(--border)"
              strokeWidth="0.5"
            />
          ))}

          {/* Elevated CTL line (dashed, thinner) */}
          <polyline
            points={ctlElevPts}
            fill="none"
            stroke="#0064ff"
            strokeWidth="1"
            strokeDasharray="4 2"
            strokeLinejoin="round"
            opacity={0.5}
          />

          {/* Baseline CTL line (solid) */}
          <polyline
            points={ctlBasePts}
            fill="none"
            stroke="#0064ff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* TSB dotted colored segments */}
          {tsbSegments.map((seg, si) => (
            <polyline
              key={si}
              points={seg.pts}
              fill="none"
              stroke={seg.color}
              strokeWidth="1.2"
              strokeDasharray="2 2"
              strokeLinejoin="round"
            />
          ))}

          {/* Week labels */}
          {weekIdxs.map((idx, wi) => (
            <text
              key={wi}
              x={xPos(idx)}
              y={H - 3}
              textAnchor="middle"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', fill: '#555' }}
            >
              {weekLabels[wi]}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#0064ff" strokeWidth="1.5"/></svg>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: '#888' }}>CTL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#0064ff" strokeWidth="1" strokeDasharray="4 2" opacity={0.5}/></svg>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: '#888' }}>CTL +10%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#f5c542" strokeWidth="1.2" strokeDasharray="2 2"/></svg>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: '#888' }}>TSB</span>
        </div>
      </div>

      {/* Footer: projected CTL at day 28 */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '10px',
        color: '#888',
        marginBottom: '6px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'baseline',
      }}>
        <span>{t('loadProjIn4w')}:</span>
        <span style={{ fontWeight: 700, color: '#0064ff' }}>CTL {baselineCTL28}</span>
        <span>→</span>
        <span style={{ fontWeight: 700, color: '#0064ff' }}>{elevatedCTL28}</span>
        <span style={{ fontSize: '8px', color: '#555' }}>{t('loadProjAt10')}</span>
      </div>

      {/* Citation */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '8px',
        color: '#333',
        marginTop: '4px',
      }}>
        {citation}
      </div>
    </div>
  )
}
