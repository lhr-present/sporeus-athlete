// ─── RunningRaceReadinessCard.jsx — raceReadiness() (Daniels 1979) wired to UI (E45) ─
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { computeRunningRaceReadiness } from '../../lib/athlete/runningRaceReadiness.js'

// Score → color
function scoreColor(score) {
  if (score >= 75) return '#5bc25b'
  if (score >= 50) return '#f5c542'
  return '#e03030'
}

// Flag → bullet color
function flagColor(flag) {
  const f = flag.toLowerCase()
  if (f.includes('ok') || f.includes('adequate') || f.includes('present') || f.includes('track')) {
    return '#5bc25b'
  }
  return '#e03030'
}

// Format metres to human-readable distance label
function fmtDistanceLabel(m) {
  if (m === 42195) return 'MARATHON'
  if (m === 21097) return 'HALF MARATHON'
  if (m === 10000) return '10K'
  if (m === 5000)  return '5K'
  if (m === 3000)  return '3K'
  if (m === 1000)  return '1K'
  return `${(m / 1000).toFixed(1)}K`
}

export default function RunningRaceReadinessCard({ log = [], profile = {} }) {
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const { t }  = useContext(LangCtx)

  const data = useMemo(() => computeRunningRaceReadiness(log, profile), [log, profile])

  if (!data) return null

  const { score, flags, targetDistanceM, daysToRace, runSessionCount } = data

  const title = t('runReadinessTitle') || (lang === 'tr' ? 'KOŞU YARIŞ HAZIRLIĞI' : 'RUNNING RACE READINESS')

  const raceTarget = daysToRace !== null
    ? `${fmtDistanceLabel(targetDistanceM)} · ${daysToRace}d ${lang === 'tr' ? 'yarışa kalan' : 'to race'}`
    : `${fmtDistanceLabel(targetDistanceM)} · ${lang === 'tr' ? 'yarış tarihi yok' : 'no race date'}`

  return (
    <div className="sp-card" style={{ ...S.card, marginBottom: '16px' }}>

      {/* Title */}
      <div style={{
        ...S.cardTitle,
        color: '#ff6600',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '4px',
        marginBottom: '10px',
      }}>
        <span>◈ {title}</span>
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          ...S.mono,
          fontSize: '32px',
          fontWeight: 700,
          color: scoreColor(score),
          lineHeight: 1,
        }}>
          {score}
        </span>
        <span style={{ ...S.mono, fontSize: '16px', color: '#555' }}>/100</span>
      </div>

      {/* Target + race date */}
      <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginBottom: '10px', letterSpacing: '0.04em' }}>
        → {raceTarget}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {flags.map((flag, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
              <span style={{ color: flagColor(flag), fontSize: '10px', lineHeight: 1, flexShrink: 0 }}>●</span>
              <span style={{ ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.5 }}>
                {flag}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Session count */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginBottom: '4px' }}>
        {lang === 'tr'
          ? `${runSessionCount} koşu seansına dayalı`
          : `Based on ${runSessionCount} run sessions`}
      </div>

      {/* Citation */}
      <div style={{ ...S.mono, fontSize: '8px', color: '#333', borderTop: '1px solid var(--border)', paddingTop: '5px', marginTop: '4px' }}>
        ℹ Daniels &amp; Gilbert (1979) — Volume, taper, and quality session model
      </div>
    </div>
  )
}
