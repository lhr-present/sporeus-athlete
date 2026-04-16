// ─── dashboard/BanisterModelCard.jsx — Banister fitness-fatigue model SVG ─────
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { fitBanister, predictBanister } from '../../lib/trainingLoad.js'

const W = 280, H = 80, padL = 4, padR = 4, padT = 6, padB = 16

export default function BanisterModelCard() {
  const { log, testResults } = useData()
  const [lang] = useLocalStorage('sporeus-lang', 'en')

  const banisterFit = useMemo(
    () => (testResults?.length ?? 0) >= 3 ? fitBanister(log, testResults) : null,
    [log, testResults]
  )

  if ((testResults?.length ?? 0) < 3 || !banisterFit) return null

  const fit   = banisterFit
  const proj  = predictBanister(log, fit, [], 60)
  const today = new Date().toISOString().slice(0, 10)
  const range = fit.maxV - fit.minV || 1

  const normTests = testResults
    .filter(t => t.date && typeof t.value === 'number')
    .map(t => ({ date: t.date, norm: Math.round((t.value - fit.minV) / range * 100) }))
    .sort((a, b) => a.date > b.date ? 1 : -1)

  const allDates = [...normTests.map(t => t.date), ...proj.map(p => p.date)]
  const minDate  = allDates[0]
  const maxDate  = allDates[allDates.length - 1]
  const spanMs   = new Date(maxDate) - new Date(minDate) || 1
  const iW = W - padL - padR
  const iH = H - padT - padB
  const px = d => padL + (new Date(d) - new Date(minDate)) / spanMs * iW
  const py = v => padT + (1 - v / 100) * iH
  const todayX  = px(today)
  const projPath = proj.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.date).toFixed(1)},${py(p.predicted).toFixed(1)}`).join(' ')

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '196ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={S.cardTitle}>BANISTER MODEL</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ ...S.mono, fontSize: 9, color: '#888' }}>R² {fit.r2}</span>
          <span style={{ ...S.mono, fontSize: 9, color: '#5bc25b' }}>k₁ {fit.k1.toFixed(3)}</span>
          <span style={{ ...S.mono, fontSize: 9, color: '#e03030' }}>k₂ {fit.k2.toFixed(3)}</span>
        </div>
      </div>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', width: '100%', maxWidth: W }}>
        <line x1={todayX} y1={padT} x2={todayX} y2={padT + iH} stroke="#333" strokeWidth="1" strokeDasharray="3,3"/>
        <text x={todayX + 3} y={padT + 8} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555">TODAY</text>
        {proj.length > 1 && <path d={projPath} fill="none" stroke="#ff6600" strokeWidth="2" strokeLinejoin="round"/>}
        {normTests.map((t, i) => (
          <g key={i}>
            <circle cx={px(t.date)} cy={py(t.norm)} r={3.5} fill="#ff6600" stroke="#111" strokeWidth="1"/>
          </g>
        ))}
        <text x={padL} y={H} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555">{minDate?.slice(5)}</text>
        <text x={W - padR} y={H} fontFamily="'IBM Plex Mono',monospace" fontSize={7} fill="#555" textAnchor="end">{maxDate?.slice(5)}</text>
      </svg>
      <div style={{ ...S.mono, fontSize: 9, color: '#555', marginTop: 6, lineHeight: 1.5 }}>
        {lang === 'tr'
          ? `Banister 1975: performans = k₁·fitness − k₂·yorgunluk. Nokta = gerçek test. Çizgi = 60 günlük projeksiyon.`
          : `Banister 1975: performance = k₁·fitness − k₂·fatigue. Dots = actual tests. Line = 60-day projection.`}
      </div>
    </div>
  )
}
