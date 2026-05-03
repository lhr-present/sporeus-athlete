// ─── dashboard/EasyDayComplianceCard.jsx — E127: Easy-Day Compliance (28d) ──
// Surfaces detectEasyDayCompliance(): 28-day RPE/zone drift on labeled-easy
// days. Athletes who go too hard on easy days violate Seiler's polarized
// 80/20 rule and lose adaptation. 5th card in the coaching-insight cluster.
// Citation: Seiler 2010; Stöggl & Sperlich 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectEasyDayCompliance } from '../../lib/athlete/easyDayCompliance.js'

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

export default function EasyDayComplianceCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectEasyDayCompliance(log), [log])

  // ─── Empty / unreliable state ──────────────────────────────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Kolay-gün uyumu — yetersiz veri' : 'Easy-day compliance — not enough data'}
        style={{ ...S.card, animationDelay: '250ms' }}
      >
        <div style={S.cardTitle}>
          {isTR ? 'KOLAY-GÜN UYUMU — 28G' : 'EASY-DAY COMPLIANCE — 28D'}
        </div>
        <div style={{ ...S.mono, fontSize: '11px', color: '#888', textAlign: 'center', padding: '14px 0', lineHeight: 1.7 }}>
          {isTR
            ? 'Uyumu görmek için 5+ kolay seans kaydet'
            : 'Log 5+ easy sessions to see compliance'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Reliable render ───────────────────────────────────────────────────────
  const color = BAND_COLORS[result.band] || BAND_COLORS.poor
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const compliantEasy = result.totalEasy - result.driftSessions
  const pct = result.compliancePct

  const pctAria = isTR
    ? `${bandLbl} %${pct} kolay-gün uyumu`
    : `${bandLbl} ${pct}% easy-day compliance`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Kolay-gün uyumu' : 'Easy-day compliance'}
      style={{ ...S.card, animationDelay: '250ms', borderLeft: `3px solid ${color}` }}
    >
      <div style={S.cardTitle}>
        {isTR ? 'KOLAY-GÜN UYUMU — 28G' : 'EASY-DAY COMPLIANCE — 28D'}
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
      <div style={{ ...S.mono, fontSize: '11px', color: 'var(--sub)', marginBottom: '8px' }}>
        {isTR
          ? `${compliantEasy} / ${result.totalEasy} kolay seans uyumlu`
          : `${compliantEasy} / ${result.totalEasy} easy sessions compliant`}
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

      {/* Drift dates list (compact, max 5) ---------------------------------- */}
      {result.driftSessions > 0 && result.driftDates.length > 0 ? (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', letterSpacing: '0.04em' }}>
            {isTR ? 'SAPMA GÜNLERİ' : 'DRIFT DAYS'}
          </div>
          <div
            role="list"
            aria-label={isTR ? 'Sapma tarihleri' : 'Drift dates'}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
          >
            {result.driftDates.slice(0, 5).map(date => (
              <div
                key={date}
                role="listitem"
                style={{
                  ...S.mono,
                  fontSize: '10px',
                  color: BAND_COLORS.poor,
                  background: `${BAND_COLORS.poor}14`,
                  border: `1px solid ${BAND_COLORS.poor}44`,
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

      {/* Citation footer ---------------------------------------------------- */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
