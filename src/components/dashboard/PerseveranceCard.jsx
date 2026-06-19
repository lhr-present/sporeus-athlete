// ─── PerseveranceCard.jsx — 12-week weekly-rhythm grit tracker ───────────────
//
// Surfaces `analyzePerseverance` (src/lib/athlete/perseverance.js).
// The pure-fn aggregates weekly session counts across the last 12
// ISO weeks (Mon-Sun) ending in the week containing today, computes
// a CV-based gritScore (0-100), and classifies the band:
//
//   CONSISTENT — gritScore >= 75   (steady weekly rhythm)
//   VARIABLE   — 50 <= score < 75  (mostly active with swings)
//   SPORADIC   — gritScore < 50    (uneven training)
//
// Renders null when the pure-fn returns null (fewer than 6 of 12
// weeks active — too sparse to compute meaningful grit).
//
// Citations: Duckworth A.L. et al. (2007) "Grit: Perseverance and
// passion for long-term goals"; Duckworth A.L. (2016) "Grit: The
// power of passion and perseverance".

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzePerseverance } from '../../lib/athlete/perseverance.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_TR = {
  CONSISTENT: 'TUTARLI',
  VARIABLE:   'DEĞİŞKEN',
  SPORADIC:   'DÜZENSİZ',
}
const BAND_COLOR = {
  CONSISTENT: '#5bc25b',
  VARIABLE:   '#0064ff',
  SPORADIC:   '#ff6600',
}
const BAND_HINT = {
  CONSISTENT: {
    en: 'Strong weekly rhythm — long-term consistency compounds into base fitness.',
    tr: 'Güçlü haftalık ritim — uzun vadeli tutarlılık temel fitnesi büyütür.',
  },
  VARIABLE: {
    en: 'Mostly active with some swings. Smooth the highs and lows for steadier progression.',
    tr: 'Çoğunlukla aktif ama bazı dalgalanmalar var. Daha dengeli ilerleme için iniş çıkışları yumuşat.',
  },
  SPORADIC: {
    en: 'Training is uneven — anchor 3-4 sessions per week before adding intensity work.',
    tr: 'Antrenman düzensiz — yoğunluk eklemeden önce haftada 3-4 seansı sabitle.',
  },
}

const MUTED_COLOR = '#555'

const BAR_AREA_HEIGHT = 38

/**
 * @description Surface `analyzePerseverance` as a Dashboard card.
 * Renders null when the pure-fn returns null.
 *
 * @param {{ log: Array }} props
 */
function PerseveranceCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(() => analyzePerseverance({ log }), [log])

  if (!analysis) return null
  const band = analysis.band
  if (!BAND_COLOR[band]) return null

  const color = BAND_COLOR[band]
  const hint = BAND_HINT[band]
  const bandLabel = isTR ? BAND_TR[band] : band
  const title = isTR ? 'AZİM · 12H' : 'PERSEVERANCE · 12W'
  const ariaLabel = isTR ? 'Azim' : 'Perseverance'

  const meanLabel    = isTR ? 'HAFTALIK ORT' : 'MEAN/WK'
  const cvLabel      = 'CV'
  const activeLabel  = isTR ? 'AKTİF HAFTA' : 'ACTIVE WEEKS'
  const gritLabel    = isTR ? 'AZİM SKORU' : 'GRIT SCORE'

  // Highest session-count drives the relative bar heights.
  const maxCount = Math.max(1, ...analysis.weeks.map(w => w.sessionCount))

  const cvDisplay = analysis.cv == null ? '—' : analysis.cv.toFixed(2)

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-perseverance-card
      data-grit-band={band}
      data-grit-score={analysis.gritScore}
      data-active-weeks={analysis.activeWeeks}
      data-mean-sessions-per-week={analysis.meanSessionsPerWeek}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-perseverance-band-label
          style={{
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: 700,
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Grit score — large number */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {gritLabel}
        </div>
        <div
          data-grit-score-display
          style={{
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {analysis.gritScore}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>/ 100</div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        fontSize: 10,
        color: 'var(--text)',
        letterSpacing: '0.03em',
      }}>
        <div>
          <span style={{ color: 'var(--muted)' }}>{meanLabel} </span>
          <span style={{ fontWeight: 700 }}>{analysis.meanSessionsPerWeek}</span>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>{cvLabel} </span>
          <span style={{ fontWeight: 700 }}>{cvDisplay}</span>
        </div>
        <div>
          <span style={{ color: 'var(--muted)' }}>{activeLabel} </span>
          <span style={{ fontWeight: 700 }}>{analysis.activeWeeks}/12</span>
        </div>
      </div>

      {/* 12 mini bars — one per week, height proportional to count */}
      <div
        data-perseverance-bars
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: BAR_AREA_HEIGHT,
          marginBottom: 10,
        }}
      >
        {analysis.weeks.map((w, i) => {
          const active = w.sessionCount >= 1
          const barH = active
            ? Math.max(4, Math.round((w.sessionCount / maxCount) * BAR_AREA_HEIGHT))
            : 3
          const barColor = active ? color : MUTED_COLOR
          return (
            <div
              key={`${w.weekStart}-${i}`}
              data-week-bar
              data-week-start={w.weekStart}
              data-week-sessions={w.sessionCount}
              title={`${w.weekStart} · ${w.sessionCount}`}
              style={{
                flex: 1,
                height: barH,
                background: active ? barColor : `${barColor}55`,
                border: `1px solid ${barColor}`,
                borderRadius: 1,
              }}
            />
          )
        })}
      </div>

      {/* Interpretation hint (bilingual) */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${color}10`,
        border: `1px solid ${color}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hint.tr : hint.en}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {analysis.citation}
      </div>
    </div>
  )
}

export default memo(PerseveranceCard)
