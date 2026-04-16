// ─── WPrimeChart — W' balance SVG chart ──────────────────────────────────────
export default function WPrimeChart({ series, wPrimeMax }) {
  if (!series || series.length === 0) return null
  const W = 600, H = 180
  const PAD = { top: 12, right: 16, bottom: 28, left: 48 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  // Downsample to max 600 points for rendering
  const step = Math.max(1, Math.floor(series.length / 600))
  const pts = []
  for (let i = 0; i < series.length; i += step) pts.push({ i, v: series[i] })

  const minVal = Math.min(0, ...pts.map(p => p.v))
  const maxVal = wPrimeMax
  const range  = maxVal - minVal || 1
  const totalSec = series.length

  const scaleX = i => PAD.left + (i / (totalSec - 1)) * chartW
  const scaleY = v => PAD.top + chartH - ((v - minVal) / range) * chartH

  // Build SVG polyline points
  const polyline = pts.map(p => `${scaleX(p.i).toFixed(1)},${scaleY(p.v).toFixed(1)}`).join(' ')

  // Find exhaustion point (first time W' = 0)
  const exhaustIdx = series.findIndex(v => v <= 0)
  const exhaustX   = exhaustIdx >= 0 ? scaleX(exhaustIdx) : null

  // Min W' point
  const minW    = Math.min(...series)
  const minWIdx = series.indexOf(minW)
  const minWX   = scaleX(minWIdx)
  const minWY   = scaleY(minW)

  // Y-axis ticks
  const yTicks = [0, Math.round(wPrimeMax * 0.25), Math.round(wPrimeMax * 0.5), Math.round(wPrimeMax * 0.75), wPrimeMax]

  // X-axis ticks (minutes)
  const totalMin  = Math.ceil(totalSec / 60)
  const tickEvery = totalMin <= 30 ? 5 : totalMin <= 60 ? 10 : 20
  const xTicks    = []
  for (let m = 0; m <= totalMin; m += tickEvery) xTicks.push(m)

  const _fmtTime = sec => {
    const m = Math.floor(sec / 60), s = sec % 60
    return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2,'0')}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, display:'block', overflow:'visible' }}>
      {/* Grid lines */}
      {yTicks.map(tick => (
        <line key={tick}
          x1={PAD.left} y1={scaleY(tick)}
          x2={PAD.left + chartW} y2={scaleY(tick)}
          stroke="#1e1e1e" strokeWidth="1"
        />
      ))}

      {/* W' = 0 danger line */}
      <line
        x1={PAD.left} y1={scaleY(0)}
        x2={PAD.left + chartW} y2={scaleY(0)}
        stroke="#e03030" strokeWidth="1" strokeDasharray="4 3" opacity="0.6"
      />

      {/* W'max reference line */}
      <line
        x1={PAD.left} y1={scaleY(wPrimeMax)}
        x2={PAD.left + chartW} y2={scaleY(wPrimeMax)}
        stroke="#5bc25b" strokeWidth="1" strokeDasharray="4 3" opacity="0.4"
      />

      {/* Shaded area under W' curve */}
      <polygon
        points={`${PAD.left},${scaleY(0)} ${polyline} ${scaleX(pts.at(-1).i)},${scaleY(0)}`}
        fill="#ff6600" fillOpacity="0.07"
      />

      {/* W' balance line */}
      <polyline points={polyline} fill="none" stroke="#ff6600" strokeWidth="1.8" strokeLinejoin="round"/>

      {/* Exhaustion marker */}
      {exhaustX !== null && (
        <>
          <line x1={exhaustX} y1={PAD.top} x2={exhaustX} y2={PAD.top + chartH} stroke="#e03030" strokeWidth="1.5" strokeDasharray="3 2"/>
          <text x={exhaustX + 3} y={PAD.top + 10} fill="#e03030" fontSize="9" fontFamily="'IBM Plex Mono',monospace">EXHAUSTION</text>
        </>
      )}

      {/* Min W' dot */}
      {minW > 0 && (
        <>
          <circle cx={minWX} cy={minWY} r="4" fill="#f5c542" stroke="#0a0a0a" strokeWidth="1"/>
          <text x={minWX + 6} y={minWY - 4} fill="#f5c542" fontSize="9" fontFamily="'IBM Plex Mono',monospace">
            MIN {(minW / 1000).toFixed(1)}kJ
          </text>
        </>
      )}

      {/* Y-axis labels */}
      {yTicks.map(tick => (
        <text key={tick} x={PAD.left - 4} y={scaleY(tick) + 4}
          fill="#555" fontSize="9" fontFamily="'IBM Plex Mono',monospace" textAnchor="end">
          {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map(m => (
        <text key={m} x={scaleX(m * 60)} y={H - 6}
          fill="#555" fontSize="9" fontFamily="'IBM Plex Mono',monospace" textAnchor="middle">
          {m}m
        </text>
      ))}

      {/* Axis lines */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#333" strokeWidth="1"/>
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="#333" strokeWidth="1"/>
    </svg>
  )
}
