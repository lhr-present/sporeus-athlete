// ─── IntervalBreakdown.jsx — Zone-sorted interval cards ─────────────────────
import { S } from '../styles.js'

const MONO = "'IBM Plex Mono', monospace"

const ZONE_COLORS = {
  Z1: '#555', Z2: '#5bc25b', Z3: '#f5c542', Z4: '#ff6600', Z5: '#e03030', Z6: '#cc44ff',
}

function fmtSec(s) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m${r}s` : `${m}m`
}

export default function IntervalBreakdown({ intervals, cp }) {
  if (!intervals || intervals.length === 0) return null

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: '6px' }}>
        INTERVALS ({intervals.length}) · sorted by avg power
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {intervals.slice(0, 12).map((intv, i) => {
          const color = ZONE_COLORS[intv.zone] || '#888'
          const pct   = cp ? Math.round(intv.avgPower / cp * 100) : null
          return (
            <div key={i} style={{
              display: 'flex', gap: '10px', alignItems: 'center',
              padding: '5px 8px', borderRadius: '3px',
              background: 'var(--surface)',
              border: `1px solid ${color}33`,
              flexWrap: 'wrap',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color, fontWeight: 700, minWidth: '24px' }}>
                {intv.zone}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#aaa', minWidth: '40px' }}>
                {fmtSec(intv.durationSec)}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#ddd' }}>
                {intv.avgPower}W avg
              </span>
              {intv.np !== intv.avgPower && (
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#888' }}>
                  {intv.np}W NP
                </span>
              )}
              {pct !== null && (
                <span style={{ fontFamily: MONO, fontSize: 9, color: color + 'cc' }}>
                  {pct}% CP
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
