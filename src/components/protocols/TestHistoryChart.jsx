// ─── TestHistoryChart — SVG sparkline for test history ───────────────────────
export default function TestHistoryChart({ data, goal }) {
  if (!data || data.length < 2) return null
  const vals  = data.map(d => parseFloat(d.value))
  const allV  = goal ? [...vals, parseFloat(goal)] : vals
  const minV  = Math.min(...allV)
  const maxV  = Math.max(...allV)
  const range = maxV - minV || 1
  const W = 400, H = 90
  const pad = { l:32, r:14, t:10, b:22 }
  const cW = W - pad.l - pad.r
  const cH = H - pad.t - pad.b
  const px = i => pad.l + (i / Math.max(data.length - 1, 1)) * cW
  const py = v => pad.t + cH - ((v - minV) / range) * cH
  const pts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const last = vals[vals.length - 1]
  const first = vals[0]
  const yTicks = [minV, minV + range * 0.5, maxV].map(v => ({ v, y: py(v) }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, display:'block', overflow:'visible' }}>
      {/* Y-axis ticks */}
      {yTicks.map(({ v, y }) => (
        <text key={v} x={pad.l - 3} y={y + 3} fontSize="8" fill="#444" textAnchor="end">{v.toFixed(1)}</text>
      ))}
      {/* Goal line */}
      {goal && (
        <>
          <line x1={pad.l} y1={py(parseFloat(goal))} x2={pad.l + cW} y2={py(parseFloat(goal))}
            stroke="#f5c542" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
          <text x={pad.l + cW + 2} y={py(parseFloat(goal)) + 4} fontSize="8" fill="#f5c542">GOAL</text>
        </>
      )}
      {/* Trend line */}
      <polyline fill="none" stroke="#0064ff" strokeWidth="1.5" strokeLinejoin="round" points={pts} />
      {/* Dots */}
      {vals.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={i === vals.length - 1 ? 4 : 3}
          fill={i === vals.length - 1 ? '#0064ff' : '#0064ff66'}
          stroke={i === vals.length - 1 ? '#fff' : 'none'} strokeWidth="1" />
      ))}
      {/* First value label */}
      <text x={px(0)} y={py(first) - 6} fontSize="9" fill="#666" textAnchor="middle">{first.toFixed(1)}</text>
      {/* Last value label */}
      <text x={px(vals.length-1)} y={py(last) - 6} fontSize="9" fill="#0064ff" fontWeight="bold" textAnchor="middle">{last.toFixed(1)}</text>
      {/* Date axis */}
      <text x={px(0)} y={H} fontSize="8" fill="#555" textAnchor="middle">{data[0].date.slice(5)}</text>
      {data.length > 2 && (
        <text x={px(Math.floor((data.length-1)/2))} y={H} fontSize="8" fill="#444" textAnchor="middle">
          {data[Math.floor((data.length-1)/2)].date.slice(5)}
        </text>
      )}
      <text x={px(data.length-1)} y={H} fontSize="8" fill="#555" textAnchor="middle">{data[data.length-1].date.slice(5)}</text>
    </svg>
  )
}
