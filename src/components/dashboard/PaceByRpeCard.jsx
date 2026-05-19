// ─── dashboard/PaceByRpeCard.jsx — Pace × RPE Calibration ───────────────────
// Surfaces the athlete's actual running pace at each RPE band over the
// trailing 90 days. Reveals concrete pace-vs-effort calibration:
// "Easy at 6:00/km, Tempo at 4:50/km". If Easy paces creep close to Tempo,
// the athlete is running easy days too hard — Seiler-style polarization
// failure.
//
// Distinct from RpeStabilityCard (within-type RPE variance) and
// EasyDayComplianceCard (binary easy-day drift).
//
// Cite: Daniels 2014; Borg 1982.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzePaceByRpe, formatPace } from '../../lib/athlete/paceByRpe.js'

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
  en: 'Your typical pace at each effort level. If Easy paces are faster than expected vs Tempo, you may be running easy days too hard.',
  tr: 'Her efor seviyesindeki tipik temponu gösterir. Kolay tempolar Tempo\'ya göre beklenenden hızlıysa, kolay günleri çok sert koşuyor olabilirsin.',
}

export default function PaceByRpeCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzePaceByRpe({ log }),
    [log]
  )

  if (!result) return null

  const { bands, overallSampleCount, citation } = result

  const title = isTR ? 'TEMPO × RPE · 90G' : 'PACE × RPE · 90D'
  const ariaLabel = isTR
    ? 'Tempo × RPE — 90 günlük efor kalibrasyonu'
    : 'Pace × RPE — 90-day effort calibration'

  const hint = HINT[isTR ? 'tr' : 'en']

  const sessionsLabel = isTR
    ? `${overallSampleCount} koşu`
    : `${overallSampleCount} run${overallSampleCount === 1 ? '' : 's'}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-pace-by-rpe-card=""
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
          const paceStr = b.count > 0 ? formatPace(b.medianPace) : '--'
          const countStr = String(b.count)
          return (
            <div
              key={b.name}
              data-pace-rpe-row=""
              data-band-name={b.name}
              data-band-count={countStr}
              data-band-median-pace={b.count > 0 ? b.medianPace.toFixed(4) : '0'}
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
                {countStr}× · <span style={{ color: 'var(--text)', fontWeight: 600 }}>{paceStr}</span>
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
        {citation}
      </div>
    </div>
  )
}
