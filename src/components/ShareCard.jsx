import { useRef, useState, useMemo } from 'react'
import { S } from '../styles.js'
import { calculatePMC } from '../lib/trainingLoad.js'
import { zoneDistribution, trainingModel, MODEL_META } from '../lib/zoneDistrib.js'

// ─── ShareCard ─────────────────────────────────────────────────────────────────
// Renders an SVG Bloomberg-Terminal-style training summary card.
// Share button: Web Share API (text) → clipboard fallback.

const CARD_W = 400
const CARD_H = 220

const C = {
  bg:     '#0a0a0a',
  header: '#ff6600',
  text:   '#f0f0f0',
  muted:  '#888888',
  blue:   '#0064ff',
  green:  '#5bc25b',
  yellow: '#f5c542',
  red:    '#e03030',
  card:   '#1a1a1a',
}

function tsbColor(tsb) {
  if (tsb > 10)  return C.blue
  if (tsb > -10) return C.green
  if (tsb > -25) return C.yellow
  return C.red
}

export default function ShareCard({ log, profile, filteredLog }) {
  const [status, setStatus] = useState(null)

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const name  = (profile?.name  || 'Athlete').slice(0, 20)
  const sport = (profile?.sport || profile?.primarySport || 'Endurance').slice(0, 20)

  // PMC — last real day
  const pmc  = useMemo(() => calculatePMC(log, 1, 0), [log])
  const last  = pmc.filter(p => !p.isFuture).at(-1) || {}
  const ctl   = Math.round(last.ctl || 0)
  const tsb   = Math.round(last.tsb || 0)

  // ACWR (simple 7d/28d ratio from full log)
  const now  = Date.now()
  const ms7  = 7  * 864e5
  const ms28 = 28 * 864e5
  const acute  = (log || []).filter(e => now - new Date(e.date).getTime() < ms7).reduce((s, e) => s + (e.tss || 0), 0)
  const chron  = (log || []).filter(e => now - new Date(e.date).getTime() < ms28).reduce((s, e) => s + (e.tss || 0), 0) / 4
  const acwr   = chron > 0 ? (acute / chron).toFixed(2) : '—'

  // This week TSS (Mon–Sun)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - (today.getDay() + 6) % 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekTSS = Math.round((log || []).filter(e => new Date(e.date) >= weekStart).reduce((s, e) => s + (e.tss || 0), 0))

  // Zone model (last 28d)
  const last28 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28)
    const cut = cutoff.toISOString().slice(0, 10)
    return (log || []).filter(e => e.date >= cut)
  }, [log])
  const dist      = useMemo(() => zoneDistribution(last28), [last28])
  const modelKey  = dist ? trainingModel(dist) : null
  const modelMeta = MODEL_META[modelKey] || null

  // Share text
  const shareText = [
    `◈ SPOREUS ATHLETE — ${dateStr}`,
    `${name.toUpperCase()} · ${sport.toUpperCase()}`,
    `CTL ${ctl} · TSB ${tsb >= 0 ? '+' + tsb : tsb} · ACWR ${acwr}`,
    `WEEK TSS: ${weekTSS}${modelKey ? ' · MODEL: ' + modelKey.toUpperCase() : ''}`,
    'sporeus.com',
  ].join('\n')

  const handleShare = async () => {
    setStatus('...')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Training Week — Sporeus', text: shareText })
        setStatus('shared')
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText)
        setStatus('copied')
      } else {
        setStatus(null)
        return
      }
    } catch {
      setStatus(null)
      return
    }
    setTimeout(() => setStatus(null), 2500)
  }

  const tsbc   = tsbColor(tsb)
  const mColor = modelMeta?.color || C.muted
  const mLabel = modelKey ? modelKey.toUpperCase() : ''

  const metrics = [
    { label: 'CTL',    value: String(ctl),                         color: C.blue,   x: 12  },
    { label: 'TSB',    value: tsb >= 0 ? `+${tsb}` : String(tsb), color: tsbc,     x: 110 },
    { label: 'ACWR',   value: String(acwr),                        color: C.green,  x: 208 },
    { label: 'WK TSS', value: String(weekTSS),                     color: C.yellow, x: 306 },
  ]

  return (
    <div style={{ ...S.card, animationDelay: '202ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ ...S.mono, fontSize: '10px', fontWeight: 600, color: '#ff6600', letterSpacing: '0.08em' }}>
          ◈ SHARE CARD
        </div>
        <button style={{ ...S.btn, fontSize: '10px', padding: '4px 12px' }} onClick={handleShare}>
          {status === '...'    ? 'GENERATING…'
           : status === 'shared' ? '✓ SHARED'
           : status === 'copied' ? '✓ COPIED'
           : navigator.share   ? '↑ SHARE'
           : '⎘ COPY STATS'}
        </button>
      </div>

      {/* SVG card — visual only */}
      <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="auto"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', borderRadius: '4px', maxWidth: CARD_W }}>

        {/* Background */}
        <rect width={CARD_W} height={CARD_H} fill={C.bg} rx="4"/>

        {/* Header bar */}
        <rect width={CARD_W} height="36" fill={C.header} rx="4"/>
        <rect y="32" width={CARD_W} height="4" fill={C.header}/>

        {/* Header text */}
        <text x="12" y="23" fill={C.bg} fontFamily="monospace" fontSize="11" fontWeight="700" letterSpacing="2">
          SPOREUS ATHLETE
        </text>
        <text x={CARD_W - 12} y="23" fill={C.bg} fontFamily="monospace" fontSize="10" textAnchor="end">
          {dateStr}
        </text>

        {/* Athlete name + sport */}
        <text x="12" y="62" fill={C.text} fontFamily="monospace" fontSize="16" fontWeight="700">
          {name.toUpperCase()}
        </text>
        <text x="12" y="78" fill={C.muted} fontFamily="monospace" fontSize="10">
          {sport.toUpperCase()}
        </text>

        {/* Metric boxes */}
        {metrics.map(m => (
          <g key={m.label}>
            <rect x={m.x} y="88" width="86" height="64" fill={C.card} rx="3"/>
            <rect x={m.x} y="88" width="3"  height="64" fill={m.color} rx="1"/>
            <text x={m.x + 9} y="103" fill={C.muted} fontFamily="monospace" fontSize="8" letterSpacing="1">
              {m.label}
            </text>
            <text x={m.x + 9} y="132" fill={m.color} fontFamily="monospace" fontSize="24" fontWeight="700">
              {m.value}
            </text>
          </g>
        ))}

        {/* Model badge */}
        {mLabel ? (
          <>
            <rect x="12" y="163" width={mLabel.length * 7 + 18} height="22" fill={`${mColor}22`} rx="3"/>
            <rect x="12" y="163" width="3" height="22" fill={mColor} rx="1"/>
            <text x="22" y="178" fill={mColor} fontFamily="monospace" fontSize="10" fontWeight="700" letterSpacing="1">
              {mLabel}
            </text>
          </>
        ) : null}

        {/* Footer */}
        <rect y={CARD_H - 22} width={CARD_W} height="22" fill={C.card}/>
        <text x={CARD_W / 2} y={CARD_H - 7} fill={C.muted} fontFamily="monospace" fontSize="9"
          textAnchor="middle" letterSpacing="1">
          sporeus.com — BLOOMBERG TERMINAL FOR ATHLETES
        </text>
      </svg>
    </div>
  )
}
