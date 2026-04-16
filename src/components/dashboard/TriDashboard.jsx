// ─── dashboard/TriDashboard.jsx — Dual CTL chart for triathletes ───────────────
// Shows three PMC lines: swim CTL (teal), bike/run CTL (blue), combined load (grey).
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { dualBanister, splitDisciplineLogs } from '../../lib/sport/simulation.js'
import ErrorBoundary from '../ErrorBoundary.jsx'

const MONO  = "'IBM Plex Mono', monospace"
const TEAL  = '#00c8b8'
const BLUE  = '#0064ff'
const _GREY = '#555' // reserved for future grid lines
const GREEN = '#5bc25b'
const AMBER = '#f5c542'

function MiniCTLChart({ data }) {
  if (!data || data.length < 2) return null

  const W = 100, H = 40
  const swimMax    = Math.max(...data.map(d => d.swimCTL), 1)
  const bikeRunMax = Math.max(...data.map(d => d.bikeRunCTL), 1)
  const yMax       = Math.max(swimMax, bikeRunMax, 1)

  const toX = i => (i / (data.length - 1)) * W
  const toY = v => H - (v / yMax) * H

  const pathFor = (key, color) => {
    const pts = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' ')
    return <path key={key} d={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {pathFor('swimCTL', TEAL)}
      {pathFor('bikeRunCTL', BLUE)}
    </svg>
  )
}

/**
 * TriDashboard — dual CTL card for triathlete dashboard.
 * @param {object} props
 * @param {Array}  props.log  — full training log
 * @param {string} [props.lang='en']
 */
export default function TriDashboard({ log, lang = 'en' }) {
  const { swimLog, bikeRunLog } = useMemo(() => splitDisciplineLogs(log || []), [log])

  // Build dual Banister trace for last 90 days
  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })()
  const swimSlice    = swimLog.filter(e => e.date >= cutoff)
  const bikeRunSlice = bikeRunLog.filter(e => e.date >= cutoff)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- length proxy avoids reference churn on identical slices
  const trace = useMemo(() => dualBanister(swimSlice, bikeRunSlice), [swimSlice.length, bikeRunSlice.length])

  if (!log || log.length < 7) return null

  const hasSwim    = swimLog.length > 0
  const hasBikeRun = bikeRunLog.length > 0
  if (!hasSwim && !hasBikeRun) return null

  if (!trace.length) return null

  const last = trace[trace.length - 1]
  const isTR = lang === 'tr'

  const statBadge = (label, val, color) => (
    <div style={{ flex: '1 1 80px', textAlign: 'center', padding: '8px', background: 'var(--card-bg)', borderRadius: '4px', border: `1px solid ${color}22` }}>
      <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, color }}>{val}</div>
      <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</div>
    </div>
  )

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '205ms' }}>
      <div style={S.cardTitle}>{isTR ? 'TRİATLON YÜKÜ — İKİ KANAL' : 'TRIATHLON LOAD — DUAL CHANNEL'}</div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: TEAL }}>◼ {isTR ? 'Yüzme' : 'Swim'} CTL</span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: BLUE }}>◼ {isTR ? 'Bisiklet + Koşu' : 'Bike + Run'} CTL</span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#444' }}>
          τ2(swim)=5d · τ2(bike/run)=7d · Mujika 2000
        </span>
      </div>

      {/* Dual CTL chart */}
      <ErrorBoundary inline name="TriCTL Chart">
        <MiniCTLChart data={trace} />
      </ErrorBoundary>

      {/* Current values */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        {statBadge(isTR ? 'Yüzme CTL' : 'Swim CTL',       Math.round(last.swimCTL),    TEAL)}
        {statBadge(isTR ? 'Yüzme TSB' : 'Swim Form',      `${last.swimTSB > 0 ? '+' : ''}${Math.round(last.swimTSB)}`, last.swimTSB >= -5 ? GREEN : AMBER)}
        {statBadge(isTR ? 'Bisik+Koşu CTL' : 'B+R CTL',  Math.round(last.bikeRunCTL), BLUE)}
        {statBadge(isTR ? 'Bisik+Koşu TSB' : 'B+R Form',  `${last.bikeRunTSB > 0 ? '+' : ''}${Math.round(last.bikeRunTSB)}`, last.bikeRunTSB >= -5 ? GREEN : AMBER)}
      </div>

      {/* Swim/bike+run session split */}
      <div style={{ fontFamily: MONO, fontSize: '9px', color: '#444', marginTop: '10px' }}>
        {isTR
          ? `Yüzme: ${swimLog.length} seans · Bisiklet+Koşu: ${bikeRunLog.length} seans`
          : `Swim: ${swimLog.length} sessions · Bike+Run: ${bikeRunLog.length} sessions`}
      </div>
    </div>
  )
}
