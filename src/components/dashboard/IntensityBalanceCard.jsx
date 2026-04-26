// src/components/dashboard/IntensityBalanceCard.jsx — E76
// Shows 4-week easy vs hard session split and polarization compliance.
// Seiler (2010): ~80% easy / 20% hard by duration = polarized.
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { computeIntensityBalance } from '../../lib/athlete/intensityBalance.js'

const MONO = "'IBM Plex Mono', monospace"

export default function IntensityBalanceCard({ log, isTR }) {
  const data = useMemo(() => computeIntensityBalance(log), [log])

  if (!data || data.status === 'insufficient') return null

  const lang = isTR ? 'tr' : 'en'
  const BAR_COLORS = {
    polarized: '#5bc25b',
    balanced:  '#f5c542',
    'too-hard': '#e03030',
  }
  const barColor = BAR_COLORS[data.status] || '#888'

  return (
    <div style={{ ...S.card }}>
      <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '10px' }}>
        ◈ {isTR ? 'YOĞUNLUK DAĞILIMI — SON 4 HAFTA' : 'INTENSITY BALANCE — LAST 4 WEEKS'}
      </div>

      {/* Easy / Hard bar */}
      <div style={{ position: 'relative', height: '12px', background: '#1a1a1a', borderRadius: '3px', marginBottom: '6px', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${data.easyPct}%`,
          background: '#5bc25b',
          transition: 'width 0.4s ease',
        }} />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: `${data.hardPct}%`,
          background: '#e03030',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#5bc25b' }}>
          {isTR ? 'KOLAY' : 'EASY'} {data.easyPct}% · {Math.round(data.easyMin / 60)}h
        </span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#e03030' }}>
          {data.hardPct}% {isTR ? 'ZOR' : 'HARD'} · {Math.round(data.hardMin / 60)}h
        </span>
      </div>

      {/* Status line */}
      <div style={{ fontFamily: MONO, fontSize: '10px', color: barColor, lineHeight: 1.5 }}>
        {data[lang]}
      </div>

      {/* Target marker */}
      <div style={{ fontFamily: MONO, fontSize: '8px', color: '#333', marginTop: '5px' }}>
        {isTR ? 'Hedef: ≥%75 kolay (Seiler 2010 polarize)' : 'Target: ≥75% easy (Seiler 2010 polarized)'}
      </div>
    </div>
  )
}
