// ─── CTLChart.jsx — CTL / ATL / TSB timeline with Recharts ──────────────────
import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, ReferenceLine, ResponsiveContainer } from 'recharts'

const MONO = "'IBM Plex Mono', monospace"

function buildTimeSeries(log, days = 90) {
  const sorted = [...(log || [])].sort((a, b) => a.date > b.date ? 1 : -1)
  if (!sorted.length) return []

  const end   = new Date()
  const start = new Date(end); start.setDate(start.getDate() - days)

  let ctl = 0, atl = 0
  // Prime CTL/ATL from data before window
  for (const e of sorted) {
    if (new Date(e.date) >= start) break
    const tss = e.tss || 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }

  const points = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const dayTss  = sorted.filter(e => e.date === dateStr).reduce((s, e) => s + (e.tss || 0), 0)
    ctl = ctl + (dayTss - ctl) / 42
    atl = atl + (dayTss - atl) / 7
    points.push({
      date: dateStr.slice(5),   // MM-DD
      CTL:  Math.round(ctl),
      ATL:  Math.round(atl),
      TSB:  Math.round(ctl - atl),
    })
  }
  return points
}

const darkTooltip = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
  itemStyle:    { color: '#ccc' },
}

export default function CTLChart({ log, days = 90 }) {
  const data = useMemo(() => buildTimeSeries(log, days), [log, days])
  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
        <XAxis dataKey="date" tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} interval={Math.floor(data.length / 6)} />
        <YAxis tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} />
        <Tooltip {...darkTooltip} />
        <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 9, color: '#888' }} />
        <ReferenceLine y={0} stroke="#333" />
        <Line type="monotone" dataKey="CTL" stroke="#ff6600" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="ATL" stroke="#0064ff" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="TSB" stroke="#5bc25b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Brush dataKey="date" height={16} stroke="#333" fill="#0a0a0a" travellerWidth={6}
          style={{ fontFamily: MONO, fontSize: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
