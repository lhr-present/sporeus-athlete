// ─── dashboard/SleepConsistencyCard.jsx — 28-day sleep regularity ────────────
//
// Surfaces `analyzeSleepConsistency` (population stdev of nightly sleep
// duration over a trailing 28-day window). This card measures REGULARITY
// — even if average sleep is fine, erratic patterns disrupt circadian
// rhythm and slow recovery (Walker 2017; Lunsford-Avery 2018).
//
// Distinct from:
//   - SleepDebtCard            — cumulative shortfall vs target
//   - PreRaceSleepBankingCard  — race-window surplus protocol
//
// Renders null when the pure-fn returns null (fewer than 7 valid sleepHrs
// entries within the window).

import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeSleepConsistency } from '../../lib/athlete/sleepConsistency.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  TIGHT:   '#5bc25b', // green
  LOOSE:   '#0064ff', // blue
  ERRATIC: '#ff6600', // orange
}

const BAND_LABEL_EN = {
  TIGHT:   'TIGHT',
  LOOSE:   'LOOSE',
  ERRATIC: 'ERRATIC',
}
const BAND_LABEL_TR = {
  TIGHT:   'SIKI',
  LOOSE:   'GEVŞEK',
  ERRATIC: 'DÜZENSİZ',
}

const HINT_EN = {
  TIGHT:   'Tight sleep schedule — circadian rhythm is well-anchored.',
  LOOSE:   'Some variation in sleep duration. Aim for a tighter bedtime window during heavy weeks.',
  ERRATIC: 'Wide swings in sleep duration — circadian rhythm is being disrupted. Recovery suffers even at OK averages.',
}
const HINT_TR = {
  TIGHT:   'Sıkı uyku düzeni — sirkadiyen ritim iyi sabitlenmiş.',
  LOOSE:   'Uyku sürelerinde biraz dalgalanma var. Yoğun haftalarda daha sıkı yatış aralığını hedefle.',
  ERRATIC: 'Uyku süresinde geniş salınımlar — sirkadiyen ritim bozuluyor. Ortalama iyi olsa bile toparlanma zarar görür.',
}

function SleepConsistencyCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => analyzeSleepConsistency({ recovery, windowDays: 28 }),
    [recovery],
  )

  if (!data) return null

  const {
    band,
    avgSleepHrs,
    stdSleepHrs,
    shortestHrs,
    longestHrs,
    sampleCount,
    citation,
  } = data

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'UYKU TUTARLILIĞI · 28G' : 'SLEEP CONSISTENCY · 28D'
  const ariaLabel = isTR ? 'Yirmi sekiz günlük uyku tutarlılığı' : 'Twenty-eight day sleep consistency'
  const sdSuffix = isTR ? 's SD' : 'h SD'
  const avgLine = isTR ? `ort ${avgSleepHrs}s` : `avg ${avgSleepHrs}h`
  const rangeLine = isTR
    ? `aralık ${shortestHrs}–${longestHrs}s`
    : `range ${shortestHrs}–${longestHrs}h`
  const sampleLine = isTR
    ? `${sampleCount} gece örneklendi`
    : `${sampleCount} nights sampled`

  // Format σ as a signed-magnitude string (±0.62h SD).
  const sdDisplay = `±${stdSleepHrs.toFixed(2)}${sdSuffix}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-sleep-consistency-card
      data-consistency-band={band}
      data-std-sleep-hrs={stdSleepHrs}
      data-avg-sleep-hrs={avgSleepHrs}
      data-shortest-hrs={shortestHrs}
      data-longest-hrs={longestHrs}
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
      {/* Title */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#ff6600',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        ◈ {title}
      </div>

      {/* Headline: big σ + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 6,
      }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          {sdDisplay}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          border: `1px solid ${color}`,
          borderRadius: 2,
          padding: '2px 6px',
          letterSpacing: '0.06em',
        }}>
          {bandLabel}
        </span>
      </div>

      {/* Reference numbers: avg + range + sample count */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: 10,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span>{avgLine}</span>
        <span>{rangeLine}</span>
        <span>{sampleLine}</span>
      </div>

      {/* Per-band guidance */}
      <div style={{
        fontSize: 10,
        color: 'var(--text, #ccc)',
        lineHeight: 1.5,
        marginTop: 2,
      }}>
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted)',
        marginTop: 10,
        letterSpacing: '0.04em',
        opacity: 0.7,
        borderTop: '1px solid var(--border)',
        paddingTop: 6,
        fontStyle: 'italic',
      }}>
        ℹ {citation}
      </div>
    </div>
  )
}

export default memo(SleepConsistencyCard)
