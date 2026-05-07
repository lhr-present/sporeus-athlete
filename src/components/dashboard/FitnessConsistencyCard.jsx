// ─── dashboard/FitnessConsistencyCard.jsx — v8.84.0 CTL Consistency ─────────
// Surfaces detectFitnessConsistency(): coefficient of variation across 13
// weekly average CTL values over the trailing 90d. Distinct from
// FitnessGainRate (slope/direction) — this card surfaces the meta-pattern
// of stability vs oscillation. Bands: rock-solid / stable / oscillating /
// chaotic.
// Cite: Banister 1991; Coggan PMC; Fitz-Clarke 1991 model stability.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectFitnessConsistency } from '../../lib/athlete/fitnessConsistency.js'

const BAND_COLOR = {
  'rock-solid': '#28a745',
  stable:       '#9acd32',
  oscillating:  '#ff9500',
  chaotic:      '#dc3545',
}

const BAND_LABEL = {
  'rock-solid': { en: 'ROCK-SOLID',  tr: 'ÇOK STABİL' },
  stable:       { en: 'STABLE',      tr: 'STABİL' },
  oscillating:  { en: 'OSCILLATING', tr: 'DALGALI' },
  chaotic:      { en: 'CHAOTIC',     tr: 'KAOTİK' },
}

export default function FitnessConsistencyCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectFitnessConsistency(log), [log])

  const title = isTR ? 'CTL TUTARLILIĞI — 90G' : 'FITNESS CONSISTENCY — 90D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR
          ? 'CTL tutarlılığı — yetersiz veri'
          : 'Fitness consistency — insufficient data'}
        style={{ ...S.card, animationDelay: '360ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Tutarlılık için 90+ gün ve ortalama CTL > 5 gerekli'
            : 'Log 90+ days with mean CTL > 5 to track consistency'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.stable
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || result.band.toUpperCase()

  const meanStr = result.meanCTL.toFixed(1)
  const rangeStr = `${result.rangePct.toFixed(1)}%`
  const minStr = result.minCTL.toFixed(1)
  const maxStr = result.maxCTL.toFixed(1)
  const stdevStr = result.stdevCTL.toFixed(1)
  const weeks = result.weeksAnalyzed

  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const ariaRow = isTR
    ? `${bandLbl} — ortalama CTL ${meanStr}, aralık ${rangeStr}`
    : `${bandLbl} — mean CTL ${meanStr}, range ${rangeStr}`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'CTL tutarlılığı' : 'Fitness consistency'}
      style={{ ...S.card, animationDelay: '360ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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
            {meanStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            MEAN CTL
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            ORT CTL
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
            {rangeStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            RANGE
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            ARALIK
          </div>
        </div>
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '6px',
        letterSpacing: '0.04em',
      }}>
        {`min: ${minStr}`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`max: ${maxStr}`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: '10px',
        letterSpacing: '0.04em',
      }}>
        {`stdev: ${stdevStr} over ${weeks} weeks`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`${weeks} hafta üzerinden std ${stdevStr}`}
      </div>

      {message ? (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.6,
          paddingLeft: '8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: '8px',
        }}>
          {message}
        </div>
      ) : null}

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
