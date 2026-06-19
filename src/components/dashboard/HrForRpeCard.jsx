// ─── dashboard/HrForRpeCard.jsx — HR × RPE Calibration ──────────────────────
// Surfaces the athlete's median heart rate at each RPE band over the trailing
// 90 days. Reveals what "Easy" / "Moderate" / "Hard" / "Very Hard" actually
// mean in HR terms — the HR cousin of PaceByRpeCard. Together the two cards
// give a complete RPE-anchor picture: "Easy = 130 bpm at 6:00/km".
//
// Distinct from RpeStabilityCard (within-type RPE variance) and
// EasyDayComplianceCard (binary easy-day drift).
//
// Cite: Karvonen 1957; Borg 1982; Buchheit 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeHrForRpe } from '../../lib/athlete/hrForRpe.js'

const BAND_COLOR = {
  EASY:      '#5bc25b',
  MODERATE:  '#0064ff',
  HARD:      '#ff6600',
  VERY_HARD: '#ff4444',
}

const BAND_LABEL = {
  EASY:      { en: 'EASY',      tr: 'KOLAY' },
  MODERATE:  { en: 'MODERATE',  tr: 'ORTA' },
  HARD:      { en: 'HARD',      tr: 'SERT' },
  VERY_HARD: { en: 'VERY HARD', tr: 'ÇOK SERT' },
}

const HINT = {
  en: 'Your typical heart rate at each effort level. Pair with PaceByRpe for a complete intensity-anchor picture.',
  tr: 'Her efor seviyesindeki tipik kalp atış hızın. Tam yoğunluk-çapası tablosu için PaceByRpe ile birlikte değerlendir.',
}

function formatHR(bpm) {
  if (!Number.isFinite(bpm) || bpm <= 0) return '--'
  return `${Math.round(bpm)} bpm`
}

function HrForRpeCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeHrForRpe({ log }),
    [log]
  )

  if (!result) return null

  const { bands, overallSampleCount } = result

  const title = isTR ? 'KAH × RPE · 90G' : 'HR × RPE · 90D'
  const ariaLabel = isTR
    ? 'KAH × RPE — 90 günlük efor kalibrasyonu'
    : 'HR × RPE — 90-day effort calibration'

  const hint = HINT[isTR ? 'tr' : 'en']

  const sessionsLabel = isTR
    ? `${overallSampleCount} seans`
    : `${overallSampleCount} session${overallSampleCount === 1 ? '' : 's'}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-hr-for-rpe-card=""
      data-overall-sample-count={String(overallSampleCount)}
      style={{ ...S.card, animationDelay: '500ms', padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Header / sample count ──────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}
      >
        {sessionsLabel}
      </div>

      {/* ── Per-band rows ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {bands.map((b) => {
          const color = BAND_COLOR[b.name] || '#888'
          const label = BAND_LABEL[b.name]?.[isTR ? 'tr' : 'en'] || b.name
          const hrStr = b.count > 0 ? formatHR(b.medianHR) : '--'
          const countStr = String(b.count)
          return (
            <div
              key={b.name}
              data-hr-rpe-row=""
              data-band-name={b.name}
              data-band-count={countStr}
              data-band-median-hr={b.count > 0 ? b.medianHR.toFixed(4) : '0'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11px',
              }}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  ...S.mono,
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#fff',
                  background: color,
                  padding: '3px 8px',
                  borderRadius: '2px',
                  letterSpacing: '0.06em',
                  minWidth: '78px',
                  textAlign: 'center',
                }}
              >
                {label}
              </span>

              <span
                style={{
                  flex: '0 0 auto',
                  ...S.mono,
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  letterSpacing: '0.06em',
                }}
              >
                RPE {b.rpeRange}
              </span>

              <span
                style={{
                  flex: '1 1 auto',
                  ...S.mono,
                  fontSize: '11px',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  textAlign: 'right',
                }}
              >
                {countStr}× · <span style={{ color: 'var(--text)', fontWeight: 600 }}>{hrStr}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Interpretation hint ────────────────────────────────────────── */}
      <div
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${BAND_COLOR.EASY}`,
          marginBottom: '8px',
        }}
      >
        {hint}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        Karvonen 1957; Borg 1982
      </div>
    </div>
  )
}

export default memo(HrForRpeCard)
