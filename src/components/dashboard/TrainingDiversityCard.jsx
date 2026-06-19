// ─── dashboard/TrainingDiversityCard.jsx — v8.86.0 Multi-Sport Variety ──────
// Surfaces detectTrainingDiversity(): 28-day classification across run, bike,
// swim, strength, other. Distinct from SessionVarietyCard (intent variety):
// a triathlete may have rich intent mix yet train one sport, or vice versa.
// Cite: Bompa & Haff 2009 multi-sport; Tonnessen 2014 polarized + variety.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectTrainingDiversity } from '../../lib/athlete/trainingDiversity.js'

const BAND_COLOR = {
  monotypic:  '#dc3545',
  limited:    '#ff9500',
  balanced:   '#28a745',
  fragmented: '#9acd32',
}

const BAND_LABEL = {
  monotypic:  { en: 'MONOTYPIC',  tr: 'TEK-SPOR' },
  limited:    { en: 'LIMITED',    tr: 'SINIRLI' },
  balanced:   { en: 'BALANCED',   tr: 'DENGELİ' },
  fragmented: { en: 'FRAGMENTED', tr: 'DAĞINIK' },
}

const SPORT_ORDER = ['run', 'bike', 'swim', 'strength', 'other']

const SPORT_COLOR = {
  run:      '#0064ff',
  bike:     '#28a745',
  swim:     '#9acd32',
  strength: '#ff6600',
  other:    '#9c27b0',
}

const SPORT_LABEL = {
  run:      { en: 'Run',      tr: 'Koşu' },
  bike:     { en: 'Bike',     tr: 'Bisiklet' },
  swim:     { en: 'Swim',     tr: 'Yüzme' },
  strength: { en: 'Strength', tr: 'Güç' },
  other:    { en: 'Other',    tr: 'Diğer' },
}

function TrainingDiversityCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => detectTrainingDiversity(log), [log])

  const title = isTR ? 'ANTRENMAN ÇEŞİTLİLİĞİ — 28G' : 'TRAINING DIVERSITY — 28D'

  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={isTR ? 'Antrenman çeşitliliği — yetersiz veri' : 'Training diversity — insufficient data'}
        style={{ ...S.card, animationDelay: '400ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '11px', color: '#888',
          textAlign: 'center', padding: '14px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Çeşitliliği görmek için 5+ seans kaydet'
            : 'Log 5+ sessions to see diversity'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  const accent = BAND_COLOR[result.band] || BAND_COLOR.balanced
  const bandLbl = BAND_LABEL[result.band]?.[isTR ? 'tr' : 'en'] || result.band.toUpperCase()

  const message = result.message?.[isTR ? 'tr' : 'en'] || ''
  const recommendation = result.recommendation?.[isTR ? 'tr' : 'en'] || ''

  const hhiStr = result.herfindahlIndex.toFixed(3)
  const ariaSummary = isTR
    ? `${result.sportsActive}/5 spor aktif, yoğunluk ${hhiStr}`
    : `${result.sportsActive} of 5 sports active, concentration ${hhiStr}`

  const stackedSegments = SPORT_ORDER
    .map(k => ({ k, share: result.sharesPerSport[k] || 0 }))
    .filter(s => s.share > 0)

  const barAriaLabel = isTR
    ? `Spor karışımı: ${stackedSegments.map(s => `${SPORT_LABEL[s.k].tr} %${Math.round(s.share * 100)}`).join(', ')}`
    : `Sport mix: ${stackedSegments.map(s => `${SPORT_LABEL[s.k].en} ${Math.round(s.share * 100)}%`).join(', ')}`

  const breakdownRows = SPORT_ORDER
    .filter(k => result.sessionsPerSport[k] > 0)
    .map(k => {
      const sessions = result.sessionsPerSport[k]
      const minutes = result.minutesPerSport[k]
      const pct = Math.round((result.sharesPerSport[k] || 0) * 100)
      const label = SPORT_LABEL[k][isTR ? 'tr' : 'en']
      const sessLbl = isTR ? 'seans' : (sessions === 1 ? 'session' : 'sessions')
      const minLbl = isTR ? 'dk' : 'min'
      return { k, text: `${label}: ${sessions} ${sessLbl} · ${minutes} ${minLbl} · ${pct}%` }
    })

  const dominantLbl = result.dominantSport
    ? SPORT_LABEL[result.dominantSport][isTR ? 'tr' : 'en']
    : ''
  const showDominantCallout = result.band !== 'balanced' && result.dominantSport

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={isTR ? 'Antrenman çeşitliliği' : 'Training diversity'}
      style={{ ...S.card, animationDelay: '400ms', borderLeft: `4px solid ${accent}`, padding: '20px' }}
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
        aria-label={ariaSummary}
        style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', padding: '4px 0 10px', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{
            ...S.mono, fontSize: '32px', fontWeight: 700, color: accent,
            lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {result.sportsActive}
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--muted)', marginLeft: '2px' }}>
              /5
            </span>
          </div>
          <div style={{
            ...S.mono, fontSize: '9px', color: 'var(--muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', paddingBottom: '4px',
          }}>
            SPORTS<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>SPOR
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{
            ...S.mono, fontSize: '20px', fontWeight: 700, color: 'var(--text)',
            lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {hhiStr}
          </div>
          <div style={{
            ...S.mono, fontSize: '9px', color: 'var(--muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', paddingBottom: '2px',
          }}>
            HHI<span aria-hidden="true" style={{ margin: '0 4px' }}>·</span>YOĞUNLUK
          </div>
        </div>
      </div>

      <div
        role="img"
        aria-label={barAriaLabel}
        style={{
          display: 'flex',
          width: '100%',
          height: '10px',
          borderRadius: '3px',
          overflow: 'hidden',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          marginBottom: '12px',
        }}
      >
        {stackedSegments.map(({ k, share }) => (
          <div
            key={k}
            style={{
              flex: `${share} 0 0`,
              background: SPORT_COLOR[k],
            }}
          />
        ))}
      </div>

      {breakdownRows.length > 0 ? (
        <div
          role="list"
          aria-label={isTR ? 'Spor başına kırılım' : 'Per-sport breakdown'}
          style={{ marginBottom: '8px' }}
        >
          {breakdownRows.map(row => (
            <div
              key={row.k}
              role="listitem"
              style={{
                ...S.mono,
                fontSize: '11px',
                color: 'var(--sub, var(--muted))',
                lineHeight: 1.7,
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span aria-hidden="true" style={{
                display: 'inline-block', width: '6px', height: '6px',
                borderRadius: '50%', background: SPORT_COLOR[row.k],
              }} />
              {row.text}
            </div>
          ))}
        </div>
      ) : null}

      {showDominantCallout ? (
        <div style={{
          ...S.mono, fontSize: '11px', color: 'var(--text)',
          marginBottom: '8px', letterSpacing: '0.03em',
        }}>
          {isTR ? `Baskın: ${dominantLbl}` : `Dominant: ${dominantLbl}`}
        </div>
      ) : null}

      {message ? (
        <div style={{
          ...S.mono, fontSize: '11px', color: 'var(--text)', lineHeight: 1.6,
          paddingLeft: '8px', borderLeft: `2px solid ${accent}`, marginBottom: '8px',
        }}>
          {message}
        </div>
      ) : null}

      {recommendation ? (
        <div style={{
          ...S.mono, fontSize: '11px', color: 'var(--sub, var(--muted))',
          lineHeight: 1.6, marginBottom: '8px',
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

export default memo(TrainingDiversityCard)
