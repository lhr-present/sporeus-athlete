// ─── dashboard/CoachingSummaryScoreCard.jsx — E129: Composite coaching score ─
// Surfaces computeCoachingSummaryScore() as the headline coaching card. Sits
// ABOVE the CoachingInsightsDigest and the 5 individual detector cards. Single
// glance: 0-100 score, band badge, weakest component, 5-dot detector strip,
// "scroll for details" affordance.
// Citations: Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991;
//            Stöggl & Sperlich 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeCoachingSummaryScore } from '../../lib/athlete/coachingSummaryScore.js'

// ─── Band → color (excellent and good are visibly distinct greens) ───────────
const BAND_COLOR = {
  excellent:  '#5bc25b',
  good:       '#3a8f3a',
  needs_work: '#f5c542',
  poor:       '#e03030',
}

const BAND_LABEL = {
  excellent:  { en: 'EXCELLENT',  tr: 'MÜKEMMEL' },
  good:       { en: 'GOOD',       tr: 'İYİ' },
  needs_work: { en: 'NEEDS WORK', tr: 'GELİŞTİRİLMELİ' },
  poor:       { en: 'POOR',       tr: 'ZAYIF' },
}

const COMPONENT_LABEL = {
  workoutDensity:    { en: 'Density',    tr: 'Yoğunluk' },
  sessionVariety:    { en: 'Variety',    tr: 'Çeşitlilik' },
  staleZones:        { en: 'Zones',      tr: 'Bölgeler' },
  fitnessGainRate:   { en: 'Fitness',    tr: 'Form' },
  easyDayCompliance: { en: 'Easy days',  tr: 'Kolay günler' },
}

const COMPONENT_FULL_LABEL = {
  workoutDensity:    { en: 'Workout density',    tr: 'Antrenman yoğunluğu' },
  sessionVariety:    { en: 'Session variety',    tr: 'Antrenman çeşitliliği' },
  staleZones:        { en: 'Zone coverage',      tr: 'Bölge kapsamı' },
  fitnessGainRate:   { en: 'Fitness trend',      tr: 'Form trendi' },
  easyDayCompliance: { en: 'Easy day compliance', tr: 'Kolay gün uyumu' },
}

// Render order for the 5 dots (matches detector source order in digest)
const COMPONENT_ORDER = [
  'workoutDensity',
  'sessionVariety',
  'staleZones',
  'fitnessGainRate',
  'easyDayCompliance',
]

// ─── Per-component dot color (independent of band) ───────────────────────────
function dotColor(score) {
  if (score === null || score === undefined) return '#444'
  if (score >= 80) return '#5bc25b'
  if (score >= 60) return '#f5c542'
  return '#e03030'
}

// ─── Component ───────────────────────────────────────────────────────────────
function CoachingSummaryScoreCard({ log = [] }) {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const result = useMemo(() => computeCoachingSummaryScore(log), [log])

  const title = isTR ? 'ANTRENÖR SKORU — 28G' : 'COACHING SCORE — 28D'
  const regionAria = isTR ? 'Antrenör özet skoru' : 'Coaching summary score'

  // ─── Empty / unreliable state (<3 detectors counted) ───────────────────────
  if (result.reliable === false) {
    return (
      <div
        className="sp-card"
        role="region"
        aria-label={
          isTR ? 'Antrenör özet skoru — yetersiz veri' : 'Coaching summary score — not enough data'
        }
        style={{ ...S.card, animationDelay: '160ms' }}
      >
        <div style={S.cardTitle}>{title}</div>
        <div style={{
          ...S.mono, fontSize: '12px', color: '#888',
          textAlign: 'center', padding: '18px 0', lineHeight: 1.7,
        }}>
          {isTR
            ? 'Antrenör skorunu görmek için 14+ gün antrenman kaydet'
            : 'Log 14+ days of training to see your coaching score'}
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px' }}>
          {result.citation}
        </div>
      </div>
    )
  }

  // ─── Reliable: render the headline card ────────────────────────────────────
  const accent = BAND_COLOR[result.band] || BAND_COLOR.needs_work
  const bandLbl = BAND_LABEL[result.band][isTR ? 'tr' : 'en']
  const message = result.message[isTR ? 'tr' : 'en']

  // Combined aria for the score+band block
  const scoreAria = isTR
    ? `${bandLbl.toLowerCase()} skor ${result.score}/100`
    : `${result.band.replace('_', ' ')} score ${result.score} of 100`

  // Weakest component callout
  let weakestLine = null
  if (result.weakest && result.weakest.name) {
    const wName = COMPONENT_LABEL[result.weakest.name]?.[isTR ? 'tr' : 'en'] || result.weakest.name
    weakestLine = isTR
      ? `En zayıf: ${wName} (${result.weakest.score})`
      : `Weakest: ${wName} (${result.weakest.score})`
  }

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={regionAria}
      style={{
        ...S.card,
        animationDelay: '160ms',
        borderLeft: `4px solid ${accent}`,
        padding: '20px',
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ─── Big score + band badge ─────────────────────────────────────── */}
      <div
        aria-label={scoreAria}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '14px',
          padding: '8px 0 10px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{
          ...S.mono,
          fontSize: '52px',
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {result.score}
        </div>
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--muted)',
          fontWeight: 500,
        }}>
          / 100
        </div>
        <div
          style={{
            ...S.mono,
            fontSize: '13px',
            fontWeight: 700,
            color: '#fff',
            background: accent,
            padding: '6px 12px',
            borderRadius: '4px',
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}
        >
          {bandLbl}
        </div>
      </div>

      {/* ─── Bilingual message ─────────────────────────────────────────── */}
      <div
        aria-live="polite"
        style={{
          ...S.mono,
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: 1.6,
          marginBottom: '14px',
        }}
      >
        {message}
      </div>

      {/* ─── 5 component dots ──────────────────────────────────────────── */}
      <div
        role="list"
        aria-label={isTR ? 'Bileşen skorları' : 'Component scores'}
        style={{
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          padding: '4px 0 10px',
          flexWrap: 'wrap',
        }}
      >
        {COMPONENT_ORDER.map(name => {
          const score = result.components[name]
          const fullLbl = COMPONENT_FULL_LABEL[name][isTR ? 'tr' : 'en']
          const shortLbl = COMPONENT_LABEL[name][isTR ? 'tr' : 'en']
          const valueLbl = score === null
            ? (isTR ? 'veri yok' : 'no data')
            : score
          const dotAria = isTR
            ? `${fullLbl}: ${valueLbl}`
            : `${fullLbl}: ${valueLbl}`
          return (
            <div
              key={name}
              role="listitem"
              aria-label={dotAria}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                minWidth: '50px',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: dotColor(score),
                  display: 'inline-block',
                }}
              />
              <span style={{
                ...S.mono,
                fontSize: '9px',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {shortLbl}
              </span>
            </div>
          )
        })}
      </div>

      {/* ─── Weakest component callout ─────────────────────────────────── */}
      {weakestLine && (
        <div style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--sub, var(--muted))',
          marginBottom: '8px',
        }}>
          {weakestLine}
        </div>
      )}

      {/* ─── "See details" affordance (scroll hint, no link) ───────────── */}
      <div style={{
        ...S.mono,
        fontSize: '10px',
        color: 'var(--muted)',
        marginTop: '4px',
      }}>
        {isTR ? '↓ Detaylar' : '↓ See details'}
      </div>

      {/* ─── Citation footer ───────────────────────────────────────────── */}
      <div style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '10px' }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(CoachingSummaryScoreCard)
