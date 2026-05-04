// ─── dashboard/MonotonyStrainCard.jsx — Foster Monotony & Strain (7d) ───────
// Surfaces detectMonotonyStrain(): Foster 2001 monotony (mean/stdev daily TSS)
// + strain (weekTSS × monotony) over a trailing 7-day window. Bands: low,
// moderate, high. Complements ACWR — uniform high loads with low day-to-day
// variation predict overuse injury and illness.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectMonotonyStrain } from '../../lib/athlete/trainingMonotonyStrain.js'

const BAND_COLOR = {
  low:      '#28a745',
  moderate: '#ff9500',
  high:     '#dc3545',
}

const BAND_LABEL = {
  low:      { en: 'LOW',      tr: 'DÜŞÜK' },
  moderate: { en: 'MODERATE', tr: 'ORTA' },
  high:     { en: 'HIGH',     tr: 'YÜKSEK' },
}

export default function MonotonyStrainCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectMonotonyStrain(log), [log])

  const title = isTR ? 'MONOTONLUK & YÜK — 7G' : 'MONOTONY & STRAIN — 7D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Monotonluk ve yük — yetersiz veri' : 'Monotony and strain — insufficient data'}
        style={{ ...S.card, animationDelay: '200ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Monotonluk için 7 günlük pencerede 5+ farklı gün kaydet'
            : 'Log 5+ distinct days in the 7-day window to track monotony'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.low
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const monotonyStr = result.monotony.toFixed(2)
  const strainStr = String(result.strain)
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const ariaRow = isTR
    ? `${bandLbl} — monotonluk ${monotonyStr}, yük ${strainStr}`
    : `${bandLbl} — monotony ${monotonyStr}, strain ${strainStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Monotonluk ve yük' : 'Monotony and strain'}
      style={{ ...S.card, animationDelay: '200ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
    >
      <div style={S.cardTitle}>{title}</div>

      <div style={{
        display: 'inline-block',
        ...S.mono,
        fontSize: '11px',
        fontWeight: 700,
        color: '#fff',
        background: accent,
        padding: '4px 10px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {bandLbl}
      </div>

      <div
        aria-live="polite"
        aria-label={ariaRow}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {monotonyStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            MONOTONY
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            MONOTONLUK
          </div>
        </div>

        <div>
          <div style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {strainStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            STRAIN
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            YÜK
          </div>
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '10px',
        letterSpacing: '0.04em',
      }}>
        {isTR
          ? `Haftalık TSS ${result.weekTotalTSS} · ${result.daysWithLoad}/7 gün yüklü`
          : `Week TSS ${result.weekTotalTSS} · ${result.daysWithLoad}/7 days loaded`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '11px',
        color: 'var(--text)',
        lineHeight: 1.6,
        paddingLeft: '8px',
        borderLeft: `2px solid ${accent}`,
        marginBottom: '8px',
      }}>
        {result.message[isTR ? 'tr' : 'en']}
      </div>

      {recommendation ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          {recommendation}
        </div>
      ) : null}

      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
        {result.citation}
      </div>
    </div>
  )
}
