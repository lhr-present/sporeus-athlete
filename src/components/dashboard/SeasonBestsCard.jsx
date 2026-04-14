import { useMemo } from 'react'
import { S } from '../../styles.js'

const SEASON_DAYS = 365
const MS_PER_DAY  = 86400000

function fmtPace(minPerKm) {
  if (!isFinite(minPerKm) || minPerKm <= 0) return '—'
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

function fmtDuration(min) {
  if (!min || !isFinite(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtSplit(min) {
  // 500m split in m:ss from total duration over 2000m
  if (!min || !isFinite(min)) return '—'
  const splitMin = min / 4         // 500m split from 2000m time
  const m = Math.floor(splitMin)
  const s = Math.round((splitMin - m) * 60)
  return `${m}:${s.toString().padStart(2, '0')} /500m`
}

export default function SeasonBestsCard({ log, dl }) {
  if (!dl.seasonbests) return null

  const { bests, hasEnough } = useMemo(() => {
    if (log.length < 2) return { bests: [], hasEnough: false }

    const cutoff = new Date(Date.now() - SEASON_DAYS * MS_PER_DAY).toISOString().slice(0, 10)
    const season = log.filter(e => e.date >= cutoff)
    if (!season.length) return { bests: [], hasEnough: false }

    const today = new Date().toISOString().slice(0, 10)
    const recent30 = new Date(Date.now() - 30 * MS_PER_DAY).toISOString().slice(0, 10)

    // 1. Fastest run pace (min/km) — lower is better
    let bestPace     = null
    let bestPaceDate = null
    season.forEach(e => {
      const isRun = e.sessionType?.toLowerCase().includes('run') ||
                    e.sport?.toLowerCase() === 'running' ||
                    e.discipline?.toLowerCase() === 'running'
      if (!isRun) return
      if (!e.duration || !e.distance || e.distance <= 0) return
      const pace = e.duration / e.distance   // min/km (duration in min, distance in km)
      if (bestPace === null || pace < bestPace) {
        bestPace = pace
        bestPaceDate = e.date
      }
    })

    // 2. Highest single TSS
    let bestTSS     = null
    let bestTSSDate = null
    season.forEach(e => {
      if (!e.tss || e.tss <= 0) return
      if (bestTSS === null || e.tss > bestTSS) {
        bestTSS = e.tss
        bestTSSDate = e.date
      }
    })

    // 3. Longest ride duration
    let bestRide     = null
    let bestRideDate = null
    season.forEach(e => {
      const isCycle = e.sessionType?.toLowerCase().includes('ride') ||
                      e.sessionType?.toLowerCase().includes('cycling') ||
                      e.sport?.toLowerCase() === 'cycling' ||
                      e.discipline?.toLowerCase() === 'cycling'
      if (!isCycle) return
      if (!e.duration || e.duration <= 0) return
      if (bestRide === null || e.duration > bestRide) {
        bestRide = e.duration
        bestRideDate = e.date
      }
    })

    // 4. Best 2000m erg split — lowest duration for rowing entries near 2000m
    let bestErg     = null
    let bestErgDate = null
    season.forEach(e => {
      const isRow = e.sessionType?.toLowerCase().includes('row') ||
                    e.sport?.toLowerCase() === 'rowing' ||
                    e.discipline?.toLowerCase() === 'rowing'
      if (!isRow) return
      if (!e.duration || e.duration <= 0) return
      const dist = e.distance || 0
      if (dist < 1.8 || dist > 2.2) return   // approx 2000m (km)
      if (bestErg === null || e.duration < bestErg) {
        bestErg = e.duration
        bestErgDate = e.date
      }
    })

    const rows = [
      {
        metric: 'Fastest Run Pace',
        value:  bestPace ? fmtPace(bestPace) : null,
        date:   bestPaceDate,
        isPB:   bestPaceDate && bestPaceDate >= recent30,
      },
      {
        metric: 'Highest TSS',
        value:  bestTSS ? `${Math.round(bestTSS)} TSS` : null,
        date:   bestTSSDate,
        isPB:   bestTSSDate && bestTSSDate >= recent30,
      },
      {
        metric: 'Longest Ride',
        value:  bestRide ? fmtDuration(bestRide) : null,
        date:   bestRideDate,
        isPB:   bestRideDate && bestRideDate >= recent30,
      },
      {
        metric: '2000m Erg Split',
        value:  bestErg ? fmtSplit(bestErg) : null,
        date:   bestErgDate,
        isPB:   bestErgDate && bestErgDate >= recent30,
      },
    ]

    const populated = rows.filter(r => r.value !== null)
    return { bests: populated, hasEnough: populated.length > 0 }
  }, [log])

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>SEASON BESTS · LAST 12 MONTHS</div>

      {!hasEnough ? (
        <div style={{ ...S.mono, fontSize: '12px', color: '#888', textAlign: 'center', padding: '16px 0' }}>
          Log more sessions to detect season bests
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Metric', 'Best', 'Date', ''].map(h => (
                <th key={h} style={{ ...S.mono, fontSize: '10px', color: '#555', fontWeight: 600, textAlign: 'left', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bests.map(({ metric, value, date, isPB }, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...S.mono, fontSize: '11px', color: '#aaa', padding: '7px 0' }}>{metric}</td>
                <td style={{ ...S.mono, fontSize: '12px', fontWeight: 700, color: '#ff6600', padding: '7px 8px' }}>{value}</td>
                <td style={{ ...S.mono, fontSize: '10px', color: '#666', padding: '7px 0' }}>{date || '—'}</td>
                <td style={{ padding: '7px 0', textAlign: 'right', fontSize: '13px' }}>
                  {isPB ? '🏆' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
