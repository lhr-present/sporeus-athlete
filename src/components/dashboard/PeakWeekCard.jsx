import { useMemo } from 'react'
import { S } from '../../styles.js'
import { simulateBanister } from '../../lib/sport/simulation.js'
import { calcLoad } from '../../lib/formulas.js'

export default function PeakWeekCard({ log, dl }) {
  const result = useMemo(() => {
    if (!dl.peakweek || log.length < 14) return null

    const { ctl, atl } = calcLoad(log)

    // Build last 28 days of TSS seed (fill missing dates with 0)
    const today = new Date()
    const seed = []
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const entry = log.find(e => e.date === ds)
      seed.push(entry ? (entry.tss || 0) : 0)
    }

    const avgDailyTSS = seed.reduce((s, v) => s + v, 0) / 28
    const proj = Array(14).fill(avgDailyTSS)

    const trace = simulateBanister([...seed, ...proj], ctl, atl)

    // Find peak TSB in projected 14 days (indices 28-41)
    let peakIdx = 28
    let peakTSB = trace[28]?.TSB ?? 0
    for (let i = 29; i < 42 && i < trace.length; i++) {
      if (trace[i].TSB > peakTSB) {
        peakTSB = trace[i].TSB
        peakIdx = i
      }
    }

    // peakDayFromNow: index 28 = tomorrow (day 1 from now), index 27 = today
    const peakDayFromNow = peakIdx - 27

    return { peakDayFromNow, projectedPeakTSB: Math.round(peakTSB * 10) / 10 }
  }, [log, dl.peakweek])

  if (!dl.peakweek || log.length < 14 || !result) return null

  const { peakDayFromNow, projectedPeakTSB } = result
  const isNow = peakDayFromNow <= 0
  const tsbColor = projectedPeakTSB >= 0 ? '#5bc25b' : '#f5c542'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '0ms' }}>
      <div style={S.cardTitle}>PEAK FORM PREDICTOR</div>
      {isNow ? (
        <div style={{ ...S.mono, fontSize: '22px', fontWeight: 700, color: '#5bc25b', marginBottom: '8px' }}>
          Peak form: NOW
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ ...S.mono, fontSize: '12px', color: '#888' }}>Peak form in</span>
          <span style={{ ...S.mono, fontSize: '36px', fontWeight: 700, color: 'var(--text)' }}>
            {peakDayFromNow}
          </span>
          <span style={{ ...S.mono, fontSize: '12px', color: '#888' }}>days</span>
        </div>
      )}
      <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>
        Projected TSB{' '}
        <span style={{ color: tsbColor, fontWeight: 600 }}>
          {projectedPeakTSB >= 0 ? '+' : ''}{projectedPeakTSB}
        </span>
        {' '}at 14-day horizon
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: '#555', marginTop: '6px' }}>
        Based on avg daily TSS · Banister impulse-response model
      </div>
    </div>
  )
}
