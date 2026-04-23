import { useMemo } from 'react'
import { S } from '../../styles.js'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CELL  = 10
const GAP   = 2
const STEP  = CELL + GAP

function tssColor(tss) {
  if (!tss || tss === 0) return '#1a1a1a'
  if (tss < 60)          return 'rgba(255,102,0,0.30)'
  if (tss < 100)         return 'rgba(255,102,0,0.70)'
  return '#ff6600'
}

export default function LoadHeatmapCard({ log, dl, onDayClick }) {
  const { tssMap, weeks, monthLabels } = useMemo(() => {
    // Build TSS lookup: { 'YYYY-MM-DD': tss }
    const map = {}
    ;(log || []).forEach(e => {
      if (!e.date) return
      map[e.date] = (map[e.date] || 0) + (e.tss || 0)
    })

    // Build 52 weeks of columns, each 7 cells (Mon=0 … Sun=6)
    // Start: Monday 364 days ago (52 * 7)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the Monday of the week 52 weeks ago
    const startMs = today.getTime() - 363 * 86400000           // 364 days ago = day 0 of 52-week window
    const startDay = new Date(startMs)
    const dow = startDay.getDay() || 7                          // Mon=1..Sun=7
    const monday = new Date(startMs - (dow - 1) * 86400000)    // rewind to that Monday

    const cols = []   // each col = array of 7 date strings (Mon..Sun)
    const labels = [] // { colIdx, label }

    let cur = new Date(monday)
    let prevMonth = -1

    for (let w = 0; w < 52; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().slice(0, 10)
        col.push(iso)
        if (d === 0 && cur.getMonth() !== prevMonth) {
          labels.push({ colIdx: w, label: MONTH_ABBR[cur.getMonth()] })
          prevMonth = cur.getMonth()
        }
        cur.setDate(cur.getDate() + 1)
      }
      cols.push(col)
    }

    return { tssMap: map, weeks: cols, monthLabels: labels }
  }, [log])

  if (!dl.loadheatmap) return null

  const LABEL_H = 16    // height for month labels row
  const DAY_W   = 18    // width for day label column (M, W, F)
  const SVG_W   = DAY_W + 52 * STEP
  const SVG_H   = LABEL_H + 7 * STEP

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms', overflowX: 'auto' }}>
      <div style={S.cardTitle}>LOAD HEATMAP · LAST 12 MONTHS</div>
      <svg
        width={SVG_W}
        height={SVG_H}
        style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace' }}
      >
        {/* Month labels */}
        {monthLabels.map(({ colIdx, label }) => (
          <text
            key={colIdx}
            x={DAY_W + colIdx * STEP}
            y={LABEL_H - 4}
            fontSize={9}
            fill="#888"
          >
            {label}
          </text>
        ))}

        {/* Day labels: M, W, F at rows 0, 2, 4 (Mon, Wed, Fri) */}
        {[['M', 0], ['W', 2], ['F', 4]].map(([ch, row]) => (
          <text
            key={ch}
            x={0}
            y={LABEL_H + row * STEP + CELL - 2}
            fontSize={9}
            fill="#555"
          >
            {ch}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((col, wi) =>
          col.map((date, di) => {
            const tss   = tssMap[date] || 0
            const fill  = tssColor(tss)
            const cx    = DAY_W + wi * STEP
            const cy    = LABEL_H + di * STEP
            const isFuture = date > new Date().toISOString().slice(0, 10)

            return (
              <rect
                key={date}
                x={cx}
                y={cy}
                width={CELL}
                height={CELL}
                rx={2}
                ry={2}
                fill={isFuture ? '#111' : fill}
                style={{ cursor: isFuture ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!isFuture) {
                    if (typeof onDayClick === 'function') onDayClick(date)
                  }
                }}
              >
                <title>{date}: TSS {tssMap[date] || 0}</title>
              </rect>
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>Less</span>
        {['#1a1a1a', 'rgba(255,102,0,0.30)', 'rgba(255,102,0,0.70)', '#ff6600'].map((c, i) => (
          <div key={i} style={{ width: CELL, height: CELL, background: c, borderRadius: '2px', border: '1px solid #333' }} />
        ))}
        <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>More</span>
      </div>
    </div>
  )
}
