import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computePaceStrategy } from '../../lib/race/paceStrategy.js'

function fmtPace(secPerKm) {
  if (!secPerKm) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

const CHECKLIST = {
  en: ['Collect race bib', 'Fuel start time (T-45 min)', 'Warm-up 15–20 min', 'Gear check: shoes, watch, nutrition'],
  tr: ['Yarış numarasını al', 'Besleme başlangıç zamanı (T-45 dk)', '15–20 dk ısınma', 'Ekipman kontrol: ayakkabı, saat, beslenme'],
}

export default function RaceDayBriefing({ log: _log = [], raceDate, vdot, targetTime_s }) {
  const { lang, t } = useContext(LangCtx)

  const today   = new Date().toISOString().slice(0, 10)
  const isRaceDay = raceDate === today || (raceDate && Math.abs(new Date(raceDate) - new Date(today)) < 86400000)

  if (!isRaceDay) return null

  const strategy = computePaceStrategy({ vdot, raceDistance_m: 42195, targetTime_s })

  const checkItems = CHECKLIST[lang] || CHECKLIST.en

  return (
    <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }} className="race-day-briefing">
      <style>{`@media print { .race-day-briefing { break-inside: avoid; } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#ff6600' }}>
          🏁 {t('raceDayBriefing') || 'Race Day Briefing'}
        </span>
        <button
          onClick={() => window.print()}
          style={{ ...S.btn, fontSize: 11, padding: '4px 12px' }}
        >
          Print
        </button>
      </div>

      {/* Pace splits */}
      {strategy && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {t('racePaceSplits') || 'Per-km Splits'} ({t('racePaceAvg') || 'Avg'}: {fmtPace(strategy.avgPace_s_per_km)})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {strategy.splits.slice(0, 20).map(s => (
              <div key={s.km} style={{
                padding: '3px 8px', borderRadius: 3,
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              }}>
                <span style={{ color: 'var(--muted)' }}>km{s.km} </span>
                <span style={{ color: 'var(--text)' }}>
                  {fmtPace(s.grade_adjusted_s_per_km)}
                </span>
              </div>
            ))}
            {strategy.splits.length > 20 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", padding: '3px 4px' }}>
                +{strategy.splits.length - 20} more
              </div>
            )}
          </div>
          {strategy.hillPenalty_s > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
              {t('racePaceHillPenalty') || 'Hill Penalty'}: +{Math.round(strategy.hillPenalty_s)}s total
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Checklist
        </div>
        {checkItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <input type="checkbox" style={{ accentColor: '#ff6600' }} />
            <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace" }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Weather link */}
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        Weather: <a href="https://forecast.weather.gov/" target="_blank" rel="noopener noreferrer"
          style={{ color: '#0064ff' }}>forecast.weather.gov</a>
      </div>
    </div>
  )
}
