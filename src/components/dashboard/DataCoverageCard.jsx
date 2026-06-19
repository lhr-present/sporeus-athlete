// ─── DataCoverageCard.jsx — Lifetime logging coverage surface ────────────────
//
// Surfaces the pure-fn `analyzeDataCoverage` (src/lib/athlete/dataCoverage.js).
// Shows what percentage of days since the user's first log entry have AT
// LEAST ONE log entry (session OR recovery). Habit-formation framing per
// Wood 2013; data-fidelity framing per Hellard 2019.
//
// Bands:
//   HIGH   ≥ 0.70  → green  (#5bc25b) — strong logging discipline
//   MEDIUM 0.40–   → blue   (#0064ff) — moderate coverage
//   LOW    < 0.40  → orange (#ff6600) — sparse; trend analytics under-powered
//
// Citations: Wood 2013; Hellard 2019.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeDataCoverage } from '../../lib/athlete/dataCoverage.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_TR = {
  HIGH:   'YÜKSEK',
  MEDIUM: 'ORTA',
  LOW:    'DÜŞÜK',
}
const BAND_COLOR = {
  HIGH:   '#5bc25b',
  MEDIUM: '#0064ff',
  LOW:    '#ff6600',
}
const BAND_HINT = {
  HIGH: {
    en: 'Strong logging discipline. Trend insights are well-grounded in real data.',
    tr: 'Güçlü kayıt disiplini. Trend içgörüleri gerçek veriye dayanıyor.',
  },
  MEDIUM: {
    en: 'Moderate coverage. More consistent logging would tighten the analytics.',
    tr: 'Orta kapsam. Daha tutarlı kayıt analizleri sağlamlaştırır.',
  },
  LOW: {
    en: 'Sparse log coverage. Many trends and bands need denser data to compute reliably.',
    tr: 'Seyrek kayıt. Birçok trend ve band güvenilir hesaplama için daha yoğun veri gerektirir.',
  },
}

/**
 * @description Render lifetime data-coverage card. Returns null when
 * both `log` and `recovery` are empty/null (no anchor date exists).
 *
 * @param {{ log?: Array, recovery?: Array }} props
 */
function DataCoverageCard({ log, recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeDataCoverage({ log, recovery }),
    [log, recovery]
  )

  if (!analysis) return null

  const { band, coverage, totalDays, daysWithAnyEntry,
          daysWithSession, daysWithRecovery, overlap } = analysis

  const color = BAND_COLOR[band] || BAND_COLOR.LOW
  const hint  = BAND_HINT[band] || BAND_HINT.LOW
  const bandLabel = isTR ? BAND_TR[band] : band

  const title = isTR
    ? 'VERİ KAPSAMI · YAŞAM BOYU'
    : 'DATA COVERAGE · LIFETIME'
  const ariaLabel = isTR ? 'Veri kapsamı yaşam boyu' : 'Data coverage lifetime'

  const pct = (coverage * 100)
  const pctDisplay = `${pct.toFixed(1)}%`

  const daysLoggedLabel = isTR
    ? `${daysWithAnyEntry} / ${totalDays} gün kayıtlı`
    : `${daysWithAnyEntry} of ${totalDays} days logged`

  const rowLabels = {
    sessions:  isTR ? 'Seans günleri'    : 'Session days',
    recovery:  isTR ? 'Toparlanma günleri' : 'Recovery days',
    overlap:   isTR ? 'Ortak günler'     : 'Overlap days',
  }
  const daySuffix = isTR ? 'gün' : 'days'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-data-coverage-card
      data-coverage-band={band}
      data-coverage={coverage.toFixed(4)}
      data-days-with-any-entry={daysWithAnyEntry}
      data-total-days={totalDays}
      data-days-with-session={daysWithSession}
      data-days-with-recovery={daysWithRecovery}
      data-overlap={overlap}
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
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-coverage-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Big coverage % */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 8,
      }}>
        <div
          data-coverage-pct
          style={{
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {pctDisplay}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          · {daysLoggedLabel}
        </div>
      </div>

      {/* Mini breakdown rows */}
      <div
        data-coverage-breakdown
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 10,
          padding: 8,
          background: 'var(--surface, #0a0a0a)',
          border: '1px solid var(--border, #1a1a1a)',
          borderRadius: 3,
        }}
      >
        <div
          data-coverage-row="sessions"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {rowLabels.sessions}
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
            {daysWithSession} {daySuffix}
          </span>
        </div>
        <div
          data-coverage-row="recovery"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {rowLabels.recovery}
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
            {daysWithRecovery} {daySuffix}
          </span>
        </div>
        <div
          data-coverage-row="overlap"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
            {rowLabels.overlap}
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
            {overlap} {daySuffix}
          </span>
        </div>
      </div>

      {/* Interpretation hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        Wood 2013; Hellard 2019
      </div>
    </div>
  )
}

export default memo(DataCoverageCard)
