// ─── OSTRCMonitorCard.jsx — OSTRC Injury Monitor (E27) ────────────────────────
// Reads history via parseOSTRCHistory() — no props needed.
// Returns null if computeOSTRCSummary returns null (< 2 entries).
// Reference: Clarsen et al. (2013) Br J Sports Med
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { parseOSTRCHistory, computeOSTRCSummary } from '../../lib/athlete/ostrcSummary.js'

const RISK_COLORS = {
  none:        '#5bc25b',
  minor:       '#f5c542',
  moderate:    '#ff6600',
  substantial: '#e03030',
}

const RISK_KEYS = {
  none:        'ostrcNone',
  minor:       'ostrcMinor',
  moderate:    'ostrcModerate',
  substantial: 'ostrcSubstantial',
}

export default function OSTRCMonitorCard() {
  const { t } = useContext(LangCtx)

  const history = parseOSTRCHistory()
  const summary = computeOSTRCSummary(history)

  // Insufficient data — render placeholder
  if (!summary) {
    return (
      <div className="sp-card" style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '16px', marginBottom: '16px',
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600',
          marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px',
        }}>
          ◈ {t('ostrcTitle')}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
          color: 'var(--muted)', lineHeight: 1.6,
        }}>
          {t('ostrcNeeded')}
        </div>
      </div>
    )
  }

  const { latest, trend, analysis, citation } = summary

  const riskColor = RISK_COLORS[latest.risk] || '#888'
  const riskKey   = RISK_KEYS[latest.risk]   || 'ostrcNone'

  const trendColor = trend === 'worsening' ? '#e03030'
    : trend === 'improving' ? '#5bc25b'
    : '#888'

  const trendArrow = trend === 'worsening' ? '↑'
    : trend === 'improving' ? '↓'
    : '→'

  const trendKey = trend === 'worsening' ? 'ostrcWorsening'
    : trend === 'improving' ? 'ostrcImproving'
    : null

  // SVG timeline dots — 200×30px
  const SVG_W   = 200
  const SVG_H   = 30
  const DOT_R   = 5
  const PAD     = 10
  const n       = analysis.length
  const spacing = n > 1 ? (SVG_W - 2 * PAD) / (n - 1) : 0

  return (
    <div className="sp-card" style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '16px', marginBottom: '16px',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600',
        marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px',
      }}>
        ◈ {t('ostrcTitle')}
      </div>

      {/* Risk badge + score + trend badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {/* Risk badge */}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          background: riskColor + '22', color: riskColor,
          border: `1px solid ${riskColor}55`, borderRadius: '3px', padding: '3px 9px',
        }}>
          {t(riskKey)}
        </span>

        {/* Score value */}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700,
          color: riskColor, letterSpacing: '0.04em',
        }}>
          {latest.score} / 100
        </span>

        {/* Trend badge — omit if null */}
        {trend && trendKey && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600,
            color: trendColor, letterSpacing: '0.06em',
          }}>
            {trendArrow} {t(trendKey)}
          </span>
        )}
      </div>

      {/* Timeline dots SVG */}
      <svg
        width={SVG_W} height={SVG_H}
        style={{ display: 'block', overflow: 'visible', marginBottom: '10px' }}
        aria-label="OSTRC timeline"
      >
        {/* Connecting line */}
        {n > 1 && (
          <line
            x1={PAD} y1={SVG_H / 2}
            x2={PAD + (n - 1) * spacing} y2={SVG_H / 2}
            stroke="var(--border)" strokeWidth="1"
          />
        )}

        {/* Dots */}
        {analysis.map((entry, i) => {
          const cx      = n === 1 ? SVG_W / 2 : PAD + i * spacing
          const cy      = SVG_H / 2
          const color   = RISK_COLORS[entry.risk] || '#888'
          const isLatest = i === n - 1
          return (
            <g key={`${entry.week}-${i}`}>
              {isLatest && (
                <circle cx={cx} cy={cy} r={DOT_R + 3} fill={color + '33'} />
              )}
              <circle cx={cx} cy={cy} r={DOT_R} fill={color} />
            </g>
          )
        })}
      </svg>

      {/* Citation */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
        color: '#333', letterSpacing: '0.04em', marginTop: '4px',
      }}>
        {citation}
      </div>
    </div>
  )
}
