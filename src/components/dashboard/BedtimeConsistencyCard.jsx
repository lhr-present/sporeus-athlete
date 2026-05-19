// ─── dashboard/BedtimeConsistencyCard.jsx — 28-day bedtime regularity ────────
//
// Surfaces `analyzeBedtimeConsistency` (population stdev of bedtime CLOCK
// TIME over a trailing 28-day window). This card measures circadian
// PHASE regularity — *when* lights-out happens, not how long sleep lasts
// (that's SleepConsistencyCard).
//
// Renders null when the pure-fn returns null (fewer than 7 valid bedtime
// entries within the window).

import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeBedtimeConsistency } from '../../lib/athlete/bedtimeConsistency.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  STEADY:   '#5bc25b', // green
  DRIFTING: '#0064ff', // blue
  ERRATIC:  '#ff6600', // orange
}

const BAND_LABEL_EN = {
  STEADY:   'STEADY',
  DRIFTING: 'DRIFTING',
  ERRATIC:  'ERRATIC',
}
const BAND_LABEL_TR = {
  STEADY:   'İSTİKRARLI',
  DRIFTING: 'KAYIYOR',
  ERRATIC:  'DÜZENSİZ',
}

const HINT_EN = {
  STEADY:   'Bedtime within 30 min daily — circadian phase is well-anchored.',
  DRIFTING: 'Some bedtime variation. Aim to tighten the window during heavy training weeks.',
  ERRATIC:  'Bedtime swings of an hour or more — circadian rhythm is being disrupted. Anchor a consistent lights-out time.',
}
const HINT_TR = {
  STEADY:   'Günlük yatış saati 30 dk içinde — sirkadiyen faz iyi sabitlenmiş.',
  DRIFTING: 'Yatış saatinde biraz dalgalanma. Yoğun antrenman haftalarında pencereyi sıkılaştırmaya çalış.',
  ERRATIC:  'Bir saatten fazla yatış dalgalanması — sirkadiyen ritim bozuluyor. Tutarlı bir ışık-kapatma saati sabitle.',
}

function BedtimeConsistencyCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => analyzeBedtimeConsistency({ recovery, windowDays: 28 }),
    [recovery],
  )

  if (!data) return null

  const {
    band,
    avgBedtimeHHMM,
    stdMinutes,
    earliestBedtime,
    latestBedtime,
    sampleCount,
    citation,
  } = data

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'YATIŞ SAATİ TUTARLILIĞI · 28G' : 'BEDTIME CONSISTENCY · 28D'
  const ariaLabel = isTR
    ? 'Yirmi sekiz günlük yatış saati tutarlılığı'
    : 'Twenty-eight day bedtime consistency'
  const sdSuffix = isTR ? ' dk' : ' min'
  const rangeLine = isTR
    ? `aralık ${earliestBedtime}–${latestBedtime}`
    : `range ${earliestBedtime}–${latestBedtime}`
  const sampleLine = isTR
    ? `${sampleCount} gece örneklendi`
    : `${sampleCount} nights sampled`

  // Format σ as a signed-magnitude string (±X min).
  const sdDisplay = `±${stdMinutes.toFixed(0)}${sdSuffix}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-bedtime-consistency-card
      data-bedtime-band={band}
      data-avg-bedtime={avgBedtimeHHMM}
      data-std-minutes={stdMinutes}
      data-earliest-bedtime={earliestBedtime}
      data-latest-bedtime={latestBedtime}
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

      {/* Headline: big avg bedtime + band badge */}
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
          {avgBedtimeHHMM}
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

      {/* Reference numbers: σ + range + sample count */}
      <div style={{
        fontSize: 10,
        color: 'var(--muted)',
        letterSpacing: '0.04em',
        marginBottom: 10,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span>{sdDisplay}</span>
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

export default memo(BedtimeConsistencyCard)
