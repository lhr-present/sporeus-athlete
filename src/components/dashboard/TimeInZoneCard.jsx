// ─── dashboard/TimeInZoneCard.jsx — v8.79.0 Time-In-Zone (28d, minutes) ──────
// Surfaces detectTimeInZone(): absolute minutes per zone over 28d compared to
// scaled polarized targets. Distinct from TrainingDistribution (84d shape) and
// StaleZones (28d share %) — this surface targets minute-prescription athletes.
// Cite: Seiler 2010 polarized; Stöggl & Sperlich 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectTimeInZone } from '../../lib/athlete/timeInZone.js'

const BAND_COLOR = {
  good:     '#28a745',
  moderate: '#ff9500',
  poor:     '#dc3545',
}

const BAND_LABEL = {
  good:     { en: 'ON TARGET', tr: 'HEDEFTE' },
  moderate: { en: 'MODERATE',  tr: 'ORTA' },
  poor:     { en: 'POOR',      tr: 'ZAYIF' },
}

const ZONE_COLORS = {
  Z1: '#28a745',
  Z2: '#9acd32',
  Z3: '#ffd700',
  Z4: '#ff9500',
  Z5: '#dc3545',
}

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

const STATUS_GLYPH = {
  'on-target': { sym: '·', color: 'var(--muted)' },
  under:       { sym: '↓', color: '#dc3545' },
  over:        { sym: '↑', color: '#dc3545' },
}

const DIRECTION_LABEL = {
  over:  { en: 'over',  tr: 'üstünde' },
  under: { en: 'under', tr: 'altında' },
}

export default function TimeInZoneCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectTimeInZone(log), [log])

  const title = isTR ? 'BÖLGE SÜRELERİ — 28G' : 'TIME IN ZONE — 28D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Bölge süreleri — yetersiz veri' : 'Time in zone — insufficient data'}
        style={{ ...S.card, animationDelay: '300ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Bölge süreleri için 200+ dk veri gerekli'
            : 'Log 200+ minutes to track time in zone'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.good
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()
  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const barAria = isTR
    ? `Z1 %${result.sharePerZone[0]}, Z2 %${result.sharePerZone[1]}, Z3 %${result.sharePerZone[2]}, Z4 %${result.sharePerZone[3]}, Z5 %${result.sharePerZone[4]}`
    : `Z1 ${result.sharePerZone[0]}%, Z2 ${result.sharePerZone[1]}%, Z3 ${result.sharePerZone[2]}%, Z4 ${result.sharePerZone[3]}%, Z5 ${result.sharePerZone[4]}%`

  let worstCallout = null
  if (result.worstZone) {
    const w = result.worstZone
    const absDelta = Math.abs(w.deltaMin)
    const dirEn = DIRECTION_LABEL[w.status]?.en || w.status
    const dirTr = DIRECTION_LABEL[w.status]?.tr || w.status
    worstCallout = isTR
      ? `En kötü: ${w.zone} hedeften ${absDelta} dk ${dirTr}`
      : `Worst: ${w.zone} ${dirEn} target by ${absDelta} min`
  }

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Bölge süreleri' : 'Time in zone'}
      style={{ ...S.card, animationDelay: '300ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '4px 0 8px' }}>
        <div
          aria-live="polite"
          style={{
            ...S.mono,
            fontSize: '32px',
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {result.totalMinutes}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '9px',
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingBottom: '4px',
        }}>
          MIN/28D<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>DK/28G
        </div>
      </div>

      <div
        role="img"
        aria-label={barAria}
        style={{
          display: 'flex',
          width: '100%',
          height: '14px',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '10px',
        }}
      >
        {ZONE_KEYS.map((z, i) => {
          const pct = result.sharePerZone[i] || 0
          if (pct <= 0) return null
          return (
            <div
              key={z}
              title={`${z} ${pct}% · ${result.minutesPerZone[i]} min`}
              aria-label={`${z} ${pct}%`}
              style={{ width: `${pct}%`, background: ZONE_COLORS[z], height: '100%' }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
        {result.byZone.map(b => {
          const glyph = STATUS_GLYPH[b.status] || STATUS_GLYPH['on-target']
          return (
            <div
              key={b.zone}
              style={{
                ...S.mono,
                fontSize: '11px',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.02em',
              }}
            >
              <span aria-hidden="true" style={{
                display: 'inline-block', width: '8px', height: '8px',
                background: ZONE_COLORS[b.zone], borderRadius: '2px',
              }}/>
              <span style={{ fontWeight: 600, minWidth: '22px' }}>{b.zone}:</span>
              <span>{b.minutes} {isTR ? 'dk' : 'min'}</span>
              <span style={{ color: 'var(--muted)' }}>
                / {isTR ? 'hedef' : 'target'} {b.target}
              </span>
              <span aria-label={b.status} style={{ color: glyph.color, fontWeight: 700 }}>
                {glyph.sym}
              </span>
            </div>
          )
        })}
      </div>

      {worstCallout ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: accent,
          marginBottom: '8px',
          letterSpacing: '0.03em',
        }}>
          {worstCallout}
        </div>
      ) : null}

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
