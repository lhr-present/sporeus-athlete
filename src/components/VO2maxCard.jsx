// ─── VO₂max / VDOT Card ───────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useData } from '../contexts/DataContext.jsx'
import { vdotFromRace, zonesFromVDOT, raceEquivalents, estimateVO2maxTrend, fmtPaceSec } from '../lib/vo2max.js'
import { cooperVO2 } from '../lib/formulas.js'
import { S } from '../styles.js'

const MONO = "'IBM Plex Mono', monospace"

const RACE_LABELS = {
  1500: '1500m', 1609: 'Mile', 3000: '3 km',
  5000: '5 km', 10000: '10 km', 21097: 'Half Marathon', 42195: 'Marathon',
}
const ZONE_COLORS = { E: '#5bc25b', M: '#4a9eff', T: '#ff6600', I: '#e0a030', R: '#e03030' }
const ZONE_NAMES  = { E: 'Easy', M: 'Marathon', T: 'Threshold', I: 'Interval', R: 'Repetition' }

function fmtTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VO2maxCard() {
  const { log } = useData()

  const [showZones, setShowZones]     = useState(false)
  const [manualVdot, setManualVdot]   = useState(null)
  const [raceInp, setRaceInp]         = useState({ dist: '', hh: '', mm: '', ss: '' })
  const [raceErr, setRaceErr]         = useState('')

  // Read profile once (maxHR, cooperDist)
  const profile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sporeus_profile') || '{}') } catch { return {} }
  }, [])

  const maxHR = parseInt(profile.maxHR || 190)

  // Cooper VO₂max from profile if stored
  const cooperEst = profile.cooperDist ? cooperVO2(parseInt(profile.cooperDist)) : null

  // VDOT trend from run log
  const trend = useMemo(() => estimateVO2maxTrend(log, maxHR), [log, maxHR])

  // Current VDOT: manual > most recent high-confidence > latest any
  const currentVdot = useMemo(() => {
    if (manualVdot !== null) return manualVdot
    if (trend.length === 0) return null
    const best = [...trend].reverse().find(e => e.confidence === 'high') || trend[trend.length - 1]
    return best.vo2max
  }, [trend, manualVdot])

  const zones  = useMemo(() => currentVdot ? zonesFromVDOT(currentVdot)   : null, [currentVdot])
  const equivs = useMemo(() => currentVdot ? raceEquivalents(currentVdot) : null, [currentVdot])

  const handleRaceCalc = () => {
    setRaceErr('')
    const dist = parseFloat(raceInp.dist)
    const sec  = (parseInt(raceInp.hh || 0) * 3600) + (parseInt(raceInp.mm || 0) * 60) + parseInt(raceInp.ss || 0)
    if (!dist || dist <= 0) { setRaceErr('Enter a valid distance in metres.'); return }
    if (!sec  || sec  <= 0) { setRaceErr('Enter a valid finish time.'); return }
    const v = vdotFromRace(dist, sec)
    if (v === null) { setRaceErr('Duration out of range (3.5–240 min) for Daniels formula.'); return }
    setManualVdot(Math.round(v * 10) / 10)
  }

  const confColor = (c) => c === 'high' ? '#ff6600' : c === 'medium' ? '#e0a030' : '#555'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay: '120ms' }}>
      <div style={S.cardTitle}>VO₂MAX / VDOT ENGINE</div>

      {/* ── Summary badges ── */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
        {currentVdot ? (
          <div>
            <div style={{ fontFamily: MONO, fontSize: '34px', fontWeight: 700, color: '#ff6600', lineHeight: 1 }}>
              {currentVdot}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.1em', marginTop: '4px' }}>
              VDOT (mL/kg/min)
            </div>
            {manualVdot !== null && (
              <div style={{ fontFamily: MONO, fontSize: '9px', color: '#5bc25b', marginTop: '4px' }}>
                ✓ from race input
              </div>
            )}
            {manualVdot === null && trend.length > 0 && (
              <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginTop: '4px' }}>
                {(() => {
                  const best = [...trend].reverse().find(e => e.confidence === 'high') || trend[trend.length - 1]
                  return `${best.method} · ${best.date}`
                })()}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#555', lineHeight: 1.6 }}>
            No VDOT estimate yet.<br/>
            Import runs (≥20 min) or enter a race result below.
          </div>
        )}

        {cooperEst && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: '24px', fontWeight: 700, color: '#0064ff', lineHeight: 1 }}>
              {cooperEst}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#555', letterSpacing: '0.1em', marginTop: '4px' }}>
              COOPER VO₂max
            </div>
          </div>
        )}
      </div>

      {/* ── 52-week trend chart ── */}
      {trend.length >= 2 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
            52-WEEK VDOT TREND
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#555', fontSize: 8, fontFamily: MONO }}
                tickFormatter={d => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#555', fontSize: 8, fontFamily: MONO }}
                width={28}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #2a2a2a', fontFamily: MONO, fontSize: '10px' }}
                labelStyle={{ color: '#777' }}
                formatter={(val, _name, props) => [
                  `${val} mL/kg/min`,
                  `${props.payload.method} (${props.payload.confidence})`,
                ]}
              />
              <Line
                type="monotone"
                dataKey="vo2max"
                stroke="#ff6600"
                strokeWidth={2}
                dot={({ cx, cy, payload }) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3}
                    fill={confColor(payload.confidence)}
                    stroke="#0a0a0a" strokeWidth={1}
                  />
                )}
                activeDot={{ r: 4, fill: '#ff6600' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontFamily: MONO, fontSize: '8px', color: '#444', marginTop: '4px' }}>
            <span style={{ color: '#ff6600' }}>●</span> race-based ·{' '}
            <span style={{ color: '#e0a030' }}>●</span> pace-based ·{' '}
            <span style={{ color: '#555' }}>●</span> HR-based
          </div>
        </div>
      )}

      {/* ── Race equivalents ── */}
      {equivs && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
            RACE EQUIVALENTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
            {Object.entries(equivs).map(([d, eq]) => {
              if (!eq) return null
              return (
                <div key={d} style={{
                  background: '#0d0d0d', border: '1px solid #1e1e1e',
                  borderRadius: '4px', padding: '8px 10px',
                }}>
                  <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', marginBottom: '3px' }}>
                    {RACE_LABELS[d] || `${(d / 1000).toFixed(0)} km`}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 700, color: '#eee' }}>
                    {fmtTime(eq.time)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', marginTop: '2px' }}>
                    {fmtPaceSec(eq.pace)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Training zones (collapsible) ── */}
      {zones && (
        <div style={{ marginBottom: '18px' }}>
          <button
            onClick={() => setShowZones(v => !v)}
            style={{
              fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em',
              background: 'transparent', border: '1px solid #2a2a2a',
              borderRadius: '3px', color: '#888', cursor: 'pointer',
              padding: '4px 10px', marginBottom: '8px',
            }}
          >
            {showZones ? '▲' : '▼'} TRAINING ZONES (Daniels)
          </button>
          {showZones && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {Object.entries(zones).map(([zone, { low, high }]) => (
                <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    fontFamily: MONO, fontSize: '11px', fontWeight: 700,
                    color: ZONE_COLORS[zone], width: '18px', flexShrink: 0,
                  }}>{zone}</div>
                  <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666', width: '70px', flexShrink: 0 }}>
                    {ZONE_NAMES[zone]}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '11px', color: '#ccc', flexShrink: 0 }}>
                    {fmtPaceSec(low)} – {fmtPaceSec(high)}
                  </div>
                  <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: '60%',
                      background: ZONE_COLORS[zone], opacity: 0.45, borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Update from recent race ── */}
      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '14px' }}>
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555', letterSpacing: '0.1em', marginBottom: '10px' }}>
          UPDATE FROM RECENT RACE
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={S.label}>DISTANCE (m)</label>
            <input
              style={{ ...S.input, maxWidth: '110px' }}
              type="number" placeholder="5000" min="100"
              value={raceInp.dist}
              onChange={e => setRaceInp(p => ({ ...p, dist: e.target.value }))}
            />
          </div>
          <div>
            <label style={S.label}>HH</label>
            <input
              style={{ ...S.input, maxWidth: '56px' }}
              type="number" placeholder="0" min="0"
              value={raceInp.hh}
              onChange={e => setRaceInp(p => ({ ...p, hh: e.target.value }))}
            />
          </div>
          <div>
            <label style={S.label}>MM</label>
            <input
              style={{ ...S.input, maxWidth: '56px' }}
              type="number" placeholder="20" min="0" max="59"
              value={raceInp.mm}
              onChange={e => setRaceInp(p => ({ ...p, mm: e.target.value }))}
            />
          </div>
          <div>
            <label style={S.label}>SS</label>
            <input
              style={{ ...S.input, maxWidth: '56px' }}
              type="number" placeholder="0" min="0" max="59"
              value={raceInp.ss}
              onChange={e => setRaceInp(p => ({ ...p, ss: e.target.value }))}
            />
          </div>
          <button
            onClick={handleRaceCalc}
            style={{
              fontFamily: MONO, fontSize: '10px', fontWeight: 700,
              padding: '8px 16px', background: '#ff6600', border: 'none',
              color: '#fff', borderRadius: '4px', cursor: 'pointer',
              letterSpacing: '0.06em', marginBottom: '14px',
            }}
          >
            CALCULATE
          </button>
          {manualVdot !== null && (
            <button
              onClick={() => { setManualVdot(null); setRaceInp({ dist: '', hh: '', mm: '', ss: '' }) }}
              style={{
                fontFamily: MONO, fontSize: '9px', padding: '8px 10px',
                background: 'transparent', border: '1px solid #333',
                color: '#555', borderRadius: '4px', cursor: 'pointer',
                marginBottom: '14px',
              }}
            >
              RESET
            </button>
          )}
        </div>
        {raceErr && (
          <div style={{ fontFamily: MONO, fontSize: '10px', color: '#e03030', marginTop: '2px' }}>{raceErr}</div>
        )}
        {manualVdot !== null && (
          <div style={{ fontFamily: MONO, fontSize: '11px', color: '#5bc25b', marginTop: '4px' }}>
            ✓ VDOT = {manualVdot} — zones and race times updated above
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#333', lineHeight: 1.7, marginTop: '10px' }}>
          Daniels (1998) polynomial · valid 3.5–240 min · pace zones per Daniels Running Formula
        </div>
      </div>
    </div>
  )
}
