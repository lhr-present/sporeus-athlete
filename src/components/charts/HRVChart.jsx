// ─── HRVChart.jsx — HRV daily + 7-day rolling average + baseline band ────────
import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from 'recharts'

const MONO = "'IBM Plex Mono', monospace"

function buildHRVSeries(recovery, days = 30) {
  const sorted = [...(recovery || [])]
    .filter(e => parseFloat(e.hrv) > 0)
    .sort((a, b) => a.date > b.date ? 1 : -1)
    .slice(-days)

  if (sorted.length < 3) return { data: [], baseline: null, band: null }

  const vals = sorted.map(e => parseFloat(e.hrv))
  const baseline = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)

  const data = sorted.map((e, i) => {
    const window = vals.slice(Math.max(0, i - 6), i + 1)
    const avg7   = Math.round(window.reduce((s, v) => s + v, 0) / window.length)
    return { date: e.date.slice(5), hrv: parseFloat(e.hrv), avg7 }
  })

  const std = Math.sqrt(vals.reduce((s, v) => s + (v - baseline) ** 2, 0) / vals.length)
  return { data, baseline, band: { low: Math.round(baseline - std), high: Math.round(baseline + std) } }
}

const darkTooltip = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
}

export default function HRVChart({ recovery, days = 30 }) {
  const { data, baseline, band } = useMemo(() => buildHRVSeries(recovery, days), [recovery, days])
  if (data.length < 3) return null

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', marginBottom: 4 }}>
        HRV rMSSD (ms) · baseline {baseline} · ±1σ band
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="date" tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} interval={Math.floor(data.length / 5)} />
          <YAxis tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} domain={['auto', 'auto']} />
          <Tooltip {...darkTooltip} />
          {band && <ReferenceArea y1={band.low} y2={band.high} fill="#ff660015" />}
          {baseline && <ReferenceLine y={baseline} stroke="#ff660055" strokeDasharray="4 2" />}
          <Line type="monotone" dataKey="hrv"  stroke="#ff6600" strokeWidth={1.5} dot={{ r: 2, fill: '#ff6600' }} name="HRV" isAnimationActive={false} />
          <Line type="monotone" dataKey="avg7" stroke="#0064ff" strokeWidth={2}   dot={false} name="7d avg" strokeDasharray="3 2" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
