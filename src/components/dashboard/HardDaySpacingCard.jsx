// ─── dashboard/HardDaySpacingCard.jsx — Hard-Day Spacing (28d window) ────────
// Surfaces detectHardDaySpacing(): tracks every hard→hard transition with a
// gap of <48h over the trailing 28 days. Violations of hard-easy alternation
// deny aerobic recovery and predict overreaching (Lambert 1997; Foster 1998;
// Seiler 2010).
//
// Render rule: NULL when the detector reports no findings (zero violations).
// A clean microcycle does not deserve a banner — the card only surfaces
// actionable load-distribution mistakes.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectHardDaySpacing } from '../../lib/athlete/hardDaySpacing.js'

const BAND_COLORS = {
  good:     '#5bc25b',
  moderate: '#f5c542',
  poor:     '#e03030',
}

const BAND_LABEL = {
  good:     { en: 'GOOD',     tr: 'İYİ' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  poor:     { en: 'POOR',     tr: 'ZAYIF' },
}

// Days between dateStr (YYYY-MM-DD) and today (UTC).
function daysAgo(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr + 'T00:00:00Z')
  const now = new Date()
  const today = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  ))
  const ms = today - d
  return Math.max(0, Math.round(ms / 86400000))
}

function relativeLabel(dateStr, isTR) {
  const n = daysAgo(dateStr)
  if (n === 0) return isTR ? 'bugün' : 'today'
  if (n === 1) return isTR ? 'dün' : '1 day ago'
  return isTR ? `${n} gün önce` : `${n} days ago`
}

export default function HardDaySpacingCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => detectHardDaySpacing(log), [log])

  // ─── No findings → render NOTHING (no false positives on clean weeks) ──────
  if (!result || result.violations === 0) return null

  const color = BAND_COLORS[result.band] || BAND_COLORS.poor
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || String(result.band || '').toUpperCase()
  const pct = result.compliancePct

  const pctAria = isTR
    ? `${bandLbl} %${pct} sert-gün aralığı`
    : `${bandLbl} ${pct}% hard-day spacing`

  const ariaLabel = isTR ? 'Sert-gün aralığı' : 'Hard-day spacing'

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-hard-day-spacing-card={result.band}
      style={{ ...S.card, animationDelay: '250ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'SERT-GÜN ARALIĞI — 28G' : 'HARD-DAY SPACING — 28D'}
      </div>

      {/* Big % + band badge ------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '4px 0 8px',
        }}
      >
        <div
          aria-label={pctAria}
          data-hard-day-spacing-pct={pct}
          style={{
            ...S.mono,
            fontSize: '24px',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {pct}
          <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: '2px' }}>%</span>
        </div>
        <div
          data-hard-day-spacing-band={result.band}
          style={{
            ...S.mono,
            fontSize: '10px',
            fontWeight: 700,
            color,
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: '3px',
            padding: '3px 8px',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* Stats row ---------------------------------------------------------- */}
      <div
        data-hard-day-spacing-violations={result.violations}
        style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', marginBottom: '8px' }}
      >
        {isTR
          ? `${result.violations} ardışık sert çift / ${result.totalHard} sert gün`
          : `${result.violations} back-to-back hard pair${result.violations === 1 ? '' : 's'} / ${result.totalHard} hard days`}
      </div>

      {/* Bilingual message -------------------------------------------------- */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${color}`,
          marginBottom: '6px',
        }}
      >
        {result.message[isTR ? 'tr' : 'en']}
      </div>

      {/* Recommendation (only when present) --------------------------------- */}
      {result.recommendation[isTR ? 'tr' : 'en'] ? (
        <div
          aria-live="polite"
          style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', lineHeight: 1.6, marginBottom: '8px' }}
        >
          {result.recommendation[isTR ? 'tr' : 'en']}
        </div>
      ) : null}

      {/* Violation dates list (lib already caps at 5 most-recent) ----------- */}
      {result.violationDates && result.violationDates.length > 0 ? (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', letterSpacing: '0.04em' }}>
            {isTR ? 'ARDIŞIK SERT GÜNLER' : 'BACK-TO-BACK HARD DAYS'}
          </div>
          <div
            role="list"
            aria-label={isTR ? 'Ardışık sert gün tarihleri' : 'Back-to-back hard day dates'}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
          >
            {result.violationDates.map(date => (
              <div
                key={date}
                role="listitem"
                data-violation-date={date}
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color,
                  background: `${color}14`,
                  border: `1px solid ${color}44`,
                  borderRadius: '3px',
                  padding: '2px 6px',
                }}
              >
                {relativeLabel(date, isTR)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Reliability note when totalHard < 4 -------------------------------- */}
      {result.reliable === false ? (
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', fontStyle: 'italic' }}>
          {isTR
            ? 'Düşük örneklem — 4+ sert seansla daha güvenilir.'
            : 'Low sample — more reliable with 4+ hard sessions.'}
        </div>
      ) : null}

      {/* Citation footer ---------------------------------------------------- */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
