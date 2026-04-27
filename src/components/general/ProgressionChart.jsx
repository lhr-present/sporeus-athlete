// src/components/general/ProgressionChart.jsx — per-exercise top-set load over time
import { S } from '../../styles.js'

/**
 * @param {Array<{session_date: string, load_kg: number, reps: number}>} data
 *   Chronological top-set records for one exercise.
 */
export default function ProgressionChart({ data = [], exerciseName = '', lang = 'en' }) {
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

  const loads = data.map(d => d.load_kg ?? 0)
  const minL   = Math.min(...loads)
  const maxL   = Math.max(...loads)
  const range  = maxL - minL || 1

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.load_kg - minL) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 18px' }}>
      <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 10 }}>
        {exerciseName} — {lang === 'tr' ? 'ÜSTTEN SET İLERLEME' : 'TOP SET PROGRESSION'}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
        {/* Grid */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#ff6600" strokeWidth={1.5} />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#ff6600">
            <title>{p.session_date}: {p.load_kg}kg × {p.reps}</title>
          </circle>
        ))}
        {/* Labels */}
        <text x={PAD} y={H - 4} fill="#555" fontFamily="'IBM Plex Mono',monospace" fontSize={8}>{data[0]?.session_date?.slice(5)}</text>
        <text x={W - PAD} y={H - 4} fill="#555" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{data[data.length - 1]?.session_date?.slice(5)}</text>
        <text x={PAD - 4} y={PAD} fill="#888" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{maxL}kg</text>
        <text x={PAD - 4} y={H - PAD} fill="#888" fontFamily="'IBM Plex Mono',monospace" fontSize={8} textAnchor="end">{minL}kg</text>
      </svg>
    </div>
  )
}
