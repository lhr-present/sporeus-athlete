// ─── dashboard/DeloadCadenceCard.jsx — v8.86.0 3:1 Build/Deload Cadence ─────
// Surfaces detectDeloadCadence(): walks 12 trailing weeks of weekly TSS and
// audits 3:1 build/deload cadence. Bands: on-schedule / overdue / too-frequent
// / no-pattern. Distinct from recoveryDebt (right-now TSB integral) and
// fitnessConsistency (CTL CV stability).
// Cite: Bompa & Haff 2009 periodization; Issurin 2010 block periodization.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectDeloadCadence } from '../../lib/athlete/deloadCadence.js'

const BAND_COLOR = {
  'on-schedule':  '#28a745',
  overdue:        '#dc3545',
  'too-frequent': '#ff9500',
  'no-pattern':   '#6c757d',
}

const BAND_LABEL = {
  'on-schedule':  { en: 'ON-SCHEDULE',  tr: 'PROGRAMDA' },
  overdue:        { en: 'OVERDUE',      tr: 'GECİKMİŞ' },
  'too-frequent': { en: 'TOO FREQUENT', tr: 'ÇOK SIK' },
  'no-pattern':   { en: 'NO PATTERN',   tr: 'RİTİM YOK' },
}

export default function DeloadCadenceCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectDeloadCadence(log), [log])

  const title = isTR ? 'DELOAD RİTMİ — 12H' : 'DELOAD CADENCE — 12W'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR
          ? 'Deload ritmi — yetersiz veri'
          : 'Deload cadence — insufficient data'}
        style={{ ...S.card, animationDelay: '420ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Ritim için 8+ hafta ve haftalık ortalama TSS > 50 gerekli'
            : 'Log 8+ weeks with mean weekly TSS > 50 to track cadence'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR['no-pattern']
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en']
    || result.band.toUpperCase()

  const actualStr = String(result.actualDeloads)
  const expectedStr = String(result.expectedDeloads)
  const sinceStr = result.weeksSinceLastDeload == null
    ? '—'
    : String(result.weeksSinceLastDeload)
  const ratioStr = result.deloadRatio.toFixed(2)
  const meanStr = result.meanWeekTSS.toFixed(1)
  const weeks = result.weeksAnalyzed

  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const recentList = result.deloadWeekTSSValues.slice(0, 3)
  const recentStr = recentList.length > 0
    ? recentList.map((v) => `${v} TSS`).join(' / ')
    : ''

  const ariaRow = isTR
    ? `${bandLbl} — ${actualStr}/${expectedStr} deload, son ${sinceStr}h önce`
    : `${bandLbl} — ${actualStr}/${expectedStr} deloads, last ${sinceStr}w ago`

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Deload ritmi' : 'Deload cadence'}
      style={{ ...S.card, animationDelay: '420ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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
            {`${actualStr}/${expectedStr}`}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            DELOADS
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            DELOADLAR
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
            {sinceStr}
          </div>
          <div style={{
            ...S.mono,
            fontSize: '9px',
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '4px',
          }}>
            WEEKS SINCE
            <span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>
            HAFTA GEÇTİ
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
        {`ratio: ${ratioStr} (cap 0.75-1.50)`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`oran: ${ratioStr} (eşik 0.75-1.50)`}
      </div>

      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--sub, var(--muted))',
        marginBottom: recentStr ? '6px' : '10px',
        letterSpacing: '0.04em',
      }}>
        {`mean: ${meanStr} TSS/wk over ${weeks}w`}
        <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
        {`${weeks}h üzerinde ort: ${meanStr} TSS/h`}
      </div>

      {recentStr ? (
        <div style={{
          ...S.mono,
          fontSize: '10px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '10px',
          letterSpacing: '0.04em',
        }}>
          {`Recent deloads: ${recentStr}`}
          <span aria-hidden="true" style={{ margin: '0 6px' }}>·</span>
          {`Son deloadlar: ${recentStr}`}
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
