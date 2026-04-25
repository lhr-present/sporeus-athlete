// ─── VdotTrendCard.jsx — E17 VDOT Trend & PB Predictor ───────────────────────
// Visualises VDOT trajectory from race log / test history and projects 12-week PBs.
// Source: Daniels J. & Gilbert J. (1979) Oxygen Power. Tafnews Press.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { extractVdotHistory, fitVdotTrend, projectPBs } from '../../lib/race/vdotTrend.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const RED    = '#e03030'
const MUTED  = 'var(--muted, #555)'

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '--'
  const s = Math.round(seconds)
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const ss = String(s % 60).padStart(2, '0')
    return `${m}:${ss}`
  }
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${h}:${String(m).padStart(2, '0')}:${ss}`
}

export default function VdotTrendCard({ log = [], testResults = [] }) {
  const { t } = useContext(LangCtx)

  const { history, trend, pbs } = useMemo(() => {
    const history = extractVdotHistory(log, testResults)
    const trend   = fitVdotTrend(history)
    const pbs     = trend ? projectPBs(trend.currentVdot, trend) : []
    return { history, trend, pbs }
  }, [log, testResults])

  if (history.length < 2) {
    return (
      <div style={{ ...S.card, fontFamily: MONO, marginTop: '16px', padding: '14px 16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em', marginBottom: '8px' }}>
          ◈ {t('vdotTrend') || 'VDOT Trend'}
        </div>
        <div style={{ fontSize: '10px', color: MUTED }}>
          {t('vdotUnlock') || 'Log a race or timed effort to unlock VDOT trend'}
        </div>
      </div>
    )
  }

  const improving = trend.weeklyGain > 0.05
  const lowFit    = trend.rSquared < 0.3

  // SVG chart: 200×50, auto-scale y to history vdot range
  const vdots   = history.map(p => p.vdot)
  const minV    = Math.min(...vdots)
  const maxV    = Math.max(...vdots)
  const rangeV  = maxV - minV || 1

  const dates   = history.map(p => new Date(p.date).getTime())
  const minD    = Math.min(...dates)
  const maxD    = Math.max(...dates)
  const rangeD  = maxD - minD || 1

  const W = 200, H = 50, PAD = 4

  function toX(ts)   { return PAD + ((ts - minD) / rangeD) * (W - 2 * PAD) }
  function toY(vdot) { return H - PAD - ((vdot - minV) / rangeV) * (H - 2 * PAD) }

  // OLS fit line endpoints
  const firstTs  = dates[0]
  const lastTs   = dates[dates.length - 1]
  const x1 = toX(firstTs),  y1 = toY(history[0].vdot + trend.slope * 0)
  const xN = toX(lastTs),   yN = toY(history[history.length - 1].vdot)

  // Fit line uses slope in vdot/day; x is days from first point
  const firstDays = 0
  const lastDays  = (lastTs - firstTs) / 86400000
  const fitY1 = toY(trend.intercept + trend.slope * firstDays)
  const fitYN = toY(trend.intercept + trend.slope * lastDays)

  void x1; void y1; void xN; void yN  // suppress lint warnings

  const dotPoints = history.map(p => ({
    cx: toX(new Date(p.date).getTime()),
    cy: toY(p.vdot),
  }))

  return (
    <div style={{ ...S.card, fontFamily: MONO, marginTop: '16px', padding: '16px' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, letterSpacing: '0.1em' }}>
          ◈ {t('vdotTrend') || 'VDOT Trend'}
        </div>
        <div style={{
          background: ORANGE, color: '#000', fontSize: '10px', fontWeight: 700,
          padding: '2px 7px', borderRadius: '3px',
        }}>
          VDOT {trend.currentVdot.toFixed(1)}
        </div>
      </div>

      {/* ── Trend label + weekly gain ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: improving ? GREEN : MUTED }}>
          {improving ? (t('vdotImproving') || 'Improving') : (t('vdotPlateau') || 'Plateau / Declining')}
        </span>
        {trend.weeklyGain > 0 && (
          <span style={{ fontSize: '10px', color: GREEN }}>
            +{trend.weeklyGain.toFixed(2)} {t('vdotWeeklyGain') || 'pts/week'}
          </span>
        )}
      </div>

      {/* ── R² reliability note ─────────────────────────────────────────── */}
      {lowFit && (
        <div style={{ fontSize: '9px', color: MUTED, marginBottom: '6px' }}>
          Trend unreliable (R²={trend.rSquared.toFixed(2)})
        </div>
      )}

      {/* ── SVG mini chart ──────────────────────────────────────────────── */}
      <svg
        width={W} height={H}
        style={{ display: 'block', marginBottom: '14px', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* OLS fit line */}
        <line
          x1={PAD} y1={fitY1} x2={W - PAD} y2={fitYN}
          stroke={improving ? GREEN : MUTED}
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.7"
        />
        {/* Data dots + connecting line */}
        {dotPoints.length > 1 && (
          <polyline
            points={dotPoints.map(p => `${p.cx},${p.cy}`).join(' ')}
            fill="none"
            stroke={ORANGE}
            strokeWidth="1.5"
            opacity="0.8"
          />
        )}
        {dotPoints.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="3" fill={ORANGE} />
        ))}
      </svg>

      {/* ── 12-week PB projection table ─────────────────────────────────── */}
      <div style={{ fontSize: '9px', color: MUTED, letterSpacing: '0.08em', marginBottom: '6px' }}>
        {t('vdotProjection') || '12-week projection'}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #222' }}>
            <th style={{ textAlign: 'left', padding: '3px 0', color: MUTED, fontWeight: 400, fontSize: '9px', letterSpacing: '0.06em' }}>DIST</th>
            <th style={{ textAlign: 'right', padding: '3px 4px', color: MUTED, fontWeight: 400, fontSize: '9px', letterSpacing: '0.06em' }}>NOW</th>
            <th style={{ textAlign: 'right', padding: '3px 4px', color: MUTED, fontWeight: 400, fontSize: '9px', letterSpacing: '0.06em' }}>12W</th>
            <th style={{ textAlign: 'right', padding: '3px 0', color: MUTED, fontWeight: 400, fontSize: '9px', letterSpacing: '0.06em' }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {pbs.map(pb => {
            const delta = pb.deltaSeconds
            const positive = delta !== null && delta > 0
            const negative = delta !== null && delta < 0
            return (
              <tr key={pb.label} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '4px 0', color: '#ccc', fontSize: '10px' }}>{pb.label}</td>
                <td style={{ padding: '4px 4px', textAlign: 'right', color: '#aaa', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(pb.currentTime_s)}
                </td>
                <td style={{ padding: '4px 4px', textAlign: 'right', color: '#aaa', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(pb.projectedTime_s)}
                </td>
                <td style={{
                  padding: '4px 0', textAlign: 'right', fontWeight: 700,
                  fontSize: '10px', fontVariantNumeric: 'tabular-nums',
                  color: positive ? GREEN : negative ? RED : MUTED,
                }}>
                  {delta === null ? '--' : positive ? `-${formatTime(Math.abs(delta))}` : `+${formatTime(Math.abs(delta))}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Citation ────────────────────────────────────────────────────── */}
      <div style={{ fontSize: '8px', color: '#333', marginTop: '12px' }}>
        Daniels &amp; Gilbert (1979)
      </div>
    </div>
  )
}
