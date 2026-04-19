// src/components/coach/SquadCompare.jsx — E5: Side-by-side athlete metric comparison
// Coach selects 2-6 athletes and a metric, sees comparison bars.
// Pure client-side; data from coach roster in localStorage.
import { useState, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'

const MONO = "'IBM Plex Mono', monospace"

const METRICS = [
  { key: 'ctl',             labelEn: 'CTL (Fitness)',          labelTr: 'KTY (Form)',         color: '#0064ff', unit: '',   hi: 120, lo: 0 },
  { key: 'atl',             labelEn: 'ATL (Fatigue)',          labelTr: 'ATY (Yorgunluk)',    color: '#e03030', unit: '',   hi: 120, lo: 0 },
  { key: 'tsb',             labelEn: 'TSB (Form)',             labelTr: 'TSF (Denge)',        color: '#ff6600', unit: '',   hi: 30,  lo: -40 },
  { key: 'acwr',            labelEn: 'ACWR',                   labelTr: 'AAKÖ',               color: '#f5c542', unit: '',   hi: 2.0, lo: 0 },
  { key: 'weeklyTSS',       labelEn: 'Weekly TSS',             labelTr: 'Haftalık TSS',       color: '#5bc25b', unit: '',   hi: 800, lo: 0 },
  { key: 'compliancePct',   labelEn: 'Compliance %',           labelTr: 'Uyum %',             color: '#4a90d9', unit: '%',  hi: 100, lo: 0 },
  { key: 'hrvTrend',        labelEn: 'HRV (7d avg)',           labelTr: 'KAD (7g ortalama)',  color: '#888',    unit: '',   hi: 100, lo: 0 },
]

function Bar({ value, hi, lo, color, unit }) {
  if (value == null) {
    return <span style={{ fontFamily: MONO, fontSize: '10px', color: '#444' }}>—</span>
  }
  const range = hi - lo
  const pct = range > 0 ? Math.max(0, Math.min(100, ((value - lo) / range) * 100)) : 50
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
        {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}{unit}
      </span>
    </div>
  )
}

export default function SquadCompare({ roster = [] }) {
  const { lang } = useContext(LangCtx)
  const isEn = lang !== 'tr'

  const [selected, setSelected] = useState([])
  const [metric, setMetric] = useState('ctl')

  const activeMetric = METRICS.find(m => m.key === metric) || METRICS[0]
  const label = m => isEn ? m.labelEn : m.labelTr

  function toggleAthlete(id) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 6 ? [...prev, id] : prev
    )
  }

  const comparing = roster.filter(a => selected.includes(a.id || a.athleteId))

  return (
    <div style={{ ...S.card }}>
      <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{isEn ? 'SQUAD COMPARE' : 'KADRO KARŞILAŞTIRMA'}</span>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#555' }}>
          {isEn ? 'Select 2–6 athletes' : '2–6 atlet seç'}
        </span>
      </div>

      {/* Athlete selector */}
      {roster.length === 0 ? (
        <p style={{ fontFamily: MONO, fontSize: '11px', color: '#555' }}>
          {isEn ? 'No athletes in roster.' : 'Kadroda atlet yok.'}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {roster.map(a => {
              const id = a.id || a.athleteId
              const isActive = selected.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleAthlete(id)}
                  style={{
                    fontFamily: MONO, fontSize: '10px', padding: '4px 10px', borderRadius: 3,
                    border: `1px solid ${isActive ? '#ff6600' : '#333'}`,
                    background: isActive ? '#ff660022' : 'transparent',
                    color: isActive ? '#ff6600' : '#888',
                    cursor: 'pointer', touchAction: 'manipulation',
                  }}
                >
                  {a.name || a.displayName || id}
                </button>
              )
            })}
          </div>

          {/* Metric selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                style={{
                  fontFamily: MONO, fontSize: '9px', padding: '3px 8px', borderRadius: 3,
                  border: `1px solid ${metric === m.key ? m.color : '#333'}`,
                  background: metric === m.key ? m.color + '22' : 'transparent',
                  color: metric === m.key ? m.color : '#666',
                  cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                {label(m)}
              </button>
            ))}
          </div>

          {/* Comparison bars */}
          {comparing.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: '10px', color: '#555' }}>
              {isEn ? 'Select athletes above to compare.' : 'Karşılaştırmak için yukarıdan atlet seç.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comparing.map(a => {
                const id = a.id || a.athleteId
                const val = a[activeMetric.key] ?? a.metrics?.[activeMetric.key]
                return (
                  <div key={id}>
                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#888', marginBottom: 3, letterSpacing: '0.06em' }}>
                      {a.name || a.displayName || id}
                    </div>
                    <Bar
                      value={val}
                      hi={activeMetric.hi}
                      lo={activeMetric.lo}
                      color={activeMetric.color}
                      unit={activeMetric.unit}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
