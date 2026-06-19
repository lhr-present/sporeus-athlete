// ─── dashboard/CheckInQualityCard.jsx — Check-in / Log Data Hygiene ─────────
// Surfaces the COMPLETENESS of recent session log entries so the athlete
// knows whether their downstream insights are starved of context. Renders an
// aggregate quality percentage, the band (COMPLETE / PARTIAL / THIN), per-
// field fill-rate mini bars, and a localized interpretation hint that calls
// out the weakest field (the "weakest link" they should fix first).
//
// Cite: Halson 2014 "Monitoring training load to understand fatigue in
//       athletes" — data-quality framing.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeCheckInQuality } from '../../lib/athlete/checkInQuality.js'

const BAND_COLOR = {
  COMPLETE: '#5bc25b',
  PARTIAL:  '#0064ff',
  THIN:     '#ff6600',
}

const BAND_LABEL = {
  COMPLETE: { en: 'COMPLETE', tr: 'EKSİKSİZ' },
  PARTIAL:  { en: 'PARTIAL',  tr: 'KISMEN' },
  THIN:     { en: 'THIN',     tr: 'İNCE' },
}

// Field display labels: EN / TR
const FIELD_LABEL = {
  rpe:         { en: 'RPE',      tr: 'RPE' },
  tss:         { en: 'TSS',      tr: 'TSS' },
  durationMin: { en: 'DURATION', tr: 'SÜRE' },
  heartRate:   { en: 'HR',       tr: 'KAH' },
}

const FIELD_ORDER = ['rpe', 'tss', 'durationMin', 'heartRate']

const HINT = {
  COMPLETE: {
    en: 'Strong data hygiene — your trend insights are well-grounded.',
    tr: 'Güçlü veri hijyeni — trend içgörülerin sağlam temelli.',
  },
  PARTIAL: {
    // {weakestField} is replaced with the localized field name
    en: 'Some fields missing across sessions. Filling {weakestField} would tighten insights.',
    tr: 'Seanslar arası bazı alanlar eksik. {weakestField} doldurmak içgörüleri sağlamlaştırır.',
  },
  THIN: {
    en: "Many sessions lack core fields. Use Quick Add to capture at least RPE + duration.",
    tr: "Birçok seans temel alanları içermiyor. En az RPE + süre için Hızlı Ekle'yi kullan.",
  },
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

function CheckInQualityCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeCheckInQuality({ log }),
    [log]
  )

  if (!result) return null

  const { band, avgQuality, sessionCount, weakestField, fieldFillRates, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band

  const title = isTR ? 'KAYIT KALİTESİ · 14G' : 'CHECK-IN QUALITY · 14D'
  const ariaLabel = isTR ? 'Kayıt kalitesi — 14 günlük veri hijyeni' : 'Check-in quality — 14-day data hygiene'

  // Localize the {weakestField} interpolation for the PARTIAL hint.
  const localizedWeakest = weakestField
    ? (FIELD_LABEL[weakestField]?.[isTR ? 'tr' : 'en'] || weakestField)
    : null

  let hint = HINT[band][isTR ? 'tr' : 'en']
  if (band === 'PARTIAL') {
    // If we have no weakest field, fall back to a generic label so the
    // sentence still reads cleanly.
    const replacement = localizedWeakest || (isTR ? 'eksik alanları' : 'missing fields')
    hint = hint.replace('{weakestField}', replacement)
  }

  const sessionsLabel = isTR
    ? `${sessionCount} seans`
    : `${sessionCount} session${sessionCount === 1 ? '' : 's'}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-check-in-quality-card=""
      data-quality-band={band}
      data-avg-quality={avgQuality.toFixed(3)}
      data-session-count={String(sessionCount)}
      data-weakest-field={weakestField || ''}
      style={{ ...S.card, animationDelay: '460ms', padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Score block ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div style={{
            ...S.mono,
            fontSize: '36px',
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {fmtPct(avgQuality)}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            marginTop: '4px',
            textTransform: 'uppercase',
          }}>
            {sessionsLabel}
          </div>
        </div>

        <span style={{
          display: 'inline-block',
          ...S.mono,
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          background: color,
          padding: '4px 10px',
          borderRadius: '3px',
          letterSpacing: '0.08em',
        }}>
          {bandLabel}
        </span>
      </div>

      {/* ── Per-field fill-rate bars ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        {FIELD_ORDER.map((field) => {
          const rate = fieldFillRates?.[field] ?? 0
          const pct = Math.max(0, Math.min(1, rate))
          const fieldLbl = FIELD_LABEL[field]?.[isTR ? 'tr' : 'en'] || field
          const barColor = pct >= 0.80 ? BAND_COLOR.COMPLETE
            : pct >= 0.50 ? BAND_COLOR.PARTIAL
            : BAND_COLOR.THIN
          return (
            <div
              key={field}
              data-field-bar=""
              data-field-name={field}
              data-field-fill-rate={pct.toFixed(3)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <div style={{
                flex: '0 0 64px',
                ...S.mono,
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {fieldLbl}
              </div>

              <div style={{
                flex: '1 1 auto',
                height: '8px',
                background: 'var(--surface, #222)',
                border: '1px solid var(--border)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.round(pct * 100)}%`,
                  height: '100%',
                  background: barColor,
                  transition: 'width 240ms ease-out',
                }} />
              </div>

              <div style={{
                flex: '0 0 44px',
                textAlign: 'right',
                ...S.mono,
                fontSize: '10px',
                color: 'var(--muted)',
                letterSpacing: '0.04em',
              }}>
                {fmtPct(pct)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Interpretation hint ─────────────────────────────────────────── */}
      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--text)',
        lineHeight: 1.6,
        paddingLeft: '8px',
        borderLeft: `2px solid ${color}`,
        marginBottom: '8px',
      }}>
        {hint}
      </div>

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(CheckInQualityCard)
