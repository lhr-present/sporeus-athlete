import { useContext, useState, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { compareTapers, simulateTaper } from '../../lib/race/taperSimulator.js'

const REC_COLORS = {
  optimal:       '#4caf50',
  under_tapered: '#ff9800',
  over_tapered:  '#f44336',
}

function MiniChart({ projection, raceDate: _raceDate }) {
  if (!projection?.length) return null
  const ctls = projection.map(d => d.projectedCTL)
  const tsbs = projection.map(d => d.projectedTSB)
  const maxV = Math.max(...ctls, 10)
  const minV = Math.min(...tsbs, 0)
  const range = maxV - minV || 1
  const W = 260, H = 60

  const toY = v => H - ((v - minV) / range) * (H - 6) - 3

  const ctlPath = projection.map((d, i) => {
    const x = (i / (projection.length - 1)) * W
    const y = toY(d.projectedCTL)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const tsbPath = projection.map((d, i) => {
    const x = (i / (projection.length - 1)) * W
    const y = toY(d.projectedTSB)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {/* Zero line for TSB */}
      <line x1={0} y1={toY(0)} x2={W} y2={toY(0)} stroke="var(--border)" strokeDasharray="3,3" strokeWidth={1} />
      <path d={ctlPath} fill="none" stroke="#2196f3" strokeWidth={1.5} />
      <path d={tsbPath} fill="none" stroke="#ff9800" strokeWidth={1.5} />
    </svg>
  )
}

export default function TaperSimulator({ log = [], raceDate: propRaceDate }) {
  const { t } = useContext(LangCtx)

  const [raceDateInput, setRaceDateInput] = useState(propRaceDate || '')
  const [taperWeeks, setTaperWeeks]   = useState(2)
  const [volumePct, setVolumePct]     = useState(60)

  const today = new Date().toISOString().slice(0, 10)

  const single = useMemo(() => {
    if (!raceDateInput || raceDateInput <= today) return null
    return simulateTaper({
      currentLog: log,
      raceDate: raceDateInput,
      taperWeeks,
      taperVolumePct: volumePct / 100,
      today,
    })
  }, [log, raceDateInput, taperWeeks, volumePct, today])

  const comparison = useMemo(() => {
    if (!raceDateInput || raceDateInput <= today) return []
    return compareTapers({
      currentLog: log,
      raceDate: raceDateInput,
      options: [1, 2, 3],
      volumePct: volumePct / 100,
      today,
    })
  }, [log, raceDateInput, volumePct, today])

  const recLabel = { optimal: t('taperOptimal') || 'Optimal', under_tapered: t('taperUnder') || 'Under-Tapered', over_tapered: t('taperOver') || 'Over-Tapered' }
  const labelStyle = { fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }
  const valueStyle = { fontSize: 20, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: 'var(--text)' }

  return (
    <div style={{ ...S.card, marginBottom: 16, padding: '16px 20px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
        {t('taperSimulator') || 'Taper Simulator'}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={labelStyle}>Race Date</div>
          <input
            type="date"
            value={raceDateInput}
            min={today}
            onChange={e => setRaceDateInput(e.target.value)}
            style={{ ...S.input, width: 140 }}
          />
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={labelStyle}>{t('taperWeeks') || 'Taper Weeks'}: {taperWeeks}</div>
          <input type="range" min={1} max={4} value={taperWeeks}
            onChange={e => setTaperWeeks(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ff6600' }} />
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={labelStyle}>{t('taperVolume') || 'Taper Volume %'}: {volumePct}%</div>
          <input type="range" min={40} max={85} step={5} value={volumePct}
            onChange={e => setVolumePct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ff6600' }} />
        </div>
      </div>

      {!single && (
        <div style={{ color: 'var(--muted)', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
          Select a future race date to simulate taper scenarios.
        </div>
      )}

      {single && (
        <>
          {/* Current selection result */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={labelStyle}>{t('taperRaceDayTSB') || 'Race-day TSB'}</div>
              <div style={{ ...valueStyle, color: single.raceDayTSB >= 5 && single.raceDayTSB <= 20 ? '#4caf50' : '#ff9800' }}>
                {single.raceDayTSB > 0 ? '+' : ''}{single.raceDayTSB}
              </div>
            </div>
            <div>
              <div style={labelStyle}>{t('taperCTLDrop') || 'CTL Drop'}</div>
              <div style={valueStyle}>{single.ctlDropPct}%</div>
            </div>
            <div>
              <div style={labelStyle}>Recommendation</div>
              <div style={{ ...valueStyle, fontSize: 14, color: REC_COLORS[single.recommendation] }}>
                {recLabel[single.recommendation]}
              </div>
            </div>
          </div>

          {/* Mini chart */}
          <div style={{ marginBottom: 12 }}>
            <MiniChart projection={single.dailyProjection} raceDate={raceDateInput} />
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#2196f3', fontFamily: "'IBM Plex Mono', monospace" }}>— CTL</span>
              <span style={{ fontSize: 10, color: '#ff9800', fontFamily: "'IBM Plex Mono', monospace" }}>— TSB</span>
            </div>
          </div>

          {/* Comparison table */}
          {comparison.length > 0 && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>1–3 Week Comparison ({volumePct}% vol)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {comparison.map(c => c && (
                  <div key={c.taperWeeks} style={{
                    padding: '6px 12px', borderRadius: 4, border: `1px solid ${REC_COLORS[c.recommendation]}55`,
                    background: REC_COLORS[c.recommendation] + '11',
                  }}>
                    <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--muted)' }}>{c.taperWeeks}w</div>
                    <div style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: REC_COLORS[c.recommendation] }}>
                      TSB {c.raceDayTSB > 0 ? '+' : ''}{c.raceDayTSB}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--muted)' }}>
                      {recLabel[c.recommendation]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
        Mujika & Padilla (2003) Med Sci Sports Exerc 35:1182–1187
      </div>
    </div>
  )
}
