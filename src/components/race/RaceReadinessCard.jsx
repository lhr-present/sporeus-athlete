import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeReadinessScore } from '../../lib/race/readinessScore.js'
import { calcLoad } from '../../lib/formulas.js'

const ZONE_COLORS = {
  peaked:            '#2196f3',
  ready:             '#4caf50',
  needs_work:        '#ff9800',
  overreached:       '#f44336',
  insufficient_data: 'var(--muted)',
}

const SCORE_ARCS = { peaked: '#2196f3', ready: '#4caf50', needs_work: '#ff9800', overreached: '#f44336' }

function ScoreDial({ score, classification }) {
  const r   = 44
  const cx  = 56, cy = 56
  const circ = 2 * Math.PI * r
  const pct  = (score || 0) / 100
  const dash = pct * circ
  const color = SCORE_ARCS[classification] || '#888'

  return (
    <svg width={112} height={112} role="img" aria-label={`Readiness score: ${score}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color}
        style={{ fontSize: 26, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
        {score ?? '—'}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--muted)"
        style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
        /100
      </text>
    </svg>
  )
}

function ComponentBar({ comp, t: _t }) {
  const color = comp.available ? ZONE_COLORS.ready : 'var(--border)'
  const pct   = comp.available ? Math.round((comp.value || 0)) : 0

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: comp.available ? 'var(--text)' : 'var(--muted)' }}>
          {comp.name.replace('_', ' ')}
        </span>
        <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--muted)' }}>
          {comp.available ? `${Math.round(comp.value)}` : (comp.reason?.replace(/_/g, ' ') || 'unavailable')}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 2, height: 4 }}>
        <div style={{ width: `${pct}%`, height: 4, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export default function RaceReadinessCard({ log = [], profile = {}, raceDate }) {
  const { lang: _lang, t } = useContext(LangCtx)

  const result = useMemo(() => {
    const load = calcLoad(log)
    const { ctl, tsb } = load

    // peak CTL in last 30 days
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const peakCtl30d = load.daily
      ? Math.max(...load.daily.filter(d => d.date >= cutoff).map(d => d.ctl), ctl)
      : null

    const today = new Date().toISOString().slice(0, 10)

    return computeReadinessScore({
      ctl, tsb,
      peakCtl30d: peakCtl30d > 0 ? peakCtl30d : null,
      hrv7dMean:   profile.hrv7dMean   ?? null,
      hrv28dMean:  profile.hrv28dMean  ?? null,
      hrv28dSd:    profile.hrv28dSd    ?? null,
      sleep7dMean: profile.sleep7dMean ?? null,
      subjective:  profile.subjective  ?? null,
      raceDate,
      today,
    })
  }, [log, profile, raceDate])

  const classLabel = {
    peaked:            t('raceReadinessPeaked')     || 'Peaked',
    ready:             t('raceReadinessReady')      || 'Ready',
    needs_work:        t('raceReadinessNeedsWork')  || 'Needs Work',
    overreached:       t('raceReadinessOverreached')|| 'Overreached',
    insufficient_data: t('raceReadinessInsufficient') || 'Insufficient Data',
  }

  const daysToRace = raceDate
    ? Math.max(0, Math.round((new Date(raceDate) - new Date()) / 86400000))
    : null

  const color = ZONE_COLORS[result.classification]

  return (
    <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {t('raceReadiness') || 'Race Readiness'}
        </span>
        <span style={{
          padding: '2px 10px', borderRadius: 4, fontSize: 12,
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
          background: color + '22', color, border: `1px solid ${color}55`,
        }}>
          {classLabel[result.classification]}
        </span>
      </div>

      {result.classification === 'insufficient_data' ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", padding: '8px 0' }}>
          {t('raceReadinessInsufficientMsg') || 'Need at least CTL and TSB — log more sessions to unlock'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <ScoreDial score={result.score} classification={result.classification} />
            <div>
              {daysToRace !== null && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text)' }}>
                    {daysToRace}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", marginLeft: 6 }}>
                    {t('raceReadinessDaysTo') || 'days to race'}
                  </span>
                </div>
              )}
              {result.missingWeight > 0 && (
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {Math.round(result.missingWeight * 100)}% data missing — score re-normalised
                </div>
              )}
            </div>
          </div>

          {/* Component bars */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('raceReadinessComponents') || 'Components'}
            </div>
            {result.components.map(c => <ComponentBar key={c.name} comp={c} t={t} />)}
          </div>

          {/* Top drivers */}
          {result.topDrivers?.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4, textTransform: 'uppercase' }}>
                {t('raceReadinessTopDrivers') || 'Top Drivers'}
              </div>
              {result.topDrivers.map(d => (
                <div key={d.name} style={{ fontSize: 11, color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>
                  · {d.name.replace('_', ' ')}: {Math.round(d.value)}/100 ({Math.round(d.contribution)} pts)
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Citation */}
      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        {result.citation}
      </div>
    </div>
  )
}
