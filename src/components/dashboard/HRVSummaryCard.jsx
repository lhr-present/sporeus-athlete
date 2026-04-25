// ─── HRVSummaryCard.jsx — HRV Summary Dashboard Card (E28) ───────────────────
// Compact card: 28-day lnRMSSD baseline, current deviation, suppression alert,
// 14-dot SVG chart. References: Plews 2012, Kiviniemi 2007.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeHRVSummary } from '../../lib/athlete/hrvSummary.js'

const MONO = "'IBM Plex Mono', monospace"

function dotColor(hrv, baseline) {
  if (!baseline) return '#555'
  if (hrv > baseline.mean + baseline.sd) return '#5bc25b'
  if (hrv > baseline.mean - baseline.sd) return '#f5c542'
  return '#e03030'
}

export default function HRVSummaryCard({ recovery = [] }) {
  const { t } = useContext(LangCtx)

  const summary = computeHRVSummary(recovery)

  // Insufficient data — render placeholder
  if (!summary) {
    return (
      <div className="sp-card" style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '16px', marginBottom: '16px',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600',
          marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px',
        }}>
          ◈ {t('hrvSummaryTitle')}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: '11px',
          color: 'var(--muted)', lineHeight: 1.6,
        }}>
          {t('hrvNeeded')}
        </div>
      </div>
    )
  }

  const { current, baseline, readiness, suppressed, last14, citation } = summary

  // Delta vs baseline
  const delta = baseline != null
    ? Math.round((current - baseline.mean) * 100) / 100
    : null
  const deltaStr = delta != null
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${t('hrvVsBaseline')}`
    : null

  // Readiness badge color
  const readinessBandColor = readiness
    ? readiness.band === 'High'   ? '#5bc25b'
    : readiness.band === 'Normal' ? '#f5c542'
    : '#e03030'
    : '#888'

  // SVG dots — 200×40px
  const SVG_W  = 200
  const SVG_H  = 40
  const DOT_R  = 5
  const PAD    = DOT_R + 2
  const n      = last14.length
  const spacing = n > 1 ? (SVG_W - 2 * PAD) / (n - 1) : 0

  return (
    <div className="sp-card" style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '16px', marginBottom: '16px',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: MONO, fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6600',
        marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px',
      }}>
        ◈ {t('hrvSummaryTitle')}
      </div>

      {/* Suppression banner */}
      {suppressed && (
        <div style={{
          fontFamily: MONO, fontSize: '11px', fontWeight: 700,
          background: '#e03030', color: '#fff',
          borderRadius: '4px', padding: '6px 10px', marginBottom: '10px',
          letterSpacing: '0.05em',
        }}>
          ⚠ {t('hrvSuppressed')}
        </div>
      )}

      {/* Current value + delta row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: MONO, fontSize: '22px', fontWeight: 700,
          color: '#ff6600', letterSpacing: '0.02em',
        }}>
          {current.toFixed(2)}
        </span>
        {deltaStr && (
          <span style={{
            fontFamily: MONO, fontSize: '11px',
            color: delta >= 0 ? '#5bc25b' : '#e03030',
            letterSpacing: '0.04em',
          }}>
            {deltaStr}
          </span>
        )}

        {/* Readiness badge */}
        {readiness && (
          <span style={{
            fontFamily: MONO, fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: readinessBandColor + '22', color: readinessBandColor,
            border: `1px solid ${readinessBandColor}55`,
            borderRadius: '3px', padding: '2px 8px',
          }}>
            {readiness.band} {readiness.score}%
          </span>
        )}
      </div>

      {/* 14-dot SVG chart */}
      <svg
        width={SVG_W} height={SVG_H}
        style={{ display: 'block', overflow: 'visible', marginBottom: '10px' }}
        aria-label="HRV 14-day chart"
      >
        {/* Baseline mean line */}
        {baseline && n > 1 && (
          <line
            x1={PAD} y1={SVG_H / 2}
            x2={PAD + (n - 1) * spacing} y2={SVG_H / 2}
            stroke="var(--border)" strokeWidth="1"
          />
        )}

        {/* Dots */}
        {last14.map((entry, i) => {
          const cx     = n === 1 ? SVG_W / 2 : PAD + i * spacing
          const cy     = SVG_H / 2
          const color  = dotColor(entry.hrv, baseline)
          const isLast = i === n - 1
          return (
            <g key={`${entry.date}-${i}`}>
              {isLast && (
                <circle cx={cx} cy={cy} r={DOT_R + 3} fill={color + '33'} />
              )}
              <circle cx={cx} cy={cy} r={DOT_R} fill={color} />
            </g>
          )
        })}
      </svg>

      {/* Citation */}
      <div style={{
        fontFamily: MONO, fontSize: '8px',
        color: '#333', letterSpacing: '0.04em', marginTop: '4px',
      }}>
        {citation}
      </div>
    </div>
  )
}
