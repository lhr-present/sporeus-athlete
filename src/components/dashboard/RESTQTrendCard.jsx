// ─── RESTQTrendCard.jsx — RESTQ Stress/Recovery Ratio Trend ──────────────────
// Reads history from localStorage 'sporeus-restq-history'; no props needed.
// Based on Kellmann & Kallus (2001) and Nederhof et al. (2008)
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { parseRESTQHistory, computeRESTQTrend } from '../../lib/athlete/restqTrend.js'

const STATUS_COLORS = {
  danger:  '#e03030',
  warning: '#f5c542',
  ok:      '#5bc25b',
  good:    '#00bcd4',
}

const TREND_ARROW = {
  improving: '↑',
  stable:    '→',
  declining: '↓',
}

export default function RESTQTrendCard() {
  const { t, lang } = useContext(LangCtx)

  const history  = parseRESTQHistory()
  const { latest, trend, analysis, citation } = computeRESTQTrend(history)

  // Need ≥2 entries in analysis to render
  if (analysis.length < 2) {
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
          ◈ {t('restqTitle')}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
          color: 'var(--muted)', lineHeight: 1.6,
        }}>
          {t('restqNeeded')}
        </div>
      </div>
    )
  }

  const statusColor  = STATUS_COLORS[latest.status] || '#888'
  const statusKey    = {
    danger:  'restqDanger',
    warning: 'restqWarning',
    ok:      'restqOk',
    good:    'restqGood',
  }[latest.status] || 'restqOk'

  const trendArrow = trend ? TREND_ARROW[trend] : '—'
  const trendColor = trend === 'improving' ? '#5bc25b' : trend === 'declining' ? '#e03030' : '#f5c542'
  const trendLabel = trend
    ? (lang === 'tr'
        ? { improving: 'GELİŞİYOR', stable: 'STABİL', declining: 'DÜŞÜYOR' }[trend]
        : trend.toUpperCase())
    : '—'

  // SVG timeline dots — 200×40px, dots spaced evenly, colored by status
  const SVG_W = 200
  const SVG_H = 40
  const DOT_R = 5
  const PAD   = 12
  const n     = analysis.length
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
        ◈ {t('restqTitle')}
      </div>

      {/* Status badge + SR ratio row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {/* Status badge */}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          background: statusColor + '22', color: statusColor,
          border: `1px solid ${statusColor}55`, borderRadius: '3px', padding: '3px 9px',
        }}>
          {t(statusKey)}
        </span>

        {/* SR ratio value */}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700,
          color: statusColor, letterSpacing: '0.04em',
        }}>
          {t('restqSrRatio')}: {latest.srRatio !== null ? latest.srRatio.toFixed(2) : '—'}
        </span>

        {/* Trend arrow + label */}
        {trend && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600,
            color: trendColor, letterSpacing: '0.06em',
          }}>
            {trendArrow} {trendLabel}
          </span>
        )}
      </div>

      {/* Timeline dots SVG */}
      <svg
        width={SVG_W} height={SVG_H}
        style={{ display: 'block', overflow: 'visible', marginBottom: '10px' }}
        aria-label="RESTQ timeline"
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
          const cx = n === 1 ? SVG_W / 2 : PAD + i * spacing
          const cy = SVG_H / 2
          const color = STATUS_COLORS[entry.status] || '#888'
          const isLatest = i === n - 1
          return (
            <g key={entry.date}>
              {isLatest && (
                <circle cx={cx} cy={cy} r={DOT_R + 3} fill={color + '33'} />
              )}
              <circle cx={cx} cy={cy} r={DOT_R} fill={color} />
              <text
                x={cx} y={cy + DOT_R + 9}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', monospace"
                fontSize="7"
                fill="var(--muted)"
              >
                {entry.date.slice(5)} {/* MM-DD */}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Citation */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
        color: '#555', letterSpacing: '0.04em', marginTop: '4px',
      }}>
        {citation}
      </div>
    </div>
  )
}
