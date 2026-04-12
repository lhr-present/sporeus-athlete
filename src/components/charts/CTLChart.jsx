// ─── CTLChart.jsx — Full Performance Management Chart (PMC) ─────────────────
// CTL (fitness) · ATL (fatigue) · TSB (form) · TSS bars
// Sweet-spot zones · Race-day markers
import { useMemo } from 'react'
import {
  ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { calculatePMC } from '../../lib/trainingLoad.js'

const MONO = "'IBM Plex Mono', monospace"

// ── Phase shading ──────────────────────────────────────────────────────────────
const PHASE_COLORS = {
  base:        '#5bc25b',
  build:       '#ff6600',
  peak:        '#e03030',
  taper:       '#0064ff',
  competition: '#cc44ff',
  transition:  '#888888',
}

// Returns [{x1, x2, phase}] in 'MM-DD' format for each plan week visible in the chart window.
function getPhaseBands(plan, days) {
  if (!plan?.weeks?.length || !plan?.generatedAt) return []

  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - days)

  // Advance generatedAt to the nearest Monday
  const gen = new Date(plan.generatedAt); gen.setHours(0, 0, 0, 0)
  gen.setDate(gen.getDate() + (8 - gen.getDay()) % 7)

  const bands = []
  for (let wi = 0; wi < plan.weeks.length; wi++) {
    const wStart = new Date(gen); wStart.setDate(wStart.getDate() + wi * 7)
    const wEnd   = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6)
    if (wEnd < cutoff || wStart > today) continue
    const x1    = (wStart < cutoff ? cutoff : wStart).toISOString().slice(5, 10)
    const x2    = (wEnd   > today  ? today  : wEnd).toISOString().slice(5, 10)
    const phase = (plan.weeks[wi].phase || 'base').toLowerCase()
    bands.push({ x1, x2, phase })
  }
  return bands
}

const darkTooltip = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
  itemStyle:    { color: '#ccc' },
}

// Format YYYY-MM-DD → MM-DD for axis labels
const mmdd = str => str ? str.slice(5) : ''

export default function CTLChart({ log, days = 90, raceResults = [], plan = null }) {
  const data = useMemo(() => {
    const series = calculatePMC(log || [], days, 0)
    return series.map(p => ({
      date:        mmdd(p.date),
      fullDate:    p.date,
      tss:         p.tss,
      CTL:         p.ctl,
      ATL:         p.atl,
      // Split TSB into positive / negative for two-color rendering
      tsbPos:      p.tsb >= 0 ? p.tsb : null,
      tsbNeg:      p.tsb <  0 ? p.tsb : null,
      isFuture:    p.isFuture,
    }))
  }, [log, days])

  if (!data.length) return null

  // Race markers that fall within the display window
  const raceMarkers = useMemo(() => {
    if (!raceResults?.length) return []
    const dates = new Set(data.map(p => p.fullDate))
    return raceResults
      .map(r => r.raceDate || r.date)
      .filter(d => d && dates.has(d))
      .map(d => mmdd(d))
  }, [raceResults, data])

  const phaseBands = useMemo(() => getPhaseBands(plan, days), [plan, days])
  const interval = Math.max(1, Math.floor(data.length / 6))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 32, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" />

        {/* Periodization phase shading — from YearlyPlan if available */}
        {phaseBands.map((b, i) => (
          <ReferenceArea key={`phase-${i}`} x1={b.x1} x2={b.x2} yAxisId="left"
            fill={PHASE_COLORS[b.phase] || '#888'} fillOpacity={0.10}
            label={{ value: b.phase.toUpperCase(), position: 'insideTopRight',
                     fill: (PHASE_COLORS[b.phase] || '#888') + '99', fontSize: 7, fontFamily: MONO }}
          />
        ))}

        {/* Sweet-spot zones on the TSB / CTL scale (left axis) */}
        <ReferenceArea
          y1={-30} y2={-10} yAxisId="left"
          fill="#ff6600" fillOpacity={0.06}
          label={{ value: 'BUILD', position: 'insideTopLeft', fill: '#ff660055', fontSize: 8, fontFamily: MONO }}
        />
        <ReferenceArea
          y1={10} y2={25} yAxisId="left"
          fill="#5bc25b" fillOpacity={0.08}
          label={{ value: 'RACE', position: 'insideBottomLeft', fill: '#5bc25b66', fontSize: 8, fontFamily: MONO }}
        />

        {/* Race-day vertical markers */}
        {raceMarkers.map(d => (
          <ReferenceLine
            key={d} x={d} yAxisId="left"
            stroke="#ff6600" strokeWidth={1.5} strokeDasharray="3 2"
            label={{ value: '🏁', position: 'top', fontSize: 11 }}
          />
        ))}

        <XAxis
          dataKey="date"
          tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }}
          interval={interval}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontFamily: MONO, fontSize: 9, fill: '#333' }}
          tickFormatter={v => v > 0 ? v : ''}
        />

        <Tooltip
          {...darkTooltip}
          formatter={(v, name) => {
            if (v === null || v === undefined) return [null, name]
            if (name === 'TSS') return [v, 'TSS']
            if (name === 'tsbPos') return [`+${v}`, 'TSB']
            if (name === 'tsbNeg') return [v, 'TSB']
            return [v, name]
          }}
        />
        <Legend
          wrapperStyle={{ fontFamily: MONO, fontSize: 9, color: '#888' }}
          formatter={name => name === 'tsbPos' || name === 'tsbNeg' ? 'TSB' : name}
        />

        {/* TSS daily bars — right axis, gray */}
        <Bar
          dataKey="tss" name="TSS" yAxisId="right"
          fill="#444" fillOpacity={0.5} barSize={2}
          isAnimationActive={false}
        />

        {/* CTL — orange */}
        <Line
          type="monotone" dataKey="CTL" yAxisId="left"
          stroke="#ff6600" strokeWidth={2} dot={false}
          isAnimationActive={false}
        />
        {/* ATL — blue */}
        <Line
          type="monotone" dataKey="ATL" yAxisId="left"
          stroke="#0064ff" strokeWidth={2} dot={false}
          isAnimationActive={false}
        />
        {/* TSB positive (fresh) — green */}
        <Line
          type="monotone" dataKey="tsbPos" name="tsbPos" yAxisId="left"
          stroke="#5bc25b" strokeWidth={1.5} dot={false}
          strokeDasharray="4 2" connectNulls={false}
          isAnimationActive={false}
        />
        {/* TSB negative (fatigued) — red */}
        <Line
          type="monotone" dataKey="tsbNeg" name="tsbNeg" yAxisId="left"
          stroke="#e03030" strokeWidth={1.5} dot={false}
          strokeDasharray="4 2" connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
