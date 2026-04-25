// ─── dashboard/AthleteStatusSummaryCard.jsx — E49 athlete self-view digest ───
// Adapts ctlTrend + acwrStatusLabel + trendLabel + generateAthleteDigestLine
// from coachDigest.js for the athlete's own dashboard view.
// Reference: Banister & Calvert (1980), Mujika (2000) — weekly CTL+ACWR digest
import { memo, useMemo, useContext } from 'react'
import { S } from '../../styles.js'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeAthleteStatus } from '../../lib/athlete/athleteStatusSummary.js'

// ── ACWR status → colour map ──────────────────────────────────────────────────
const ACWR_COLOR = {
  safe:    '#5bc25b',
  low:     '#888888',
  caution: '#f5c542',
  danger:  '#e03030',
}

// ── CTL trend → colour ────────────────────────────────────────────────────────
function ctlTrendColor(trendStr) {
  if (!trendStr) return '#888'
  if (trendStr.startsWith('↑')) return '#5bc25b'
  if (trendStr.startsWith('↓')) return '#e03030'
  return '#888'
}

// ── Overall trend icon + colour ───────────────────────────────────────────────
const TREND_MAP = {
  improving: { icon: '▲', color: '#5bc25b' },
  stable:    { icon: '▬', color: '#888888' },
  declining: { icon: '▼', color: '#e03030' },
}

function AthleteStatusSummaryCard({ log, recovery, profile }) {
  const { lang } = useContext(LangCtx)

  const status = useMemo(
    () => computeAthleteStatus(log, recovery, profile),
    [log, recovery, profile],
  )

  if (!status) return null

  const {
    ctl, ctlTrendStr, acwrLabel, acwrRatio,
    overallTrend, trainingStatus, digestLine, dataPoints,
  } = status

  const title      = lang === 'tr' ? '◈ SPORCU DURUM ÖZETİ' : '◈ ATHLETE STATUS SUMMARY'
  const acwrHeader = lang === 'tr' ? 'ACWR DURUMU'           : 'ACWR STATUS'
  const trendHeader= lang === 'tr' ? 'GENEL EĞİLİM'          : 'OVERALL TREND'

  const trendMeta  = TREND_MAP[overallTrend] || TREND_MAP.stable
  const acwrColor  = ACWR_COLOR[acwrLabel]   || '#888'
  const trendColor = ctlTrendColor(ctlTrendStr)

  return (
    <div style={{ ...S.card, fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Title */}
      <div style={{ ...S.cardTitle, color: '#ff6600', letterSpacing: '0.08em', marginBottom: '10px' }}>
        {title}
      </div>

      {/* CTL + trend row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '38px',
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono, monospace',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          {ctl}
        </span>
        <span style={{ ...S.mono, fontSize: '11px', color: '#888', letterSpacing: '0.06em' }}>
          CTL
        </span>
        <span style={{
          ...S.mono,
          fontSize: '18px',
          fontWeight: 700,
          color: trendColor,
          letterSpacing: '0.02em',
        }}>
          {ctlTrendStr}
        </span>
      </div>

      {/* ACWR row */}
      <div style={{ marginBottom: '7px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>
          {acwrHeader}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '12px',
          color: acwrColor,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          ACWR {acwrRatio !== null && acwrRatio !== undefined ? Number(acwrRatio).toFixed(2) : '—'} · {acwrLabel}
        </div>
      </div>

      {/* Overall trend row */}
      <div style={{ marginBottom: '7px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>
          {trendHeader}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '12px',
          fontWeight: 600,
          color: trendMeta.color,
          letterSpacing: '0.04em',
        }}>
          {trendMeta.icon} {overallTrend}
        </div>
      </div>

      {/* Training status badge */}
      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: 'var(--muted)',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {trainingStatus.toUpperCase()} · {dataPoints} sessions
      </div>

      {/* Digest line */}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '8px',
        marginTop: '2px',
      }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: 'var(--muted)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {digestLine}
        </div>
      </div>

      {/* Citation */}
      <div style={{
        ...S.mono,
        fontSize: '9px',
        color: 'var(--muted)',
        marginTop: '10px',
        letterSpacing: '0.04em',
        opacity: 0.7,
      }}>
        ℹ Banister &amp; Calvert (1980) · Mujika (2000) — weekly CTL+ACWR digest
      </div>

    </div>
  )
}

export default memo(AthleteStatusSummaryCard)
