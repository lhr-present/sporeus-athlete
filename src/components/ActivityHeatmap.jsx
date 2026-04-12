// ─── ActivityHeatmap.jsx — GitHub-style training density heatmap ─────────────
import { useMemo, useState } from 'react'

const MONO = "'IBM Plex Mono', monospace"
// Orange intensity scale (0 = rest, 5 = peak load)
const COLS = ['#1a1a1a', '#3d2200', '#7a4400', '#b05a00', '#e07000', '#ff6600']

function tssColor(tss) {
  if (!tss || tss <= 0) return COLS[0]
  if (tss < 30)  return COLS[1]
  if (tss < 60)  return COLS[2]
  if (tss < 100) return COLS[3]
  if (tss < 150) return COLS[4]
  return COLS[5]
}

export default function ActivityHeatmap({ log = [] }) {
  const [hovered, setHovered] = useState(null)
  const safeLog = Array.isArray(log) ? log : []

  const byDate = useMemo(() => {
    const map = {}
    for (const e of safeLog) {
      if (e.date) map[e.date] = (map[e.date] || 0) + (e.tss || 0)
    }
    return map
  }, [log])

  // Build 53-week grid aligned to Sunday
  const weeks = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay()) // roll back to Sunday

    const all = []
    const cursor = new Date(start)
    while (cursor <= today) {
      const d = cursor.toISOString().slice(0, 10)
      all.push({ date: d, tss: byDate[d] || 0 })
      cursor.setDate(cursor.getDate() + 1)
    }

    const ws = []
    for (let i = 0; i < all.length; i += 7) ws.push(all.slice(i, i + 7))
    return ws
  }, [byDate])

  const monthLabels = useMemo(() => {
    const labels = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      if (!week[0]) return
      const m = new Date(week[0].date).getMonth()
      if (m !== lastMonth) {
        labels.push({ wi, label: new Date(week[0].date).toLocaleString('en-US', { month: 'short' }).toUpperCase() })
        lastMonth = m
      }
    })
    return labels
  }, [weeks])

  const yearTSS    = Object.values(byDate).reduce((s, v) => s + v, 0)
  const activeDays = Object.values(byDate).filter(v => v > 0).length

  const CELL = 13, GAP = 2

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ letterSpacing: '0.06em' }}>TRAINING HEATMAP — 52 WEEKS</span>
        <span style={{ color: '#ff6600' }}>{activeDays} active days · {Math.round(yearTSS).toLocaleString()} TSS</span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        {/* Month labels */}
        <div style={{ display: 'flex', marginLeft: 18, marginBottom: 3 }}>
          {weeks.map((_, wi) => {
            const lbl = monthLabels.find(m => m.wi === wi)
            return (
              <div key={wi} style={{ width: CELL + GAP, flexShrink: 0, fontFamily: MONO, fontSize: 8, color: '#555' }}>
                {lbl ? lbl.label : ''}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: GAP }}>
          {/* Day-of-week labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 2 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ width: 14, height: CELL, fontFamily: MONO, fontSize: 8, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>

          {/* Heatmap cells */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  title={`${day.date}: ${day.tss ? `TSS ${day.tss}` : 'rest'}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    background: tssColor(day.tss),
                    cursor: day.tss ? 'pointer' : 'default',
                    border: hovered?.date === day.date ? '1px solid #ff6600' : '1px solid transparent',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      <div style={{ minHeight: 22, marginTop: 4 }}>
        {hovered && hovered.tss > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: '#ccc', padding: '2px 8px', background: '#1a1a1a', borderRadius: 3, border: '1px solid #333' }}>
            {hovered.date} · TSS {hovered.tss}
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#444', marginRight: 2 }}>LESS</span>
        {COLS.map((c, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: c, flexShrink: 0 }} />
        ))}
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#444', marginLeft: 2 }}>MORE</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#444', marginLeft: 6 }}>0 · 1-29 · 30-59 · 60-99 · 100-149 · 150+</span>
      </div>
    </div>
  )
}
