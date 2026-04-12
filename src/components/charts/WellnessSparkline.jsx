// ─── charts/WellnessSparkline.jsx — 14-day wellness trend (lazy-loaded) ─────
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export default function WellnessSparkline({ recovery }) {
  const today = new Date()
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (13 - i))
    const date = d.toISOString().slice(0, 10)
    const e = (recovery || []).find(r => r.date === date)
    return { date, sleep: e?.sleep ?? null, energy: e?.energy ?? null, soreness: e?.soreness ?? null }
  })
  const hasData = data.some(d => d.sleep !== null)
  if (!hasData) return null
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>14-DAY WELLNESS</div>
      <div style={{ display: 'flex', gap: '6px', fontSize: '9px', fontFamily: "'IBM Plex Mono',monospace", color: '#888', marginBottom: '4px' }}>
        <span style={{ color: '#0064ff' }}>◉ sleep</span>
        <span style={{ color: '#5bc25b' }}>◉ energy</span>
        <span style={{ color: '#ff6600' }}>◉ soreness</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="sleep"    stroke="#0064ff" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="energy"   stroke="#5bc25b" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="soreness" stroke="#ff6600" strokeWidth={1.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
