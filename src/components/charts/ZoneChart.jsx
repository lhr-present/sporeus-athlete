// ─── ZoneChart.jsx — Weekly zone distribution stacked bar ────────────────────
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MONO   = "'IBM Plex Mono', monospace"
const COLORS = ['#4a90d9', '#5bc25b', '#f5c542', '#ff6600', '#e03030']

function buildWeeklyZones(log, weeks = 8) {
  const result = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end   = new Date(); end.setDate(end.getDate() - w * 7)
    const start = new Date(end); start.setDate(start.getDate() - 6)
    const s = start.toISOString().slice(0, 10)
    const e = end.toISOString().slice(0, 10)
    const week = log.filter(r => r.date >= s && r.date <= e)
    const zones = [0, 0, 0, 0, 0]
    let total = 0
    for (const session of week) {
      if (session.zones?.length === 5) {
        session.zones.forEach((min, i) => { zones[i] += min; total += min })
      } else {
        // Estimate from RPE
        const dur = session.duration || 0
        const rpe = session.rpe || 5
        const zIdx = rpe <= 3 ? 0 : rpe <= 5 ? 1 : rpe <= 7 ? 2 : rpe <= 8 ? 3 : 4
        zones[zIdx] += dur; total += dur
      }
    }
    result.push({
      week: `W-${w === 0 ? 'now' : w}`,
      Z1: zones[0], Z2: zones[1], Z3: zones[2], Z4: zones[3], Z5: zones[4],
      total,
    })
  }
  return result
}

const darkTooltip = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', fontFamily: MONO, fontSize: 10 },
  labelStyle:   { color: '#888' },
}

export default function ZoneChart({ log, weeks = 8 }) {
  const data = useMemo(() => buildWeeklyZones(log, weeks), [log, weeks])
  if (!data.length) return null

  // 80% easy threshold line (Z1+Z2 should be ≥80% of total)
  const avgEasyPct = data.reduce((s, d) => s + (d.total > 0 ? (d.Z1 + d.Z2) / d.total : 0), 0) / data.length

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', marginBottom: 4 }}>
        WEEKLY ZONES · avg easy {Math.round(avgEasyPct * 100)}% (target ≥80%)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis dataKey="week" tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} />
          <YAxis tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }} unit="m" />
          <Tooltip {...darkTooltip} formatter={(v, n) => [`${v}min`, n]} />
          <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 9, color: '#888' }} />
          {['Z1','Z2','Z3','Z4','Z5'].map((z, i) => (
            <Bar key={z} dataKey={z} stackId="a" fill={COLORS[i]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
