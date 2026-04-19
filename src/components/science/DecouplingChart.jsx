// src/components/science/DecouplingChart.jsx
// E12 — Aerobic decoupling visualization.
// Dual-axis Recharts LineChart: left = power/speed ratio, right = heart rate.
// Midpoint vertical line separates first/second halves.
// Classification badge (coupled / mild / significant) from Friel (2009).

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import { classifyDecoupling } from '../../lib/decoupling.js'
import { useLanguage } from '../../contexts/LangCtx.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_COLOR = {
  coupled:     '#00cc44',
  mild:        '#ff6600',
  significant: '#cc0000',
}

const TIER_LABEL = {
  en: { coupled: 'Coupled', mild: 'Mild Drift', significant: 'Significant' },
  tr: { coupled: 'Bağlı',   mild: 'Hafif Kayma', significant: 'Belirgin' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Down-sample a stream to at most `maxPoints` points for display.
 * Uses every Nth sample to keep the chart readable.
 */
function downsample(arr, maxPoints = 300) {
  if (!arr || arr.length <= maxPoints) return arr
  const step = Math.ceil(arr.length / maxPoints)
  return arr.filter((_, i) => i % step === 0)
}

// ── DecouplingChart ───────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {number[]} props.hrStream      - 1-Hz HR data (bpm)
 * @param {number[]} [props.powerStream] - 1-Hz power data (W) — cycling
 * @param {number[]} [props.speedStream] - 1-Hz speed data (m/s) — running
 * @param {number}   [props.warmupSec=600] - Warmup seconds to shade
 * @param {number}   [props.decouplingPct] - Pre-computed decoupling % (optional display)
 * @param {string}   [props.height='220px']
 */
export default function DecouplingChart({
  hrStream,
  powerStream,
  speedStream,
  warmupSec = 600,
  decouplingPct,
  height = '220px',
}) {
  const { lang } = useLanguage()

  const { chartData, midpointMin, tier, sport } = useMemo(() => {
    if (!hrStream || hrStream.length === 0) {
      return { chartData: [], midpointMin: null, tier: null, sport: null }
    }

    const hasPower = Array.isArray(powerStream) && powerStream.some(p => p > 0)
    const hasSpeed = Array.isArray(speedStream) && speedStream.some(s => s > 0)
    const usedSignal = hasPower ? powerStream : hasSpeed ? speedStream : null
    const resolvedSport = hasPower ? 'cycling' : hasSpeed ? 'running' : null

    if (!usedSignal) return { chartData: [], midpointMin: null, tier: null, sport: null }

    // Trim warmup
    const rawLen   = Math.min(hrStream.length, usedSignal.length)
    const hrTrim   = hrStream.slice(warmupSec, rawLen)
    const sigTrim  = usedSignal.slice(warmupSec, rawLen)

    if (hrTrim.length === 0) return { chartData: [], midpointMin: null, tier: null, sport: null }

    // Build per-second ratio
    const ratioStream = hrTrim.map((hr, i) =>
      hr > 0 ? Math.round((sigTrim[i] / hr) * 1000) / 1000 : null
    )

    // Downsample to 300 points
    const dsHR    = downsample(hrTrim, 300)
    const dsRatio = downsample(ratioStream, 300)
    const dsLen   = dsHR.length

    const data = dsHR.map((hr, i) => ({
      min: Math.round(((i / dsLen) * hrTrim.length + warmupSec) / 60),
      hr,
      ratio: dsRatio[i],
    }))

    const midpointMin = Math.round((hrTrim.length / 2 + warmupSec) / 60)

    const resolvedTier = decouplingPct != null ? classifyDecoupling(decouplingPct) : null

    return { chartData: data, midpointMin, tier: resolvedTier, sport: resolvedSport }
  }, [hrStream, powerStream, speedStream, warmupSec, decouplingPct])

  if (chartData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
        {lang === 'tr' ? 'Ayrışma verisi yok' : 'No decoupling data'}
      </div>
    )
  }

  const tierLabel = tier ? (TIER_LABEL[lang]?.[tier] ?? TIER_LABEL.en[tier]) : null
  const tierColor = tier ? TIER_COLOR[tier] : 'var(--muted)'
  const ratioLabel = sport === 'running' ? (lang === 'tr' ? 'Hız/KAH' : 'Speed/HR') : (lang === 'tr' ? 'Güç/KAH' : 'Power/HR')

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {lang === 'tr' ? 'Aerobik Ayrışma' : 'Aerobic Decoupling'}
        </span>
        {decouplingPct != null && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: '0.88rem', color: tierColor }}>
            {decouplingPct.toFixed(1)}%
          </span>
        )}
        {tierLabel && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px',
            borderRadius: 3, background: tierColor + '22', color: tierColor,
            border: `1px solid ${tierColor}55`,
          }}>
            {tierLabel}
          </span>
        )}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

            <XAxis
              dataKey="min"
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickFormatter={v => `${v}m`}
              stroke="var(--border)"
            />

            {/* Left axis: efficiency ratio */}
            <YAxis
              yAxisId="ratio"
              orientation="left"
              tick={{ fontSize: 10, fill: '#0064ff' }}
              stroke="var(--border)"
              width={42}
              tickFormatter={v => v.toFixed(2)}
              label={{ value: ratioLabel, angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#0064ff' }, dy: 40 }}
            />

            {/* Right axis: HR */}
            <YAxis
              yAxisId="hr"
              orientation="right"
              tick={{ fontSize: 10, fill: '#cc3300' }}
              stroke="var(--border)"
              width={36}
              label={{ value: lang === 'tr' ? 'KAH' : 'HR', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: '#cc3300' }, dy: -16 }}
            />

            <Tooltip
              contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: '0.75rem' }}
              labelFormatter={v => `${v} min`}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toFixed(name === 'hr' ? 0 : 3) : value,
                name === 'hr' ? 'HR' : ratioLabel,
              ]}
            />

            <Legend
              wrapperStyle={{ fontSize: '0.72rem', color: 'var(--muted)' }}
              formatter={v => v === 'hr' ? (lang === 'tr' ? 'Kalp Atışı' : 'Heart Rate') : ratioLabel}
            />

            {/* Midpoint separator */}
            {midpointMin != null && (
              <ReferenceLine
                x={midpointMin}
                yAxisId="ratio"
                stroke="var(--muted)"
                strokeDasharray="4 2"
                label={{ value: lang === 'tr' ? 'Yarı' : 'Mid', position: 'top', style: { fontSize: 9, fill: 'var(--muted)' } }}
              />
            )}

            {/* Warmup shade — reference at warmup end */}
            <ReferenceLine
              x={Math.round(warmupSec / 60)}
              yAxisId="ratio"
              stroke="var(--muted)"
              strokeOpacity={0.4}
              label={{ value: lang === 'tr' ? 'Is.' : 'W/U', position: 'top', style: { fontSize: 9, fill: 'var(--muted)' } }}
            />

            <Line
              yAxisId="ratio"
              type="monotone"
              dataKey="ratio"
              stroke="#0064ff"
              dot={false}
              strokeWidth={1.5}
              connectNulls={false}
            />

            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke="#cc3300"
              dot={false}
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Citation */}
      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>
        Friel J. The Cyclist&rsquo;s Training Bible, 4th ed. VeloPress, 2009.
      </div>
    </div>
  )
}
