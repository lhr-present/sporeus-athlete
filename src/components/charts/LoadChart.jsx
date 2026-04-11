// ─── LoadChart.jsx — Weekly TSS bar chart with trend coloring ─────────────────
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, ResponsiveContainer } from 'recharts'

const MONO = "'IBM Plex Mono', monospace"

function buildWeeklyLoad(log, weeks = 10) {
  const data = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end   = new Date(); end.setDate(end.getDate() - w * 7)
    const start = new Date(end); start.setDate(start.getDate() - 6)
    const s = start.toISOString().slice(0, 10)
    const e = end.toISOString().slice(0, 10)
    const tss = log.filter(r => r.date >= s && r.date <= e).reduce((sum, r) => sum + (r.tss || 0), 0)
    data.push({ week: `W-${w === 0 ? 'now' : w}`, tss })
  }
  // Color by trend vs previous week
  return data.map((d, i) => {
    const prev = i > 0 ? data[i-1].tss : d.tss
    const ratio = prev > 0 ? d.tss / prev : 1
    const color = ratio > 1.3 ? '#e03030' : ratio > 1.1 ? '#f5c542' : '#5bc25b'
    return { ...d, color }
  })
}

const darkTooltip = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
}

export default function LoadChart({ log, weeks = 10 }) {
  const data = useMemo(() => buildWeeklyLoad(log, weeks), [log, weeks])
  const avg  = data.length ? Math.round(data.reduce((s, d) => s + d.tss, 0) / data.length) : 0
  if (!data.length) return null

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', marginBottom: 4 }}>
        WEEKLY LOAD (TSS) · {weeks}W avg {avg}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis dataKey="week" tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} />
          <YAxis tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} />
          <Tooltip {...darkTooltip} formatter={v => [v, 'TSS']} />
          <ReferenceLine y={avg} stroke="#444" strokeDasharray="4 2" label={{ value: 'avg', position: 'right', fill: '#555', fontFamily: MONO, fontSize: 8 }} />
          <Bar dataKey="tss" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
