// src/components/general/ProgressionChart.jsx — per-exercise top-set load over time
import { S } from '../../styles.js'

/**
 * @param {Array<{session_date: string, load_kg: number, reps: number}>} data
 *   Chronological top-set records for one exercise.
 */
export default function ProgressionChart({ data = [], exerciseName = '', isBW = false, lang = 'en' }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ ...S.mono, fontSize: 10, color: '#555', padding: '16px 0' }}>
        {lang === 'tr' ? 'Grafik için en az 2 seans gerekli.' : 'Need at least 2 sessions to show progression.'}
      </div>
    )
  }

  const W = 280
  const H = 80
  const PAD = 20

  const vals  = data.map(d => isBW ? (d.reps ?? 0) : (d.load_kg ?? 0))
  const minV  = Math.min(...vals)
  const maxV  = Math.max(...vals)
  const range = maxV - minV || 1

  const pts = data.map((d, i) => {
    const v = isBW ? (d.reps ?? 0) : (d.load_kg ?? 0)
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((v - minV) / range) * (H - PAD * 2)
    return { x, y, ...d, v }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const unitLabel = isBW ? (lang === 'tr' ? 'tek' : 'reps') : 'kg'
  const header    = isBW
    ? (lang === 'tr' ? 'MAX TEKRAR' : 'MAX REPS')
    : (lang === 'tr' ? 'ÜSTTEN SET İLERLEME' : 'TOP SET PROGRESSION')

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 18px' }}>
      <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 10 }}>
        {exerciseName} — {header}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        <polyline points={polyline} fill="none" stroke="#ff6600" strokeWidth={1.5} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#ff6600">
            <title>{isBW ? `${p.session_date}: ${p.reps} reps` : `${p.session_date}: ${p.load_kg}kg × ${p.reps}`}</title>
          </circle>
        ))}
        <text x={PAD} y={H - 4} fill="#555" fontFamily="'IBM Plex Mono',monospace" fontSize={8}>{data[0]?.session_date?.slice(5)}</text>
        <text x={W - PAD} y={H - 4} fill="#555" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{data[data.length - 1]?.session_date?.slice(5)}</text>
        <text x={PAD - 4} y={PAD} fill="#888" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{maxV}{unitLabel}</text>
        <text x={PAD - 4} y={H - PAD} fill="#888" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{minV}{unitLabel}</text>
      </svg>
    </div>
  )
}
