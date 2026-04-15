// ─── PowerCurve.jsx — Season best + activity MMP with CP model overlay ───────
import { useState, useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { useData } from '../contexts/DataContext.jsx'
import { S } from '../styles.js'
import { calculateMMP, fitCriticalPower, detectIntervals, estimateFTP, KEY_DURATIONS } from '../lib/powerAnalysis.js'
import IntervalBreakdown from './IntervalBreakdown.jsx'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'

// ── Duration formatters ───────────────────────────────────────────────────────
function fmtDur(s) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m${r}s` : `${m}m`
}

// X-axis ticks: log2 scale positions at clean durations
const TICK_DURS = [1, 5, 30, 60, 300, 600, 1200, 1800, 3600]
const log2      = d => Math.log2(Math.max(1, d))
const ticks     = TICK_DURS.map(log2)

// ── Load stored power stream for a log entry ─────────────────────────────────
function loadStream(id) {
  try {
    const raw = localStorage.getItem('sporeus-power-' + id)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function PowerTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const dur = Math.round(Math.pow(2, label))
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px',
      padding: '6px 10px', fontFamily: MONO, fontSize: 10,
    }}>
      <div style={{ color: '#888', marginBottom: 3 }}>{fmtDur(dur)}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Math.round(p.value * 10) / 10}W
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PowerCurve() {
  const { log, profile } = useData()
  const [selectedId, setSelectedId] = useState('')

  const cp        = parseInt(profile?.cp)     || 0
  const wPrimeCap = parseInt(profile?.wPrime) || 0

  // Entries that have stored power streams
  const powerEntries = useMemo(
    () => log.filter(e => e.hasPower && loadStream(e.id)),
    [log]
  )

  // Season-best MMP: max per duration across all power entries (last 365 days)
  const seasonBest = useMemo(() => {
    if (powerEntries.length === 0) return []
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1)
    const recent = powerEntries.filter(e => new Date(e.date) >= cutoff).slice(-30)
    const best = {}
    for (const entry of recent) {
      const stream = loadStream(entry.id)
      if (!stream) continue
      for (const pt of calculateMMP(stream)) {
        if (!best[pt.duration] || pt.power > best[pt.duration]) best[pt.duration] = pt.power
      }
    }
    return Object.entries(best)
      .map(([d, p]) => ({ duration: parseInt(d), power: p }))
      .sort((a, b) => a.duration - b.duration)
  }, [powerEntries])

  // Selected activity MMP
  const activityData = useMemo(() => {
    if (!selectedId) return { mmp: null, stream: null }
    const stream = loadStream(parseInt(selectedId))
    if (!stream) return { mmp: null, stream: null }
    return { mmp: calculateMMP(stream), stream }
  }, [selectedId])

  // CP model: from profile CP+W' if set, else fit from season best
  const modelFit = useMemo(() => {
    if (cp && wPrimeCap) return { cp, wPrime: wPrimeCap, r2: null, source: 'profile' }
    if (seasonBest.length >= 3) {
      const fit = fitCriticalPower(seasonBest)
      return fit ? { ...fit, source: 'fitted' } : null
    }
    return null
  }, [cp, wPrimeCap, seasonBest])

  // Estimated FTP from season best
  const estFTP = useMemo(() => estimateFTP(seasonBest), [seasonBest])

  // Detected intervals for selected activity
  const intervals = useMemo(() => {
    if (!activityData.stream || !cp) return []
    return detectIntervals(activityData.stream, cp)
  }, [activityData.stream, cp])

  // Build chart data: merge season best + activity + model on shared X log-scale
  const chartData = useMemo(() => {
    if (seasonBest.length === 0 && !activityData.mmp) return []
    const durSet = new Set([
      ...seasonBest.map(p => p.duration),
      ...(activityData.mmp || []).map(p => p.duration),
    ])
    const seasonMap  = Object.fromEntries(seasonBest.map(p => [p.duration, p.power]))
    const activityMap = Object.fromEntries((activityData.mmp || []).map(p => [p.duration, p.power]))

    return [...durSet]
      .sort((a, b) => a - b)
      .map(d => ({
        x:        log2(d),
        duration: d,
        season:   seasonMap[d]   ?? null,
        activity: activityMap[d] ?? null,
        model:    modelFit ? Math.round(modelFit.cp + modelFit.wPrime / d) : null,
      }))
  }, [seasonBest, activityData.mmp, modelFit])

  const hasSomeData = powerEntries.length > 0

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '120ms' }}>
      <div style={S.cardTitle}>POWER CURVE</div>

      {!hasSomeData ? (
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#555', padding: '8px 0' }}>
          Import a .FIT file with power data in Training Log to build your power curve.
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {estFTP && (
              <div style={{
                fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: '2px',
                border: `1px solid ${ORANGE}44`, color: ORANGE,
              }}>
                FTP est. {estFTP}W
              </div>
            )}
            {modelFit && (
              <div style={{
                fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: '2px',
                border: '1px solid #33333366', color: '#888',
              }}>
                CP {modelFit.cp}W · W′ {(modelFit.wPrime / 1000).toFixed(1)}kJ
                {modelFit.source === 'fitted' && modelFit.r2 != null && (
                  <span style={{ color: '#555' }}> · r² {modelFit.r2.toFixed(2)}</span>
                )}
                {modelFit.source === 'profile' && (
                  <span style={{ color: '#555' }}> · from profile</span>
                )}
              </div>
            )}
          </div>

          {/* Activity selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>ACTIVITY:</span>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{ ...S.input, width: 'auto', fontSize: 10, padding: '3px 6px' }}
            >
              <option value="">— season best only —</option>
              {powerEntries.slice().reverse().map(e => (
                <option key={e.id} value={String(e.id)}>
                  {e.date} · {e.type}
                </option>
              ))}
            </select>
          </div>

          {/* Power curve chart */}
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, log2(10800)]}
                  ticks={ticks}
                  tickFormatter={v => fmtDur(Math.round(Math.pow(2, v)))}
                  tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }}
                />
                <YAxis
                  tick={{ fontFamily: MONO, fontSize: 9, fill: '#555' }}
                  domain={['auto', 'auto']}
                  unit="W"
                />
                <Tooltip content={<PowerTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: MONO, fontSize: 9, paddingTop: 4 }}
                />
                <Line
                  type="monotone" dataKey="season" name="Season best"
                  stroke={ORANGE} strokeWidth={2} dot={false}
                  connectNulls isAnimationActive={false}
                />
                {selectedId && (
                  <Line
                    type="monotone" dataKey="activity" name="Activity"
                    stroke={BLUE} strokeWidth={1.5} dot={false}
                    connectNulls isAnimationActive={false}
                  />
                )}
                {modelFit && (
                  <Line
                    type="monotone" dataKey="model" name="CP model"
                    stroke="#555" strokeWidth={1} strokeDasharray="4 2"
                    dot={false} connectNulls isAnimationActive={false}
                  />
                )}
                {cp > 0 && (
                  <ReferenceLine
                    y={cp} stroke="#ff660044" strokeDasharray="6 3"
                    label={{ value: `CP ${cp}W`, fill: '#ff660099', fontSize: 9, fontFamily: MONO }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Season activities count */}
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#444', marginTop: 4 }}>
            {powerEntries.length} power {powerEntries.length === 1 ? 'activity' : 'activities'} · curve uses last 12 months
          </div>

          {/* Interval breakdown for selected activity */}
          {selectedId && cp > 0 && intervals.length > 0 && (
            <IntervalBreakdown intervals={intervals} cp={cp} />
          )}
        </>
      )}
    </div>
  )
}
