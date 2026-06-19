// ─── TimeOfDayConsistencyCard.jsx — training-time circadian consistency ─────
// Renders the typical training hour and start-time SD for the last 4 weeks,
// classifying the athlete into a circadian-consistency band:
//
//   TIGHT     <60 min SD  — strong circadian alignment        (green)
//   MODERATE  60-120      — reasonably consistent             (blue)
//   LOOSE     120-180     — variable timing                   (orange)
//   SCATTERED >180        — try to anchor training time       (red)
//
// Card renders nothing when there are <6 timed entries in the window
// (computeTimeOfDayConsistency returns null).
//
// Citations: Mah 2011 (sleep+performance); Walker 2017 (circadian
// alignment); Hammar 2007 (Eur J Appl Physiol).

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import {
  computeTimeOfDayConsistency,
  TIME_OF_DAY_CONSISTENCY_CITATION,
} from '../../lib/athlete/timeOfDayConsistency.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  TIGHT:     '#5bc25b', // green
  MODERATE:  '#0064ff', // blue
  LOOSE:     '#ff6600', // orange
  SCATTERED: '#e03030', // red
}

const BAND_INTERPRETATION = {
  TIGHT: {
    en: 'Strong circadian alignment',
    tr: 'Güçlü sirkadiyen uyum',
  },
  MODERATE: {
    en: 'Reasonably consistent',
    tr: 'Makul tutarlılık',
  },
  LOOSE: {
    en: 'Variable timing — sleep + adaptation may suffer',
    tr: 'Değişken zamanlama',
  },
  SCATTERED: {
    en: 'Try to anchor training time',
    tr: 'Antrenman saatini sabitle',
  },
}

const BAND_LABEL_TR = {
  TIGHT:     'SIKI',
  MODERATE:  'ORTA',
  LOOSE:     'GEVŞEK',
  SCATTERED: 'DAĞINIK',
}

// Format a decimal-hour (e.g. 7.5) as zero-padded HH:MM.
function formatHourToHHMM(decimalHour) {
  const totalMin = Math.round(decimalHour * 60)
  const wrapped = ((totalMin % 1440) + 1440) % 1440 // safety wrap
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function TimeOfDayConsistencyCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => computeTimeOfDayConsistency({ log, weeks: 4 }),
    [log]
  )

  if (!result) return null

  const { meanHour, sdMinutes, band, n } = result
  const color = BAND_COLOR[band] || '#888'
  const hhmm = formatHourToHHMM(meanHour)
  const sdRounded = Math.round(sdMinutes)
  const interp = BAND_INTERPRETATION[band] || { en: '', tr: '' }
  const bandLabel = isTR ? (BAND_LABEL_TR[band] || band) : band
  const title = isTR ? 'ANTRENMAN SAATİ · 4H' : 'TRAINING TIME · 4W'
  const ariaLabel = isTR
    ? 'Antrenman saati tutarlılığı'
    : 'Training time-of-day consistency'

  const minutesUnit = isTR ? 'dk' : 'min'
  const sessionsLabel = isTR
    ? `${n} antrenman`
    : `${n} session${n === 1 ? '' : 's'}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-time-of-day-consistency-card
      data-consistency-band={band}
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
          <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-consistency-band-label
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: '#000', background: color,
            padding: '2px 8px', borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      <div style={{
        fontSize: 22, fontWeight: 700, color: 'var(--text)',
        letterSpacing: '0.02em', marginBottom: 4,
      }}>
        <span data-typical-hour>{hhmm}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 14 }}>
          {' '}± <span data-sd-minutes>{sdRounded}</span> {minutesUnit}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        {sessionsLabel}
      </div>

      <div style={{
        fontSize: 11, color: color, lineHeight: 1.5, marginBottom: 8,
      }}>
        {isTR ? interp.tr : interp.en}
      </div>

      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {TIME_OF_DAY_CONSISTENCY_CITATION}
      </div>
    </div>
  )
}

export default memo(TimeOfDayConsistencyCard)
