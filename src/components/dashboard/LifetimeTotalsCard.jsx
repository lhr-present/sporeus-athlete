// ─── LifetimeTotalsCard.jsx — Dashboard surface for lifetime training totals
//
// Surfaces the pure-fn `analyzeLifetimeTotals` (src/lib/athlete/lifetimeTotals.js)
// to give the athlete a "training capital" view across their entire logged
// history. Distinct from SeasonStats (annual) and MonthlyProgress (delta).
//
// No band — this card is informational only, an accumulation anchor for
// self-efficacy (Bandura 1997) and a reminder that long-term residuals
// from years of stimulus carry forward (Issurin 2010).
//
// Renders NULL when the analyzer returns null (empty log / no parseable dates).
//
// Citation: Bandura A. (1997). Self-efficacy: The exercise of control.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeLifetimeTotals } from '../../lib/athlete/lifetimeTotals.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'

function formatTenure(years, months, firstDate, isTR) {
  if (years >= 1) {
    const wholeYears = Math.floor(years)
    const remMonths = Math.max(0, Math.round((years - wholeYears) * 12))
    const head = `${wholeYears}y ${remMonths}mo`
    const headTR = `${wholeYears}y ${remMonths}a`
    return isTR
      ? `${headTR} · ${firstDate}'den beri`
      : `${head} · since ${firstDate}`
  }
  // < 1 year: months-only shape. Round to whole month for the headline.
  const wholeMonths = Math.max(1, Math.round(months))
  return isTR
    ? `${wholeMonths}a · ${firstDate}'den beri`
    : `${wholeMonths}mo · since ${firstDate}`
}

/**
 * @description Surface `analyzeLifetimeTotals` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
export default function LifetimeTotalsCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const totals = useMemo(() => analyzeLifetimeTotals({ log }), [log])

  if (!totals) return null

  const title    = isTR ? 'YAŞAM BOYU · TÜM ZAMAN' : 'LIFETIME · ALL TIME'
  const aria     = isTR ? 'Yaşam boyu antrenman toplamları' : 'Lifetime training totals'
  const tenure   = formatTenure(totals.tenureYears, totals.tenureMonths, totals.firstSessionDate, isTR)
  const hint     = isTR
    ? 'Kaydettiğin her seans birikiyor — bu senin antrenman sermayendir.'
    : "Every session you've logged compounds — this is your training capital."

  const rows = [
    {
      label: isTR ? 'seans' : 'sessions',
      value: String(Math.round(totals.totalSessions)),
      anchor: 'data-total-sessions',
      anchorValue: Math.round(totals.totalSessions),
    },
    {
      label: isTR ? 'saat' : 'hours',
      value: `${Math.round(totals.totalHours)}h`,
      anchor: 'data-total-hours',
      anchorValue: Math.round(totals.totalHours),
    },
    {
      label: isTR ? 'mesafe' : 'distance',
      value: `${Math.round(totals.totalDistanceKm)}km`,
      anchor: 'data-total-distance-km',
      anchorValue: Math.round(totals.totalDistanceKm),
    },
    {
      label: isTR ? 'TSS' : 'TSS',
      value: String(Math.round(totals.totalTss)),
      anchor: 'data-total-tss',
      anchorValue: Math.round(totals.totalTss),
    },
  ]

  const anchorProps = {
    'data-lifetime-totals-card': true,
    'data-total-sessions':    Math.round(totals.totalSessions),
    'data-total-hours':       Math.round(totals.totalHours),
    'data-total-distance-km': Math.round(totals.totalDistanceKm),
    'data-total-tss':         Math.round(totals.totalTss),
    'data-tenure-days':       totals.tenureDays,
    'data-first-session-date': totals.firstSessionDate,
  }

  return (
    <div
      role="region"
      aria-label={aria}
      {...anchorProps}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color: ORANGE, marginRight: 6 }}>◢</span>
          {title}
        </div>
      </div>

      {/* Tenure summary — the headline number */}
      <div
        data-lifetime-tenure
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: ORANGE,
          lineHeight: 1.2,
          marginBottom: 14,
          letterSpacing: '0.02em',
        }}
      >
        {tenure}
      </div>

      {/* Stat rows */}
      <div
        data-lifetime-stats
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 6,
          marginBottom: 12,
        }}
      >
        {rows.map(r => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: '1px dashed var(--border, #222)',
            }}
          >
            <span style={{
              fontSize: 10,
              color: 'var(--muted)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {r.label}
            </span>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Interpretation hint (motivational anchor — no band) */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${ORANGE}10`,
        border: `1px solid ${ORANGE}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Bandura 1997
      </div>
    </div>
  )
}
