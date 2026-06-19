// ─── RestingHrFitnessTrendCard.jsx ─────────────────────────────────────────
//
// Dashboard surface for `analyzeRestingHrFitnessTrend` — a LONG-TERM
// fitness-marker view of resting HR (90-day window vs lifetime
// baseline). Distinct from `RestingHrDriftCard` which is the ACUTE
// over-reaching detector (14d baseline vs last-3d spike).
//
// Falling RHR over time is a canonical aerobic-fitness signal
// (Buchheit 2014; Plews 2014; Karvonen 1957). The card surfaces the
// recent 90-day average against the athlete's lifetime baseline and
// classifies the delta into three bands:
//
//   IMPROVING (green)  : recent ≤ lifetime − 2 bpm
//   STABLE    (blue)   : |delta| < 2 bpm
//   RISING    (orange) : recent ≥ lifetime + 2 bpm
//
// Renders null when the analyzer returns null (insufficient samples).

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeRestingHrFitnessTrend } from '../../lib/athlete/restingHrFitnessTrend.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  IMPROVING: '#5bc25b', // green
  STABLE:    '#0064ff', // blue
  RISING:    '#ff6600', // orange
}

const BAND_TR = {
  IMPROVING: 'İYİLEŞİYOR',
  STABLE:    'STABİL',
  RISING:    'ARTIYOR',
}

const BAND_HINT = {
  IMPROVING: {
    en: 'Resting HR is trending below your lifetime baseline — aerobic adaptation is working.',
    tr: 'İstirahat KAH yaşam boyu temelinin altına iniyor — aerobik adaptasyon çalışıyor.',
  },
  STABLE: {
    en: 'Resting HR matches your lifetime baseline — fitness is consistent with long-term form.',
    tr: 'İstirahat KAH yaşam boyu temelinle uyumlu — kondisyon uzun vadeli formunla tutarlı.',
  },
  RISING: {
    en: 'Resting HR creeping above lifetime baseline. Check sleep, illness, life stress, or recent training load.',
    tr: 'İstirahat KAH yaşam boyu temelinin üstüne çıkıyor. Uyku, hastalık, yaşam stresi veya son yükü kontrol et.',
  },
}

/**
 * @description Surface `analyzeRestingHrFitnessTrend` as a Dashboard card.
 * Renders null when the analyzer returns null (insufficient samples).
 *
 * @param {{ recovery: Array }} props
 */
function RestingHrFitnessTrendCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeRestingHrFitnessTrend({ recovery }),
    [recovery]
  )

  if (!analysis) return null

  const {
    band,
    lifetimeAvgRHR,
    recentAvgRHR,
    delta,
    recentSampleCount,
    lifetimeSampleCount,
  } = analysis

  const color = BAND_COLOR[band]
  const hint = BAND_HINT[band]
  if (!color || !hint) return null
  const bandLabel = isTR ? BAND_TR[band] : band

  const title = isTR
    ? 'İSTİRAHAT KAH · 90G vs YAŞAM BOYU'
    : 'RESTING HR · 90D vs LIFETIME'
  const ariaLabel = isTR
    ? 'İstirahat kalp atış hızı uzun vadeli trend'
    : 'Resting heart rate long-term fitness trend'

  const deltaSigned = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} bpm`
  const deltaContext = isTR ? 'yaşam boyu temele göre' : 'vs lifetime'
  const lifetimeLabel = isTR ? 'YAŞAM BOYU' : 'LIFETIME'
  const recentSamplesLabel = isTR
    ? `${recentSampleCount} son giriş`
    : `${recentSampleCount} recent entries`
  const lifetimeSamplesLabel = isTR
    ? `${lifetimeSampleCount} yaşam boyu giriş`
    : `${lifetimeSampleCount} lifetime entries`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-resting-hr-fitness-trend-card
      data-fitness-band={band}
      data-recent-avg-rhr={recentAvgRHR}
      data-lifetime-avg-rhr={lifetimeAvgRHR}
      data-delta={delta}
      data-recent-sample-count={recentSampleCount}
      data-lifetime-sample-count={lifetimeSampleCount}
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
      {/* Header row: title + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
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
          data-fitness-band-label
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

      {/* Big recent average + signed delta */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 10,
      }}>
        <div
          data-recent-avg-rhr-display
          style={{
            fontSize: 26,
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '0.03em',
          }}
        >
          {recentAvgRHR.toFixed(0)} bpm
        </div>
        <div
          data-delta-display
          style={{
            fontSize: 11,
            color,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {deltaSigned}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          {deltaContext}
        </div>
      </div>

      {/* Lifetime baseline reference */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 9,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
        }}>
          {lifetimeLabel}
        </div>
        <div
          data-lifetime-avg-rhr-display
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '0.03em',
          }}
        >
          {lifetimeAvgRHR.toFixed(1)} bpm
        </div>
      </div>

      {/* Sample counts */}
      <div style={{
        display: 'flex',
        gap: 10,
        fontSize: 9,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: 10,
      }}>
        <span data-recent-sample-count-display>· {recentSamplesLabel}</span>
        <span data-lifetime-sample-count-display>· {lifetimeSamplesLabel}</span>
      </div>

      {/* Interpretation hint */}
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
        Buchheit 2014; Plews 2014
      </div>
    </div>
  )
}

export default memo(RestingHrFitnessTrendCard)
